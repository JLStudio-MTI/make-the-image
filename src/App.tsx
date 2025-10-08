// src/App.tsx
import { useEffect, useState } from "react";
import CanvasGrid, { GRID_WIDTH, GRID_HEIGHT } from "./components/CanvasGrid";
import ColorPalette from "./components/ColorPalette";
import Header from "./components/Header";
import Leaderboard from "./components/Leaderboard";
import { useToast } from "./components/ui/Toaster";
import { ensureAnonSignIn, db } from "./lib/firebaseClient";
import { ref, child, get, update, onValue } from "firebase/database";



const COOLDOWN_MS = import.meta.env.DEV ? 30_000 : 5 * 60_000; // 30s dev, 5m prod
const LS_USERNAME = "pp_username";
const LS_LAST_PLACED_AT = "pp_lastPlacedAt";
const LS_SELECTED_COLOR = "pp_selected_color";



/** Canonical color: #rrggbb lowercase */
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
const usernameRegex = /^[A-Za-z0-9_]{3,16}$/;

function UsernameModal({
  defaultName = "",
  onSave,
}: {
  defaultName?: string;
  onSave: (name: string) => void;
}) {
  const [value, setValue] = useState(defaultName);
  const isValid = usernameRegex.test(value.trim());
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="mb-2 text-xl font-bold">Pick your permanent username</h2>
        <p className="mb-3 text-sm text-gray-600">No email, no sign in—just a name.</p>

        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. PixelWizard_15"
          className={`w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 ${
            isValid ? "border-gray-300 focus:ring-blue-500" : "border-red-300 focus:ring-red-400"
          }`}
        />

        {!isValid && (
          <div className="mt-2 text-xs text-red-600">
            Use 3–16 characters (letters, numbers, underscore).
          </div>
        )}

        <button
          disabled={!isValid}
          onClick={() => onSave(value.trim())}
          className={`mt-4 w-full rounded-lg px-4 py-2 font-semibold text-white transition ${
            isValid ? "bg-blue-600 hover:bg-blue-700 active:scale-[0.99]" : "bg-gray-300 cursor-not-allowed"
          }`}
        >
          Save username
        </button>
      </div>
    </div>
  );
}

/** Reconcile LS username with Firebase (claim if free or adopt server value). */

function App() {
  const { push } = useToast();


  const [uid, setUid] = useState<string | null>(null);


  // Selected color (persisted)
  const [selectedColor, _setSelectedColor] = useState("#000000");
  const setSelectedColor = (c: string) => {
    const v = toHex6Lower(c) ?? "#000000";
    _setSelectedColor(v);
    localStorage.setItem(LS_SELECTED_COLOR, v);
  };

  // Username
  const [username, setUsername] = useState<string | null>(null);
  const [needsUsername, setNeedsUsername] = useState(false);

  // Cooldown UI
  const [now, setNow] = useState(() => Date.now());
  const [lastPlacedAt, setLastPlacedAt] = useState<number>(() => {
    const raw = localStorage.getItem(LS_LAST_PLACED_AT);
    return raw ? parseInt(raw, 10) : 0;
  });

  // Stats
  const totalCells = GRID_WIDTH * GRID_HEIGHT;
  const [nonWhite, setNonWhite] = useState(0);
  const [myPlaced, setMyPlaced] = useState(0);

  // Zoom
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 4;
  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
  const [zoom, setZoom] = useState(1);
  const zoomIn  = () => setZoom((z) => clamp(z + 0.5, MIN_ZOOM, MAX_ZOOM));
  const zoomOut = () => setZoom((z) => clamp(z - 0.5, MIN_ZOOM, MAX_ZOOM));
  const handleZoomDelta = (delta: number) => setZoom(z => clamp(z * delta, MIN_ZOOM, MAX_ZOOM));
//boot
useEffect(() => {
  let unsub: (() => void) | undefined;

  (async () => {
    const user = await ensureAnonSignIn();
    const uidNow: string = user.uid;   // <- local, typed
    setUid(uidNow);

    const profRef = child(ref(db), `profiles/${uidNow}`);
    const profSnap = await get(profRef);
    const serverName = profSnap.child("username").val();

    if (typeof serverName === "string" && serverName) {
      setUsername(serverName);
      setNeedsUsername(false);
      localStorage.setItem(LS_USERNAME, serverName);
    } else {
      const localName = localStorage.getItem(LS_USERNAME);
      if (localName && /^[A-Za-z0-9_]{3,16}$/.test(localName)) {
        try {
          await update(ref(db), {
            [`/usernames/${localName}`]: uidNow,
            [`/profiles/${uidNow}/username`]: localName,
          });
          setUsername(localName);
          setNeedsUsername(false);
        } catch {
          setNeedsUsername(true);
        }
      } else {
        setNeedsUsername(true);
      }
    }

    unsub = onValue(child(ref(db), `profiles/${uidNow}/username`), (snap) => {
      const val = snap.val();
      if (typeof val === "string" && val) {
        setUsername(val);
        localStorage.setItem(LS_USERNAME, val);
        setNeedsUsername(false);
      }
    });
  })();

  return () => { if (unsub) unsub(); };
}, []);


  // Ticker for cooldown UI
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200); // slightly faster for smoother countdown
    return () => clearInterval(id);
  }, []);

  const msRemaining = Math.max(0, lastPlacedAt + COOLDOWN_MS - now);
  const canPlace = (!!uid && !!username) && msRemaining <= 0;


  const formatTime = (ms: number) => {
    const total = Math.ceil(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Save username in Firebase (claim name + save to profile)
  const handleSaveUsername = async (name: string) => {
    if (!uid) return;
    const clean = name.trim();
    if (!usernameRegex.test(clean)) {
      push({ type: "error", title: "Invalid username", description: "Use 3–16 characters.", duration: 2500 });
      return;
    }
    try {
      await update(ref(db), {
        [`/usernames/${clean}`]: uid,
        [`/profiles/${uid}/username`]: clean,
      });
      localStorage.setItem(LS_USERNAME, clean);
      setUsername(clean);
      setNeedsUsername(false);
      push({ type: "success", title: "Username saved", description: `Welcome, ${clean}!`, duration: 2000 });
    } catch (e) {
      push({ type: "error", title: "Username taken", description: "Please choose another.", duration: 2500 });
    }
  };

  // Called after a pixel is stored
  const handlePlaced = () => {
    const ts = Date.now();
    localStorage.setItem(LS_LAST_PLACED_AT, String(ts));
    setLastPlacedAt(ts);
    setMyPlaced((n) => n + 1);
  };

  return (
    <div className="font-sans bg-[#f9f9f9] min-h-screen flex flex-col">
      <Header />

      {/* Simple hero */}
      <div className="mx-auto mt-3 w-full max-w-5xl px-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="text-center sm:text-left">
              <div className="text-[13px] uppercase tracking-wide text-gray-500">Pixels revealed</div>
              <div className="text-3xl sm:text-4xl font-extrabold text-gray-900">
                {nonWhite.toLocaleString()} <span className="text-gray-400">/ {totalCells.toLocaleString()}</span>
              </div>
            </div>
            <div className="w-full sm:w-1/2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${Math.min(100, (nonWhite / totalCells) * 100)}%` }}
                />
              </div>
              <div className="mt-1 text-right text-xs text-gray-500">
                {((nonWhite / totalCells) * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm text-blue-700">
              Your pixels: <span className="font-semibold">{myPlaced.toLocaleString()}</span>
            </div>
            <div
              className={`rounded-lg px-3 py-1.5 text-sm shadow-sm ${
                canPlace
                  ? "border border-green-200 bg-green-50 text-green-700"
                  : "border border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              Next pixel in: {username ? (canPlace ? "Ready" : formatTime(msRemaining)) : "Pick a username"}
            </div>
          </div>
        </div>
      </div>

      <main className="flex flex-col lg:flex-row flex-1 justify-center items-start gap-6 p-4">
        <div className="bg-white shadow-xl rounded-xl p-4 sm:p-6 border border-gray-200 w-full lg:max-w-[720px]">
          <div className="mb-4 flex flex-col items-center gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-2 py-1 shadow-sm">
              <button onClick={zoomOut} className="h-8 w-8 rounded-full bg-white text-gray-700 shadow hover:bg-gray-100 active:scale-95" aria-label="Zoom out">–</button>
              <span className="px-2 text-sm text-gray-700">Zoom: {zoom.toFixed(2)}x</span>
              <button onClick={zoomIn} className="h-8 w-8 rounded-full bg-white text-gray-700 shadow hover:bg-gray-100 active:scale-95" aria-label="Zoom in">+</button>
            </div>
            {username && (
              <span className="sm:ml-auto text-sm text-gray-500">
                Signed in as <span className="font-semibold">{username}</span>
              </span>
            )}
          </div>

          <div className="relative">
            {(!uid || !username || msRemaining > 0) && (
              <div className="absolute inset-0 z-10 grid place-items-center rounded-lg bg-white/60 backdrop-blur-[2px] pointer-events-none">
                <div className="rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 shadow">
                  {!uid ? "Connecting…" : !username ? "Pick a username to start" : `Cooling down… ${formatTime(msRemaining)}`}
                </div>
              </div>
            )}

{/* click-through blocker */}
<div className={(!uid || !username || msRemaining > 0) ? "pointer-events-none" : ""}>


              <CanvasGrid
                selectedColor={selectedColor}
                username={username ?? "Anonymous"}
                uid={uid}                 // <-- keep this
                zoom={zoom}
                canPlace={canPlace}
                onPlaced={handlePlaced}
                onStats={({ nonWhite }) => setNonWhite(nonWhite)}
                onZoomDelta={handleZoomDelta}
              />


            </div>
          </div>

          {/* Palette + current color chip */}
          <div className="mt-4">
            <div className="mb-2 text-xs text-gray-500">
              Current color: <span className="font-mono">{selectedColor}</span>
              <span className="inline-block ml-2 h-3 w-3 rounded" style={{ backgroundColor: selectedColor }} />
            </div>
            <div className="overflow-x-auto pb-2">
              <ColorPalette selectedColor={selectedColor} setSelectedColor={setSelectedColor} />
            </div>
          </div>
        </div>

        <div className="w-full lg:w-[260px]">
          <Leaderboard currentUsername={username ?? undefined} />
        </div>
      </main>

      <footer className="text-center py-4 text-gray-500 text-sm">
        <div>Made by JLStudios "guess__the_image"</div>
        <div className="mt-1 space-x-3">
          <a className="underline hover:text-gray-700" href="/privacy.html" target="_blank" rel="noreferrer">Privacy</a>
          <a className="underline hover:text-gray-700" href="/terms.html" target="_blank" rel="noreferrer">Terms</a>
          <a className="underline hover:text-gray-700" href="/about.html" target="_blank" rel="noreferrer">About</a>
        </div>
      </footer>

      {needsUsername && <UsernameModal onSave={handleSaveUsername} />}
    </div>
  );
}

export default App;
