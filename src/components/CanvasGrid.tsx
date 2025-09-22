// src/components/CanvasGrid.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export const GRID_WIDTH = 64;
export const GRID_HEIGHT = 40;
const PIXEL_SIZE = 10;
const WHITE = "#ffffff";

type Props = {
  selectedColor: string;
  username: string;
  zoom: number;
  canPlace?: boolean;
  onPlaced?: (row: { x: number; y: number; color: string; username: string }) => void;
  onStats?: (stats: { nonWhite: number }) => void;
  onZoomDelta?: (delta: number) => void; // multiplicative (e.g., 1.05 to zoom in slightly)
};

type PixelRow = {
  x: number;
  y: number;
  color: string | null;
  username: string | null;
  timestamp?: string;
};

const CanvasGrid = ({
  selectedColor,
  username,
  zoom,
  canPlace = true,
  onPlaced,
  onStats,
  onZoomDelta,
}: Props) => {
  // ===== State =====
  const [grid, setGrid] = useState<string[][]>(
    Array.from({ length: GRID_HEIGHT }, () => Array(GRID_WIDTH).fill(WHITE))
  );
  const [gridUsernames, setGridUsernames] = useState<(string | null)[][]>(
    Array.from({ length: GRID_HEIGHT }, () => Array(GRID_WIDTH).fill(null))
  );

  // keep a stable ref to onStats to avoid stale closures
  const onStatsRef = useRef(onStats);
  useEffect(() => {
    onStatsRef.current = onStats;
  }, [onStats]);

  // recompute revealed count from the grid on every local change
  useEffect(() => {
    const nonWhite = grid.reduce(
      (acc, row) => acc + row.reduce((s, c) => s + (c.toLowerCase() !== WHITE ? 1 : 0), 0),
      0
    );
    onStatsRef.current?.({ nonWhite });
  }, [grid]);

  // layout / zoom
  const outerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const baseWidth = GRID_WIDTH * PIXEL_SIZE;
  const baseHeight = GRID_HEIGHT * PIXEL_SIZE;
  const totalScale = fitScale * zoom;
  const scaledWidth = baseWidth * totalScale;
  const scaledHeight = baseHeight * totalScale;

  // fit-to-box at zoom=1
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const recompute = () => {
      const cw = vp.clientWidth;
      const ch = vp.clientHeight;
      const next = Math.min(cw / baseWidth, ch / baseHeight);
      setFitScale(next);
      if (zoom === 1) {
        vp.scrollLeft = 0;
        vp.scrollTop = 0;
      }
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(vp);
    window.addEventListener("orientationchange", recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", recompute);
    };
  }, [zoom, baseWidth, baseHeight]);

  // ===== Helpers =====
  const setCell = (x: number, y: number, color: string, placedBy?: string | null) => {
    if (x < 0 || y < 0 || x >= GRID_WIDTH || y >= GRID_HEIGHT) return;

    setGrid((prev) =>
      prev.map((row, ry) => row.map((c, rx) => (rx === x && ry === y ? color : c)))
    );

    if (placedBy !== undefined) {
      setGridUsernames((prev) =>
        prev.map((row, ry) => row.map((u, rx) => (rx === x && ry === y ? placedBy : u)))
      );
    }
  };

  const refreshCount = async () => {
    const { data: countRes, error: countErr } = await supabase.rpc("revealed_count");
    if (!countErr && typeof countRes === "number") {
      onStatsRef.current?.({ nonWhite: countRes });
    }
  };

  // ===== Initial load from view =====
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from("current_canvas")
        .select("x,y,color,username,timestamp")
        .order("y", { ascending: true })
        .order("x", { ascending: true });

      if (error) {
        console.error("❌ Load current canvas failed:", error.message);
        return;
      }
      if (cancelled || !data) return;

      const freshColors: string[][] = Array.from({ length: GRID_HEIGHT }, () =>
        Array(GRID_WIDTH).fill("#ffffff")
      );
      const freshUsers: (string | null)[][] = Array.from({ length: GRID_HEIGHT }, () =>
        Array(GRID_WIDTH).fill(null)
      );

      for (const r of data as PixelRow[]) {
        if (r.x >= 0 && r.y >= 0 && r.x < GRID_WIDTH && r.y < GRID_HEIGHT) {
          freshColors[r.y][r.x] = (r.color ?? "#ffffff").toLowerCase();
          freshUsers[r.y][r.x] = r.username ?? null;
        }
      }
      setGrid(freshColors);
      setGridUsernames(freshUsers);

      await refreshCount(); // authoritative count
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // ===== Realtime inserts → paint cell + refresh server count =====
  useEffect(() => {
    const channel = supabase
      .channel("pixeldb-inserts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "PixelDatabase" },
        (payload) => {
          const row = payload.new as PixelRow;
          const x = Number(row.x);
          const y = Number(row.y);
          if (Number.isNaN(x) || Number.isNaN(y)) return;
          if (x < 0 || y < 0 || x >= GRID_WIDTH || y >= GRID_HEIGHT) return;

          setCell(x, y, (row.color ?? WHITE).toLowerCase(), row.username ?? null);
          // ask DB for the definitive revealed count
          refreshCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ===== Input: click to place =====
  const handleClick = async (x: number, y: number) => {
    if (!canPlace) return;

    const prevColor = grid[y][x];
    const prevUser = gridUsernames[y][x];
    const nextColor = selectedColor.toLowerCase();
    const placedBy = username || "Anonymous";

    // optimistic
    setCell(x, y, nextColor, placedBy);

    // server-side checked insert (cooldown)
    const { error } = await supabase.rpc("place_pixel", {
      p_x: x,
      p_y: y,
      p_color: nextColor,
      p_username: placedBy,
      p_cooldown_seconds: import.meta.env.DEV ? 30 : 300,
    });

    if (error) {
      // rollback on error
      console.warn("RPC place_pixel error:", error);
      setCell(x, y, prevColor, prevUser);
      return;
    }
    onPlaced?.({ x, y, color: nextColor, username: placedBy });
    // Count will be refreshed by the realtime listener when the insert lands
  };

  // ===== Pinch to zoom (mobile) + wheel zoom (desktop) =====
  const initialPinch = useRef<{ d: number } | null>(null);
  const pinchDistance = (e: TouchEvent) => {
    const t0 = e.touches[0],
      t1 = e.touches[1];
    const dx = t1.clientX - t0.clientX;
    const dy = t1.clientY - t0.clientY;
    return Math.hypot(dx, dy);
  };

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialPinch.current = { d: pinchDistance(e) };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialPinch.current) {
        e.preventDefault();
        const dNow = pinchDistance(e);
        const d0 = initialPinch.current.d || 1;
        if (d0 > 0 && Math.abs(dNow - d0) > 2) {
          const delta = Math.pow(dNow / d0, 0.85);
          onZoomDelta?.(delta);
          initialPinch.current.d = dNow;
        }
      }
    };
    const onTouchEnd = () => {
      initialPinch.current = null;
    };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return; // only with ctrl/cmd like browsers' "pinch"
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.05 : 0.95;
      onZoomDelta?.(delta);
    };

    el.addEventListener("touchstart", onTouchStart as any, { passive: true });
    el.addEventListener("touchmove", onTouchMove as any, { passive: false });
    el.addEventListener("touchend", onTouchEnd as any);
    el.addEventListener("touchcancel", onTouchEnd as any);
    el.addEventListener("wheel", onWheel as any, { passive: false });

    return () => {
      el.removeEventListener("touchstart", onTouchStart as any);
      el.removeEventListener("touchmove", onTouchMove as any);
      el.removeEventListener("touchend", onTouchEnd as any);
      el.removeEventListener("touchcancel", onTouchEnd as any);
      el.removeEventListener("wheel", onWheel as any);
    };
  }, [onZoomDelta]);

  // ===== Render =====
  const cells = useMemo(
    () =>
      grid.flatMap((row, y) =>
        row.map((color, x) => (
          <div
            key={`${x}-${y}`}
            onClick={() => handleClick(x, y)}
            className="cursor-pointer"
            style={{
              width: PIXEL_SIZE,
              height: PIXEL_SIZE,
              backgroundColor: color,
            }}
            title={`(${x},${y}) — placed by ${gridUsernames[y][x] ?? "Unknown"}`}
          />
        ))
      ),
    [grid, gridUsernames]
  );

  return (
    <div
      ref={outerRef}
      className="rounded-lg border border-gray-300"
      style={{
        width: "100%",
        maxWidth: 720,
        aspectRatio: `${GRID_WIDTH} / ${GRID_HEIGHT}`,
      }}
    >
      <div
        ref={viewportRef}
        className={zoom > 1 ? "w-full h-full overflow-auto" : "w-full h-full overflow-hidden"}
        style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x pan-y" }}
      >
        <div style={{ width: scaledWidth, height: scaledHeight }}>
          <div
            className="origin-top-left transition-transform"
            style={{
              transform: `scale(${totalScale})`,
              transformOrigin: "top left",
              width: baseWidth,
              height: baseHeight,
            }}
          >
            <div className="grid" style={{ gridTemplateColumns: `repeat(${GRID_WIDTH}, ${PIXEL_SIZE}px)` }}>
              {cells}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CanvasGrid;
