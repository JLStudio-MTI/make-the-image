// src/components/CanvasGrid.tsx
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export const GRID_WIDTH = 64;          // columns
export const GRID_HEIGHT = 40;         // rows
const PIXEL_SIZE = 10;                  // logical (unscaled) pixel size in px
const WHITE = "#ffffff";

type Props = {
  selectedColor: string;
  username: string;
  zoom: number;
  canPlace?: boolean;
  onPlaced?: (row: { x: number; y: number; color: string; username: string }) => void;
  onStats?: (stats: { nonWhite: number }) => void;
  onZoomDelta?: (delta: number) => void;  // 👈 NEW
};




type PixelRow = {
  x: number;
  y: number;
  color: string;
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
  onZoomDelta,            // 👈 add this
}: Props) => {

  // Local grid (DB-backed: initial load + realtime)
  const [grid, setGrid] = useState<string[][]>(
    Array.from({ length: GRID_HEIGHT }, () => Array(GRID_WIDTH).fill(WHITE))
  );

  // Parallel grid for usernames (who placed the latest color at each cell)
  const [gridUsernames, setGridUsernames] = useState<(string | null)[][]>(
    Array.from({ length: GRID_HEIGHT }, () => Array(GRID_WIDTH).fill(null))
  );

  // Track non-white cells for the "Revealed" counter
  const [, setNonWhite] = useState(0);
  const recountNonWhite = (g: string[][]) =>
    g.reduce(
      (sum, row) =>
        sum + row.reduce((s, c) => s + (c.toLowerCase() !== WHITE ? 1 : 0), 0),
      0
    );

  // Two layers:
  const outerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

// --- Pinch-to-zoom (mobile) ---
const initialPinch = useRef<{ d: number } | null>(null);

const pinchDistance = (e: TouchEvent) => {
  const t0 = e.touches[0], t1 = e.touches[1];
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
        const delta = dNow / d0;
        const eased = Math.pow(delta, 0.85);
        onZoomDelta?.(eased);  // 👈 no error now, prop is defined
        initialPinch.current.d = dNow;
      }
    }
  };

  const onTouchEnd = () => {
    initialPinch.current = null;
  };

  el.addEventListener("touchstart", onTouchStart as any, { passive: true });
  el.addEventListener("touchmove", onTouchMove as any, { passive: false });
  el.addEventListener("touchend", onTouchEnd as any);
  el.addEventListener("touchcancel", onTouchEnd as any);

  return () => {
    el.removeEventListener("touchstart", onTouchStart as any);
    el.removeEventListener("touchmove", onTouchMove as any);
    el.removeEventListener("touchend", onTouchEnd as any);
    el.removeEventListener("touchcancel", onTouchEnd as any);
  };
}, [onZoomDelta]);

  // Fit scale so whole canvas fills viewport at zoom=1
  const [fitScale, setFitScale] = useState(1);

  const baseWidth = GRID_WIDTH * PIXEL_SIZE;    // unscaled canvas width
  const baseHeight = GRID_HEIGHT * PIXEL_SIZE;  // unscaled canvas height

  // Recompute fit scale on resize/orientation + when zoom changes
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const recompute = () => {
      const cw = vp.clientWidth;
      const ch = vp.clientHeight;
      const nextFit = Math.min(cw / baseWidth, ch / baseHeight);
      setFitScale(nextFit);
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

  // Final scale and the scrollable content size
  const totalScale = fitScale * zoom;
  const scaledWidth = baseWidth * totalScale;
  const scaledHeight = baseHeight * totalScale;

  // Helper: set a single cell color (and optionally the "placed by" username)
  const setCell = (x: number, y: number, color: string, placedBy?: string | null) => {
    if (x < 0 || y < 0 || x >= GRID_WIDTH || y >= GRID_HEIGHT) return;

    setGrid((prev) =>
      prev.map((row, ry) =>
        row.map((c, rx) => (rx === x && ry === y ? color : c))
      )
    );

    if (placedBy !== undefined) {
      setGridUsernames((prev) =>
        prev.map((row, ry) =>
          row.map((u, rx) => (rx === x && ry === y ? placedBy : u))
        )
      );
    }
  };
  
  // Initial load (latest wins at each x,y)
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from("PixelDatabase")
        .select("x,y,color,username,timestamp")
        .order("timestamp", { ascending: true }); // oldest → newest

      if (error) {
        console.error("❌ Load pixels failed:", error.message);
        return;
      }
      if (!data || cancelled) return;

      const freshColors: string[][] = Array.from({ length: GRID_HEIGHT }, () =>
        Array(GRID_WIDTH).fill(WHITE)
      );
      const freshUsers: (string | null)[][] = Array.from(
        { length: GRID_HEIGHT },
        () => Array(GRID_WIDTH).fill(null)
      );

      for (const row of data as PixelRow[]) {
        if (row.x >= 0 && row.y >= 0 && row.x < GRID_WIDTH && row.y < GRID_HEIGHT) {
          const c = (row.color || WHITE).toLowerCase();
          freshColors[row.y][row.x] = c;
          freshUsers[row.y][row.x] = row.username ?? null;
        }
      }

      setGrid(freshColors);
      setGridUsernames(freshUsers);

      const count = recountNonWhite(freshColors);
      setNonWhite(count);
      onStats?.({ nonWhite: count });
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [onStats]);

  // Realtime inserts → update just that cell + maintain nonWhite
  useEffect(() => {
    const channel = supabase
      .channel("pixeldb-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "PixelDatabase" },
        (payload) => {
          const row = payload.new as PixelRow;
          const { x, y } = row;
          if (x < 0 || y < 0 || x >= GRID_WIDTH || y >= GRID_HEIGHT) return;

          setGrid((prev) => {
            const prevColor = prev[y][x].toLowerCase();
            const nextColor = (row.color || WHITE).toLowerCase();

            if (prevColor !== nextColor) {
              // adjust nonWhite count
              setNonWhite((nw) => {
                const wasNonWhite = prevColor !== WHITE;
                const isNonWhite = nextColor !== WHITE;
                let delta = 0;
                if (!wasNonWhite && isNonWhite) delta = +1;
                else if (wasNonWhite && !isNonWhite) delta = -1;
                const newCount = nw + delta;
                onStats?.({ nonWhite: newCount });
                return newCount;
              });
            }

            // apply cell color
            const copy = prev.map((r) => r.slice());
            copy[y][x] = nextColor;

            // mirror username grid
            setGridUsernames((prevUsers) => {
              const uCopy = prevUsers.map((r) => r.slice());
              uCopy[y][x] = row.username ?? null;
              return uCopy;
            });

            return copy;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onStats]);

  // Click handler: enforce canPlace, optimistic UI, DB insert, rollback on error
  const handleClick = async (x: number, y: number) => {
    if (!canPlace) return;

    const prevColor = grid[y][x];
    const prevUser = gridUsernames[y][x];
    const nextColor = selectedColor.toLowerCase();
    const placedBy = username || "Anonymous";

    // Optimistic update
    setCell(x, y, nextColor, placedBy);

// BEFORE:
// const { error } = await supabase.from("PixelDatabase").insert([{ x, y, color: nextColor, username: placedBy }]);

// AFTER (server-checked):
const { error } = await supabase.rpc("place_pixel", {
  p_x: x,
  p_y: y,
  p_color: nextColor,
  p_username: placedBy,
  p_cooldown_seconds: import.meta.env.DEV ? 30 : 300, // 30s dev, 5m prod
});

if (error) {
  if (error.message?.includes("COOLDOWN_ACTIVE")) {
    // rollback optimistic update & surface a friendly message if you want
    setCell(x, y, prevColor, prevUser);
    console.warn("Cooldown active (server blocked).");
  } else {
    setCell(x, y, prevColor, prevUser);
    console.error("❌ RPC error:", error.message);
  }
  return;
}


    // Success → let parent start cooldown & bump personal counter
    onPlaced?.({ x, y, color: nextColor, username: placedBy });
  };

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
        style={{
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-x pan-y",
        }}
      >
        {/* Sizer = scaled canvas size => scroll bounds stop exactly at bottom-right */}
        <div style={{ width: scaledWidth, height: scaledHeight }}>
          {/* Real canvas at base size, scaled visually to totalScale */}
          <div
            className="origin-top-left transition-transform"
            style={{
              transform: `scale(${totalScale})`,
              transformOrigin: "top left",
              width: baseWidth,
              height: baseHeight,
            }}
          >
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${GRID_WIDTH}, ${PIXEL_SIZE}px)`,
              }}
            >
              {grid.flatMap((row, y) =>
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
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CanvasGrid;
