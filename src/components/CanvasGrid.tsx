// src/components/CanvasGrid.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export const GRID_WIDTH = 64;
export const GRID_HEIGHT = 40;
const PIXEL_SIZE = 10;
const WHITE = "#ffffff";
const isHex = (v: string) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);

const normalizeHex = (v: string): string | null => {
  if (!v) return null;
  let s = v.trim();
  if (!s.startsWith("#")) s = "#" + s;
  if (!isHex(s)) return null;
  // Expand 3-digit (#RGB -> #RRGGBB)
  if (s.length === 4) {
    const r = s[1], g = s[2], b = s[3];
    s = `#${r}${r}${g}${g}${b}${b}`;
  }
  return s.toUpperCase();
};

type Props = {
  selectedColor: string;
  username: string;
  zoom: number;
  canPlace?: boolean;
  onPlaced?: (row: { x: number; y: number; color: string; username: string }) => void;
  onStats?: (stats: { nonWhite: number }) => void;
  onZoomDelta?: (delta: number) => void; // optional pinch/ctrl+wheel hook
};

type PixelRow = {
  x: number;
  y: number;
  color: string | null;
  username: string | null;
  timestamp?: string | null;
};

const isHex6 = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);

export default function CanvasGrid({
  selectedColor,
  username,
  zoom,
  canPlace = true,
  onPlaced,
  onStats,
  onZoomDelta,
}: Props) {
  // ===== grid state =====
  const [grid, setGrid] = useState<string[][]>(
    Array.from({ length: GRID_HEIGHT }, () => Array(GRID_WIDTH).fill(WHITE))
  );
  const [gridUsernames, setGridUsernames] = useState<(string | null)[][]>(
    Array.from({ length: GRID_HEIGHT }, () => Array(GRID_WIDTH).fill(null))
  );

  // recompute revealed count from grid (authoritative, no drift)
  useEffect(() => {
    const nonWhite = grid.reduce(
      (acc, row) => acc + row.reduce((s, c) => s + (c !== WHITE ? 1 : 0), 0),
      0
    );
    onStats?.({ nonWhite });
  }, [grid, onStats]);

  // ===== layout / zoom =====
  const viewportRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const baseWidth = GRID_WIDTH * PIXEL_SIZE;
  const baseHeight = GRID_HEIGHT * PIXEL_SIZE;
  const totalScale = fitScale * zoom;
  const scaledWidth = baseWidth * totalScale;
  const scaledHeight = baseHeight * totalScale;

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

  // ===== helpers =====
  const applyCell = (x: number, y: number, color: string, placedBy?: string | null) => {
    if (x < 0 || y < 0 || x >= GRID_WIDTH || y >= GRID_HEIGHT) return;
    setGrid(prev =>
      prev.map((row, ry) => row.map((c, rx) => (rx === x && ry === y ? color : c)))
    );
    if (placedBy !== undefined) {
      setGridUsernames(prev =>
        prev.map((row, ry) => row.map((u, rx) => (rx === x && ry === y ? placedBy : u)))
      );
    }
  };

  // ===== initial load + realtime (buffer during load) =====
  const isLoadingRef = useRef(true);
  const bufferRef = useRef<PixelRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    const fillFromRows = (rows: PixelRow[]) => {
      const freshColors: string[][] = Array.from({ length: GRID_HEIGHT }, () =>
        Array(GRID_WIDTH).fill(WHITE)
      );
      const freshUsers: (string | null)[][] = Array.from({ length: GRID_HEIGHT }, () =>
        Array(GRID_WIDTH).fill(null)
      );
      for (const r of rows) {
        const x = r.x | 0, y = r.y | 0;
        if (x >= 0 && y >= 0 && x < GRID_WIDTH && y < GRID_HEIGHT) {
          const color = (r.color ?? WHITE).toLowerCase();
          freshColors[y][x] = isHex6(color) ? color : WHITE;
          freshUsers[y][x] = r.username ?? null;
        }
      }
      setGrid(freshColors);
      setGridUsernames(freshUsers);
    };

    const load = async () => {
      // 1) Subscribe first; buffer events during load
      const channel = supabase
        .channel("pixeldb-inserts")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "PixelDatabase" },
          (payload) => {
            const r = payload.new as PixelRow;
            if (isLoadingRef.current) {
              bufferRef.current.push(r);
            } else {
              const x = r.x | 0, y = r.y | 0;
              if (x < 0 || y < 0 || x >= GRID_WIDTH || y >= GRID_HEIGHT) return;
              const color = (r.color ?? WHITE).toLowerCase();
              applyCell(x, y, isHex6(color) ? color : WHITE, r.username ?? null);
            }
          }
        )
        .subscribe();

      // 2) Try authoritative view; if missing, fall back to table replay
      let rows: PixelRow[] = [];
      {
        const { data, error } = await supabase
          .from("current_canvas") // view with latest per cell
          .select("x,y,color,username,timestamp")
          .order("y", { ascending: true })
          .order("x", { ascending: true });

        if (!error && data) {
          rows = data as PixelRow[];
        } else {
          // Fallback: replay from table (oldest→newest; latest wins)
          const { data: raw, error: e2 } = await supabase
            .from("PixelDatabase")
            .select("x,y,color,username,timestamp")
            .order("timestamp", { ascending: true });
          if (e2) {
            console.error("❌ Load pixels failed:", e2.message);
          }
          rows = (raw ?? []) as PixelRow[];
        }
      }

      if (!cancelled) fillFromRows(rows);

      // 3) Mark loaded and drain buffered events
      isLoadingRef.current = false;
      if (bufferRef.current.length) {
        const drained = bufferRef.current.splice(0, bufferRef.current.length);
        for (const r of drained) {
          const x = r.x | 0, y = r.y | 0;
          if (x < 0 || y < 0 || x >= GRID_WIDTH || y >= GRID_HEIGHT) continue;
          const color = (r.color ?? WHITE).toLowerCase();
          applyCell(x, y, isHex6(color) ? color : WHITE, r.username ?? null);
        }
      }

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanup = load();
    return () => {
      cancelled = true;
      // ensure we unsubscribe even if load early returns
      cleanup?.then?.(() => {});
    };
  }, []);

  // ===== place pixel =====
const handleClick = async (x: number, y: number) => {
  if (!canPlace) return;

  const normalized = normalizeHex(selectedColor);
  if (!normalized) {
    console.warn("Blocked invalid color:", selectedColor);
    return;
  }

  const prevColor = grid[y][x];
  const prevUser = gridUsernames[y][x];
  const placedBy = username || "Anonymous";

  // optimistic
  applyCell(x, y, normalized.toLowerCase(), placedBy);

  const { error } = await supabase.rpc("place_pixel", {
    p_x: x,
    p_y: y,
    p_color: normalized.toLowerCase(),
    p_username: placedBy,
    p_cooldown_seconds: import.meta.env.DEV ? 30 : 300,
  });

  if (error) {
    console.warn("RPC place_pixel error:", error);
    applyCell(x, y, prevColor, prevUser);
    return;
  }

  onPlaced?.({ x, y, color: normalized.toLowerCase(), username: placedBy });
};


  // ===== pinch + ctrl-wheel zoom (optional, safe to leave) =====
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const initialPinch = { d: 0 };
    const dist = (e: TouchEvent) => {
      const [a, b] = [e.touches[0], e.touches[1]];
      return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) initialPinch.d = dist(e);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialPinch.d > 0) {
        e.preventDefault();
        const dNow = dist(e);
        const delta = Math.pow(dNow / initialPinch.d, 0.85);
        onZoomDelta?.(delta);
        initialPinch.d = dNow;
      }
    };
    const onTouchEnd = () => (initialPinch.d = 0);
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      onZoomDelta?.(e.deltaY < 0 ? 1.05 : 0.95);
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

  // ===== render =====
  const cells = useMemo(
    () =>
      grid.flatMap((row, y) =>
        row.map((color, x) => (
          <div
            key={`${x}-${y}`}
            onClick={() => handleClick(x, y)}
            className="cursor-pointer"
            style={{ width: PIXEL_SIZE, height: PIXEL_SIZE, backgroundColor: color }}
            title={`(${x},${y}) — placed by ${gridUsernames[y][x] ?? "Unknown"}`}
          />
        ))
      ),
    [grid, gridUsernames]
  );

  return (
    <div
      className="rounded-lg border border-gray-300"
      style={{ width: "100%", maxWidth: 720, aspectRatio: `${GRID_WIDTH} / ${GRID_HEIGHT}` }}
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
}
