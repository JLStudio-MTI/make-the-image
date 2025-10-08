// src/components/Leaderboard.tsx
import { useEffect, useState } from "react";
import { db } from "../lib/firebaseClient";
import { onValue, ref } from "firebase/database";

type Entry = { username: string; pixels: number };

export default function Leaderboard({ currentUsername }: { currentUsername?: string }) {
  const [rows, setRows] = useState<Entry[]>([]);

  useEffect(() => {
    const off = onValue(ref(db, "pixels"), (snap) => {
      const counts = new Map<string, number>();
      if (snap.exists()) {
        const all = snap.val() as Record<string, Record<string, { username?: string }>>;
        for (const y of Object.keys(all)) {
          const row = all[y] || {};
          for (const x of Object.keys(row)) {
            const u = row[x]?.username;
            if (typeof u === "string" && u) {
              counts.set(u, (counts.get(u) ?? 0) + 1);
            }
          }
        }
      }
      const arr: Entry[] = Array.from(counts.entries())
        .map(([username, pixels]) => ({ username, pixels }))
        .sort((a, b) => b.pixels - a.pixels)
        .slice(0, 20);
      setRows(arr);
    });
    return () => off();
  }, []);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold">Top contributors</h3>
      <ul className="space-y-1 text-sm">
        {rows.map((r, i) => (
          <li
            key={r.username}
            className={`flex justify-between ${r.username === currentUsername ? "font-semibold text-blue-700" : ""}`}
          >
            <span>{i + 1}. {r.username}</span>
            <span>{r.pixels.toLocaleString()}</span>
          </li>
        ))}
        {rows.length === 0 && <li className="text-gray-500">No placements yet.</li>}
      </ul>
    </div>
  );
}
