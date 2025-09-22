import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  selectedColor: string;
  setSelectedColor: (color: string) => void; // expects #RRGGBB uppercase
};

const LS_RECENT_COLORS = "pp_recent_colors";

// Normalize helpers
const isHex = (v: string) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);
const toHex6Upper = (v: string): string | null => {
  if (!v) return null;
  let s = v.trim();
  if (!s.startsWith("#")) s = "#" + s;
  if (!isHex(s)) return null;
  if (s.length === 4) {
    const r = s[1], g = s[2], b = s[3];
    s = `#${r}${r}${g}${g}${b}${b}`;
  }
  return s.toUpperCase();
};
const isHex6Upper = (v: string) => /^#[0-9A-F]{6}$/.test(v);

// --- BIG, VIBRANT PALETTE (no rgba entries, all #RRGGBB) ---
const BASE_COLORS_RAW = [
  // “important” up front
  "#000000", "#FFFFFF", "#FF0000", "#FF7F00", "#FFD700",
  "#22C55E", "#00CED1", "#1E90FF", "#7C3AED", "#FF2D55",
  "#8B4513", "#6B7280",

  // reds → oranges → yellows
  "#BE0039", "#DC2626", "#EF4444", "#F87171",
  "#FF6B00", "#FF7F50", "#FB923C", "#FFA500",
  "#FACC15", "#FFE34D", "#FFF176",

  // greens → teals/cyans
  "#006400", "#16A34A", "#34C759", "#00CC78", "#4ADE80",
  "#0D9488", "#14B8A6", "#2DD4BF", "#5AC8FA",

  // blues
  "#1E3A8A", "#2563EB", "#3B82F6", "#30B0FF", "#4169E1", "#3690EA",

  // purples
  "#6D28D9", "#7C3AED", "#8A2BE2", "#AF52DE", "#A855F7",

  // pinks
  "#EC4899", "#FF69B4", "#FF3881", "#FF99AA",

  // browns / earth
  "#6D482F", "#9C6926", "#8B5A2B", "#A0522D", "#C08457",

  // neutrals
  "#1F2937", "#374151", "#6B7280", "#9CA3AF", "#D1D5DB",

  // vivid pops
  "#ADFF2F", "#7FFF00", "#00FF7F", "#00FFFF", "#FF00FF"
];

// sanitize palette → #RRGGBB uppercase unique
const BASE_COLORS = Array.from(
  new Set(
    BASE_COLORS_RAW
      .map(toHex6Upper)
      .filter((c): c is string => !!c)
  )
);

const TILE = 48;      // bigger tap targets
const PANEL_W = 260;  // custom picker popover width

export default function ColorPalette({ selectedColor, setSelectedColor }: Props) {
  const [recents, setRecents] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [draft, setDraft] = useState<string>(selectedColor);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });

  const anchorRef = useRef<HTMLButtonElement>(null);
  const portalRoot = typeof document !== "undefined" ? document.body : null;

  // Recents (load + persist)
  useEffect(() => {
    const raw = localStorage.getItem(LS_RECENT_COLORS);
    if (!raw) return;
    try {
      const arr = JSON.parse(raw) as string[];
      if (Array.isArray(arr)) {
        const cleaned = arr.map(toHex6Upper).filter((c): c is string => !!c);
        setRecents(cleaned.slice(0, 12));
      }
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem(LS_RECENT_COLORS, JSON.stringify(recents));
  }, [recents]);

  const pushRecent = (hex: string) => {
    const c = toHex6Upper(hex);
    if (!c) return;
    setRecents((prev) => {
      const withNew = [c, ...prev.filter((x) => x !== c)];
      return withNew.slice(0, 12);
    });
  };

  // Merge: recents first (that aren’t already in base), then base
  const swatches = useMemo(() => {
    const rec = recents.filter((c) => !BASE_COLORS.includes(c));
    return [...rec, ...BASE_COLORS];
  }, [recents]);

  // Picker positioning (portal)
  const positionPicker = () => {
    const btn = anchorRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const left = Math.max(8, Math.min(window.innerWidth - PANEL_W - 8, r.left));
    const top = Math.min(window.innerHeight - 220, r.bottom + 8);
    setPos({ left, top });
  };
  const openPicker = () => {
    const n = toHex6Upper(selectedColor) ?? "#000000";
    setDraft(n);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPicker]);

  const confirmDraft = () => {
    const v = toHex6Upper(draft);
    if (v) {
      setSelectedColor(v);
      pushRecent(v);
    }
    setShowPicker(false);
  };

  return (
    <div className="mt-3">
      {/* label + custom picker button (keeps grid fully visible) */}
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

      {/* Mobile: 3-row horizontal scroll; Desktop: wrap grid */}
      <div
        className="rounded-lg border border-gray-200 bg-white p-2 shadow-sm overflow-x-auto lg:overflow-visible"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div
          className="
            grid gap-2
            lg:grid-cols-16 lg:auto-rows-[48px]
          "
          style={{
            gridAutoFlow: "column",
            gridTemplateRows: `repeat(3, ${TILE}px)`,
            gridAutoColumns: `${TILE}px`,
          }}
        >
          {swatches.map((color) => {
            const isSelected = (toHex6Upper(selectedColor) ?? "") === color;
            return (
              <button
                type="button"
                key={color}
                onClick={() => {
                  const n = toHex6Upper(color);
                  if (n) {
                    setSelectedColor(n);
                    pushRecent(n);
                  }
                }}
                className={`
                  rounded-md border-2 transition
                  ${isSelected ? "border-black ring-2 ring-blue-500 scale-105" : "border-gray-300 hover:border-gray-400"}
                  active:scale-95
                `}
                style={{ width: TILE, height: TILE, backgroundColor: color }}
                aria-label={`Select ${color}`}
                title={color}
              />
            );
          })}
        </div>
      </div>

      {/* Picker popover (portal) */}
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
                value={toHex6Upper(draft) ?? "#000000"}
                onInput={(e) => {
                  const raw = (e.target as HTMLInputElement).value;
                  const n = toHex6Upper(raw);
                  if (n) setDraft(n);
                }}
                className="h-10 w-10 cursor-pointer"
                aria-label="Color picker"
              />
              <input
                value={draft}
                onChange={(e) => setDraft((toHex6Upper(e.target.value) ?? e.target.value).toUpperCase())}
                placeholder="#RRGGBB"
                className="w-28 rounded-md border border-gray-300 px-2 py-1 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div
                className="h-8 w-8 rounded-md border"
                style={{ backgroundColor: toHex6Upper(draft) ?? "#fff" }}
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
                disabled={!isHex6Upper(toHex6Upper(draft) ?? "")}
                className={`rounded-md px-3 py-1.5 text-sm text-white ${
                  isHex6Upper(toHex6Upper(draft) ?? "")
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
