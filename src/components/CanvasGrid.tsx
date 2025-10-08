// src/components/CanvasGrid.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../lib/firebaseClient";
import { ref, onValue, update } from "firebase/database";

export const GRID_WIDTH = 64;
export const GRID_HEIGHT = 40;
const PIXEL_SIZE = 10;
const WHITE = "#ffffff";

type Props = {
  selectedColor: string;           // #rrggbb (lowercase ok)
  username: string;                // validated in App
  uid: string | null;              // Firebase uid (null until anon sign-in completes)
  zoom: number;
  canPlace?: boolean;
  onPlaced?: (row: { x: number; y: number; color: string; username: string }) => void;
  onStats?: (stats: { nonWhite: number }) => void;
  onZoomDelta?: (delta: number) => void;
};

type PixelCell = { color: string; username?: string; ts?: number; uid?: string } | null;

/** strict #rrggbb lower */
const isHex6Lower = (v: string) => /^#[0-9a-f]{6}$/.test(v);
const toHex6Lower = (v: string): string | null => {
  if (!v) return null;
  let s = v.trim();
  if (!s.startsWith("#")) s = "#" + s;
  if (/^#[0-9a-f]{3}$/i.test(s)) {
    const r = s[1], g = s[2], b = s[3];
    s = `#${r}${r}${g}${g}${b}${b}`;
  }
  if (!/^#[0-9a-f]{6}$/i.test(s)) return null;
  return s.toLowerCase();
};

export default function CanvasGrid({
  selectedColor,
  username,
  uid,
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

  // recompute revealed count from grid
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

  // ===== live load (Firebase) =====
  useEffect(() => {
    // Subscribe to /pixels and build a full 64x40 grid from it
    const off = onValue(ref(db, "pixels"), (snap) => {
      // fresh buffers
      const colors: string[][] = Array.from({ length: GRID_HEIGHT }, () =>
        Array(GRID_WIDTH).fill(WHITE)
      );
      const users: (string | null)[][] = Array.from({ length: GRID_HEIGHT }, () =>
        Array(GRID_WIDTH).fill(null)
      );

      const all = snap.val() as Record<string, Record<string, PixelCell>> | null;
      if (all) {
        // all[y][x] = { color, username, ts }
        for (let y = 0; y < GRID_HEIGHT; y++) {
          const row = all[y] as Record<string, PixelCell> | undefined;
          if (!row) continue;
          for (let x = 0; x < GRID_WIDTH; x++) {
            const cell = row[x] as PixelCell;
            const c = cell?.color ?? WHITE;
            const n = typeof cell?.username === "string" ? cell!.username! : null;
            colors[y][x] = isHex6Lower(c) ? c : WHITE;
            users[y][x] = n;
          }
        }
      }

      setGrid(colors);
      setGridUsernames(users);
    });

    return () => off();
  }, []);

  // ===== place pixel =====
  const handleClick = async (x: number, y: number) => {
    if (!canPlace) return;
    if (!uid || !username) {
      console.warn("Blocked: missing uid/username");
      return;
    }

    const normalized = toHex6Lower(selectedColor);
    if (!normalized) {
      console.warn("Blocked invalid color:", selectedColor);
      return;
    }

    // optimistic update
    setGrid((prev) =>
      prev.map((row, ry) => row.map((c, rx) => (rx === x && ry === y ? normalized : c)))
    );
    setGridUsernames((prev) =>
      prev.map((row, ry) => row.map((u, rx) => (rx === x && ry === y ? username : u)))
    );

    try {
      await update(ref(db), {
        [`pixels/${y}/${x}`]: {
          color: normalized,
          username,
          uid,
          ts: Date.now(),
        },
      });
      onPlaced?.({ x, y, color: normalized, username });
    } catch (e) {
      console.warn("Firebase update failed:", e);
      // best-effort rollback (reload will sync anyway)
      setGrid((prev) =>
        prev.map((row, ry) => row.map((c, rx) => (rx === x && ry === y ? WHITE : c)))
      );
      setGridUsernames((prev) =>
        prev.map((row, ry) => row.map((u, rx) => (rx === x && ry === y ? null : u)))
      );
    }
  };

  // ===== pinch + ctrl-wheel zoom (optional) =====
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const pinch = { d: 0 };
    const dist = (e: TouchEvent) => {
      const [a, b] = [e.touches[0], e.touches[1]];
      return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) pinch.d = dist(e);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinch.d > 0) {
        e.preventDefault();
        const dNow = dist(e);
        const delta = Math.pow(dNow / pinch.d, 0.85);
        onZoomDelta?.(delta);
        pinch.d = dNow;
      }
    };
    const onTouchEnd = () => (pinch.d = 0);
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

  // ===== render cells =====
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
