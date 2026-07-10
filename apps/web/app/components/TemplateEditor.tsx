"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SessionTemplate, ExerciseCatalogItem } from "@/lib/data-db";
import { ExercisePickerDrawer } from "@/app/components/ExercisePickerDrawer";

type Exercise = { name: string; sets: number; reps: string; notes?: string };

export function TemplateEditor({
  template,
  catalog,
}: {
  template: SessionTemplate | null;
  catalog: ExerciseCatalogItem[];
}) {
  const router = useRouter();
  const [name, setName] = useState(template?.name ?? "");
  const [exercises, setExercises] = useState<Exercise[]>(template?.exercises ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [replacingIdx, setReplacingIdx] = useState<number | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  function addFromCatalog(item: ExerciseCatalogItem) {
    setExercises((prev) => [
      ...prev,
      {
        name: item.name,
        sets: item.default_sets ?? 3,
        reps: item.default_reps || "8",
      },
    ]);
    setShowPicker(false);
  }

  function replaceFromCatalog(item: ExerciseCatalogItem) {
    if (replacingIdx === null) return;
    setExercises((prev) =>
      prev.map((ex, i) =>
        i === replacingIdx
          ? { ...ex, name: item.name, sets: item.default_sets ?? ex.sets, reps: item.default_reps || ex.reps }
          : ex
      )
    );
    setReplacingIdx(null);
  }

  function removeExercise(idx: number) {
    setExercises((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    setExercises((prev) => {
      const arr = [...prev];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      return arr;
    });
  }

  function moveDown(idx: number) {
    setExercises((prev) => {
      if (idx >= prev.length - 1) return prev;
      const arr = [...prev];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return arr;
    });
  }

  function updateExercise(idx: number, field: keyof Exercise, value: string | number) {
    setExercises((prev) => prev.map((ex, i) => i === idx ? { ...ex, [field]: value } : ex));
  }

  async function save() {
    if (!name.trim()) { setError("Template name is required."); return; }
    setSaving(true);
    setError("");
    try {
      const body = { name: name.trim(), exercises };
      let res: Response;
      if (template) {
        res = await fetch(`/api/templates/${template.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      if (!res.ok) throw new Error("Save failed");
      router.push("/gym/templates");
      router.refresh();
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Name */}
      <div className="card space-y-3">
        <label className="label">Template name</label>
        <input
          className="input w-full"
          placeholder="e.g. Upper Body A"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {/* Exercise list */}
      <div className="card space-y-4">
        <div className="label">Exercises</div>
        {exercises.length === 0 && (
          <div className="text-sm text-muted text-center py-4">No exercises yet. Add one below.</div>
        )}
        <div className="space-y-3">
          {exercises.map((ex, idx) => (
            <div key={idx} className="rounded-xl border border-cardborder p-3 space-y-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}
                  className="flex-1 text-left text-sm font-medium truncate"
                >
                  {ex.name}
                </button>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => moveUp(idx)} className="h-8 w-8 flex items-center justify-center rounded-lg text-muted hover:bg-white/5 text-xs disabled:opacity-30" disabled={idx === 0}>↑</button>
                  <button onClick={() => moveDown(idx)} className="h-8 w-8 flex items-center justify-center rounded-lg text-muted hover:bg-white/5 text-xs disabled:opacity-30" disabled={idx === exercises.length - 1}>↓</button>
                  <button onClick={() => removeExercise(idx)} className="h-8 w-8 flex items-center justify-center rounded-lg text-bad hover:bg-bad/10 text-xs">✕</button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-2 text-xs text-muted">
                  <span>{ex.sets} sets</span>
                  <span>·</span>
                  <span>{ex.reps} reps</span>
                </div>
                <button
                  onClick={() => setReplacingIdx(idx)}
                  className="text-xs text-muted hover:text-accent transition px-2 py-0.5 rounded-lg hover:bg-accent/10"
                >
                  Replace
                </button>
              </div>
              {editingIdx === idx && (
                <div className="flex gap-2 pt-1 border-t border-cardborder">
                  <div className="flex-1">
                    <div className="text-[10px] text-muted mb-1 uppercase tracking-wide">Sets</div>
                    <input
                      type="number"
                      className="input w-full text-sm py-1.5"
                      value={ex.sets}
                      min={1}
                      max={20}
                      onChange={(e) => updateExercise(idx, "sets", Number(e.target.value))}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-[10px] text-muted mb-1 uppercase tracking-wide">Reps</div>
                    <input
                      className="input w-full text-sm py-1.5"
                      value={ex.reps}
                      placeholder="8-12"
                      onChange={(e) => updateExercise(idx, "reps", e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={() => setShowPicker(true)}
          className="w-full rounded-xl border border-dashed border-cardborder py-3 text-sm text-muted hover:border-accent/40 hover:text-accent transition"
        >
          + Add exercise
        </button>
      </div>

      {error && <div className="text-sm text-bad text-center">{error}</div>}

      <button onClick={save} disabled={saving} className="btn">
        {saving ? "Saving…" : template ? "Save changes" : "Create template"}
      </button>

      {showPicker && (
        <ExercisePickerDrawer
          catalog={catalog}
          onAdd={addFromCatalog}
          onClose={() => setShowPicker(false)}
        />
      )}
      {replacingIdx !== null && (
        <ExercisePickerDrawer
          catalog={catalog}
          title={`Replace "${exercises[replacingIdx]?.name}"`}
          onAdd={replaceFromCatalog}
          onClose={() => setReplacingIdx(null)}
        />
      )}
    </div>
  );
}
