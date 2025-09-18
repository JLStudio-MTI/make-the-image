import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Row = { username: string; pixels: number };

export default function Leaderboard({ currentUsername }: { currentUsername?: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("leaderboard_view")
      .select("*")
      .order("pixels", { ascending: false })
      .limit(10)
      .returns<Row[]>();

    if (error) {
      console.error("Leaderboard load error:", error);
    } else if (data) {
      setRows(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await load();
      if (cancelled) return;

      // realtime: bump counts for existing users; periodic refresh handles newcomers
      const channel = supabase
        .channel("lb-inserts")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "PixelDatabase" },
          (payload) => {
            const u = (payload.new as any)?.username ?? null;
            if (!u) return;
            setRows((prev) => {
              const i = prev.findIndex((r) => r.username === u);
              if (i === -1) return prev; // new entrant handled by refresh
              const copy = prev.slice();
              copy[i] = { ...copy[i], pixels: copy[i].pixels + 1 };
              copy.sort((a, b) => b.pixels - a.pixels);
              return copy.slice(0, 10);
            });
          }
        )
        .subscribe();

      const id = setInterval(load, 30_000); // catch new entrants to top 10

      return () => {
        supabase.removeChannel(channel);
        clearInterval(id);
      };
    })();

    return () => { cancelled = true; };
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-md p-4 w-full">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-bold">Leaderboard</h2>
        {!loading && <span className="text-xs text-gray-500">Top 10 by total pixels</span>}
      </div>

      {loading ? (
        <ul className="animate-pulse space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="h-6 rounded bg-gray-100" />
          ))}
        </ul>
      ) : (
        <ul className="divide-y">
          {rows.map((r, idx) => {
            const rank = idx + 1;
            const you = currentUsername && r.username === currentUsername;
            return (
              <li key={r.username} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <span
                    className={
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold " +
                      (rank === 1
                        ? "bg-yellow-100 text-yellow-800"
                        : rank === 2
                        ? "bg-gray-100 text-gray-800"
                        : rank === 3
                        ? "bg-amber-100 text-amber-800"
                        : "bg-gray-50 text-gray-600")
                    }
                    title={`#${rank}`}
                  >
                    {rank}
                  </span>
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-blue-50 text-blue-700 text-xs font-bold">
                    {r.username.slice(0, 1).toUpperCase()}
                  </div>
                  <span className={"text-sm " + (you ? "font-semibold" : "")}>
                    {r.username}
                    {you && (
                      <em className="ml-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">
                        you
                      </em>
                    )}
                  </span>
                </div>
                <span className="font-semibold tabular-nums">{r.pixels.toLocaleString()}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
