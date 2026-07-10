"use client";

import { useState } from "react";
import type { ExerciseCatalogItem } from "@/lib/data-db";

export function ExercisePickerDrawer({
  catalog,
  title = "Add exercise",
  onAdd,
  onClose,
}: {
  catalog: ExerciseCatalogItem[];
  title?: string;
  onAdd: (item: ExerciseCatalogItem) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const filtered = q.trim()
    ? catalog.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()))
    : catalog;
  const exactMatch = catalog.some((e) => e.name.toLowerCase() === q.toLowerCase());

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        className="max-h-[75vh] overflow-y-auto rounded-t-3xl border-t border-cardborder bg-bg p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="font-semibold">{title}</span>
          <button onClick={onClose} className="ml-auto p-2 text-muted">✕</button>
        </div>
        <input
          autoFocus
          className="input mb-3 w-full text-base"
          placeholder="Search or type new name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="space-y-1">
          {filtered.map((ex) => (
            <button
              key={ex.name}
              onClick={() => onAdd(ex)}
              className="flex w-full items-start gap-2 rounded-xl p-3 text-left hover:bg-white/5 active:bg-white/10"
            >
              <div>
                <div className="text-sm font-medium">{ex.name}</div>
                {ex.notes && <div className="text-xs italic text-muted">{ex.notes}</div>}
                <div className="text-xs text-muted">
                  {[ex.default_sets && `${ex.default_sets}×`, ex.default_reps, ex.default_weight && `${ex.default_weight}kg`]
                    .filter(Boolean).join(" ")}
                </div>
              </div>
            </button>
          ))}
          {q.trim() && !exactMatch && (
            <button
              onClick={() => onAdd({ name: q.trim(), notes: "", default_sets: null, default_reps: "", default_weight: null, muscle_groups: [], equipment: null })}
              className="flex w-full items-center gap-2 rounded-xl p-3 hover:bg-white/5"
            >
              <span className="text-accent">+</span>
              <span className="text-sm">Add &quot;{q.trim()}&quot; as new exercise</span>
            </button>
          )}
          {filtered.length === 0 && !q.trim() && (
            <div className="py-6 text-center text-sm text-muted">Type a name above to search or add.</div>
          )}
        </div>
      </div>
    </div>
  );
}
