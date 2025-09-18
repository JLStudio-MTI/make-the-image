import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  selectedColor: string;
  setSelectedColor: (color: string) => void;
};

const LS_RECENT_COLORS = "pp_recentColors";

const BASE_COLORS = [
  "#000000", "#FFFFFF", "#FF4500", "#FFA800",
  "#FFD635", "#00A368", "#7EED56", "#2450A4",
  "#3690EA", "#51E9F4", "#811E9F", "#B44AC0",
  "#FF99AA", "#9C6926", "#6D001A", "#BE0039",
  "#FFB470", "#00CC78", "#493AC1", "#6D482F",
  "#94B3FF", "#00CCC0", "#FF3881", "#808080"
];

const PANEL_W = 260; // px (used to keep it onscreen)

function isHexColor(v: string) {
  return /^#([0-9a-fA-F]{6})$/.test(v);
}

export default function ColorPalette({ selectedColor, setSelectedColor }: Props) {
  const [recents, setRecents] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [draft, setDraft] = useState<string>(selectedColor);
  const [pos, setPos] = useState<{left: number; top: number}>({ left: 0, top: 0 });
  const anchorRef = useRef<HTMLButtonElement>(null);
  const portalRoot = typeof document !== "undefined" ? document.body : null;

  // Load + persist recents
  useEffect(() => {
    const raw = localStorage.getItem(LS_RECENT_COLORS);
    if (raw) {
      try {
        const arr = JSON.parse(raw) as string[];
        if (Array.isArray(arr)) setRecents(arr.filter(isHexColor));
      } catch {}
    }
  }, []);
  useEffect(() => {
    localStorage.setItem(LS_RECENT_COLORS, JSON.stringify(recents));
  }, [recents]);

  const pushRecent = (hex: string) => {
    const c = hex.toUpperCase();
    if (!isHexColor(c)) return;
    setRecents((prev) => {
      const withNew = [c, ...prev.filter((x) => x.toUpperCase() !== c)];
      return withNew.slice(0, 6);
    });
  };

  const swatches = useMemo(() => {
    const rec = recents.filter((c) => !BASE_COLORS.includes(c.toUpperCase()));
    return [...rec, ...BASE_COLORS];
  }, [recents]);

  // Compute fixed position for the portal panel (so it isn't clipped by overflow)
  const positionPicker = () => {
    const btn = anchorRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const gap = 8;
    const left = Math.max(8, Math.min(window.innerWidth - PANEL_W - 8, r.left));
    const top = Math.min(window.innerHeight - 200, r.bottom + gap); // keep on-screen
    setPos({ left, top });
  };

  // Open picker near "+" and listen for scroll/resize to keep it anchored
  const openPicker = () => {
    setDraft(selectedColor.toUpperCase());
    positionPicker();
    setShowPicker(true);
  };
  useEffect(() => {
    if (!showPicker) return;
    const onScroll = () => positionPicker();
    const onResize = () => positionPicker();
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t)) return; // ignore clicks on the button itself
      // close on outside click; panel itself will stopPropagation below
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
    const v = draft.toUpperCase();
    if (isHexColor(v)) {
      setSelectedColor(v);
      pushRecent(v);
    }
    setShowPicker(false);
  };

  return (
    <div className="relative flex flex-col gap-2">
      <div className="flex gap-2 border-t pt-4 overflow-x-auto lg:overflow-visible lg:flex-wrap scrollbar-hide">
        {/* "+" opens portal popover (no native picker in-flow) */}
        <button
          type="button"
          ref={anchorRef}
          onClick={openPicker}
          className="
            min-w-[38px] min-h-[38px]
            grid place-items-center
            rounded-md border-2 border-dashed border-gray-300
            text-gray-500 text-lg font-bold
            hover:border-gray-400 active:scale-95
          "
          aria-label="Choose custom color"
          title="Choose custom color"
        >
          +
        </button>

        {/* Recent colors + base palette */}
        {swatches.map((color) => {
          const isSelected = selectedColor.toUpperCase() === color.toUpperCase();
          return (
            <button
              type="button"
              key={color}
              onClick={() => setSelectedColor(color.toUpperCase())}
              className={`
                min-w-[38px] min-h-[38px] rounded-md border-2 transition
                ${isSelected ? "border-black scale-110" : "border-gray-300 hover:border-gray-400"}
              `}
              style={{ backgroundColor: color }}
              aria-label={`Select ${color}`}
              title={color}
            />
          );
        })}
      </div>

      {/* Portal popover (fixed, above everything; no clipping) */}
      {showPicker && portalRoot &&
        createPortal(
          <div
            className="z-[9999] fixed rounded-xl border border-gray-200 bg-white p-3 shadow-2xl"
            style={{ left: pos.left, top: pos.top, width: PANEL_W }}
            onMouseDown={(e) => e.stopPropagation()} // keep click-away handler from closing instantly
          >
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={isHexColor(draft) ? draft : "#000000"}
                onInput={(e) =>
                  setDraft((e.target as HTMLInputElement).value.toUpperCase())
                }
                className="h-10 w-10 cursor-pointer"
                aria-label="Color picker"
              />
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value.toUpperCase())}
                placeholder="#RRGGBB"
                className="w-28 rounded-md border border-gray-300 px-2 py-1 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div
                className="h-8 w-8 rounded-md border"
                style={{ backgroundColor: isHexColor(draft) ? draft : "#fff" }}
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
                disabled={!isHexColor(draft)}
                className={`rounded-md px-3 py-1.5 text-sm text-white ${
                  isHexColor(draft)
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
