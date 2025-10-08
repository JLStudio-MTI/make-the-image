import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  selectedColor: string;
  setSelectedColor: (color: string) => void; // expects #rrggbb lower
};

const LS_RECENT_COLORS = "pp_recent_colors";

/** Canonical color: #rrggbb lower */
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
const isHex6Lower = (v: string) => /^#[0-9a-f]{6}$/.test(v);

// Vibrant base palette
const RAW = [
  "#000000","#FFFFFF","#FF0000","#FF7F00","#FFD700",
  "#22C55E","#00CED1","#1E90FF","#7C3AED","#FF2D55",
  "#8B4513","#6B7280",
  "#BE0039","#DC2626","#EF4444","#F87171",
  "#FF6B00","#FF7F50","#FB923C","#FFA500",
  "#FACC15","#FFE34D","#FFF176",
  "#006400","#16A34A","#34C759","#00CC78","#4ADE80",
  "#0D9488","#14B8A6","#2DD4BF","#5AC8FA",
  "#1E3A8A","#2563EB","#3B82F6","#30B0FF","#4169E1","#3690EA",
  "#6D28D9","#7C3AED","#8A2BE2","#AF52DE","#A855F7",
  "#EC4899","#FF69B4","#FF3881","#FF99AA",
  "#6D482F","#9C6926","#8B5A2B","#A0522D","#C08457",
  "#1F2937","#374151","#6B7280","#9CA3AF","#D1D5DB",
  "#ADFF2F","#7FFF00","#00FF7F","#00FFFF","#FF00FF"
];
const BASE_COLORS = Array.from(new Set(RAW.map(toHex6Lower).filter((c): c is string => !!c)));

const TILE = 48;
const PANEL_W = 260;

export default function ColorPalette({ selectedColor, setSelectedColor }: Props) {
  const [recents, setRecents] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [draft, setDraft] = useState<string>(toHex6Lower(selectedColor) ?? "#000000");
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });

  const anchorRef = useRef<HTMLButtonElement>(null);
  const portalRoot = typeof document !== "undefined" ? document.body : null;

  // Recents
  useEffect(() => {
    const raw = localStorage.getItem(LS_RECENT_COLORS);
    if (!raw) return;
    try {
      const arr = JSON.parse(raw) as string[];
      if (Array.isArray(arr)) {
        const cleaned = arr.map(toHex6Lower).filter((c): c is string => !!c);
        setRecents(cleaned.slice(0, 12));
      }
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem(LS_RECENT_COLORS, JSON.stringify(recents));
  }, [recents]);

  const pushRecent = (hex: string) => {
    const c = toHex6Lower(hex);
    if (!c) return;
    setRecents(prev => [c, ...prev.filter(x => x !== c)].slice(0, 12));
  };

  const swatches = useMemo(() => {
    const rec = recents.filter(c => !BASE_COLORS.includes(c));
    return [...rec, ...BASE_COLORS];
  }, [recents]);

  // Picker positioning
  const positionPicker = () => {
    const btn = anchorRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const left = Math.max(8, Math.min(window.innerWidth - PANEL_W - 8, r.left));
    const top = Math.min(window.innerHeight - 220, r.bottom + 8);
    setPos({ left, top });
  };
  const openPicker = () => {
    setDraft(toHex6Lower(selectedColor) ?? "#000000");
    positionPicker();
    setShowPicker(true);
  };
  useEffect(() => {
    if (!showPicker) return;
    const onScroll = () => positionPicker();
    const onResize = () => positionPicker();
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t)) return;
      setShowPicker(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    document.addEventListener("mousedown", onDocClick);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("mousedown", onDocClick);
    };
  }, [showPicker]);

  const confirmDraft = () => {
    const v = toHex6Lower(draft);
    if (v) {
      setSelectedColor(v);
      pushRecent(v);
    }
    setShowPicker(false);
  };

  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Colors</span>
        <button
          type="button"
          ref={anchorRef}
          onClick={openPicker}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 active:scale-95"
          aria-label="Open custom color picker"
          title="Add a custom color"
        >
          + Custom
        </button>
      </div>

      <div
        className="rounded-lg border border-gray-200 bg-white p-2 shadow-sm overflow-x-auto lg:overflow-visible"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div
          className="grid gap-2 lg:grid-cols-16 lg:auto-rows-[48px]"
          style={{
            gridAutoFlow: "column",
            gridTemplateRows: `repeat(3, ${TILE}px)`,
            gridAutoColumns: `${TILE}px`,
          }}
        >
          {swatches.map((color) => {
            const canonical = toHex6Lower(color)!;
            const isSelected = (toHex6Lower(selectedColor) ?? "") === canonical;
            return (
              <button
                type="button"
                key={canonical}
                onPointerDown={(e) => {
                  e.preventDefault(); // commit before a subsequent click on the grid
                  setSelectedColor(canonical);
                  pushRecent(canonical);
                }}
                className={`
                  rounded-md border-2 transition
                  ${isSelected ? "border-black ring-2 ring-blue-500 scale-105" : "border-gray-300 hover:border-gray-400"}
                  active:scale-95
                `}
                style={{ width: TILE, height: TILE, backgroundColor: canonical }}
                aria-label={`Select ${canonical}`}
                title={canonical}
              />
            );
          })}
        </div>
      </div>

      {showPicker && portalRoot &&
        createPortal(
          <div
            className="z-[9999] fixed rounded-xl border border-gray-200 bg-white p-3 shadow-2xl"
            style={{ left: pos.left, top: pos.top, width: PANEL_W }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={toHex6Lower(draft) ?? "#000000"}
                onInput={(e) => {
                  const raw = (e.target as HTMLInputElement).value;
                  const n = toHex6Lower(raw);
                  if (n) setDraft(n);
                }}
                className="h-10 w-10 cursor-pointer"
                aria-label="Color picker"
              />
              <input
                value={draft}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraft(toHex6Lower(v) ?? v);
                }}
                placeholder="#rrggbb"
                className="w-28 rounded-md border border-gray-300 px-2 py-1 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div
                className="h-8 w-8 rounded-md border"
                style={{ backgroundColor: toHex6Lower(draft) ?? "#fff" }}
                title="Preview"
              />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPicker(false)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDraft}
                disabled={!isHex6Lower(toHex6Lower(draft) ?? "")}
                className={`rounded-md px-3 py-1.5 text-sm text-white ${
                  isHex6Lower(toHex6Lower(draft) ?? "")
                    ? "bg-blue-600 hover:bg-blue-700 active:scale-95"
                    : "bg-gray-300 cursor-not-allowed"
                }`}
              >
                Use color
              </button>
            </div>
          </div>,
          portalRoot
        )}
    </div>
  );
}
