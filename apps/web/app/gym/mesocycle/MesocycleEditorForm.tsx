"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Meso = {
  name: string;
  goal: string;
  phase: string;
  start_date: string;
  end_date: string;
} | null;

const PHASES = ["accumulation", "intensification", "realization", "deload"];

export function MesocycleEditorForm({ initial }: { initial: Meso }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const defaultEnd = new Date(Date.now() + 28 * 864e5).toISOString().slice(0, 10);

  const [name, setName] = useState(initial?.name ?? "");
  const [goal, setGoal] = useState(initial?.goal ?? "");
  const [phase, setPhase] = useState(initial?.phase ?? "accumulation");
  const [startDate, setStartDate] = useState(initial?.start_date ?? today);
  const [endDate, setEndDate] = useState(initial?.end_date ?? defaultEnd);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!name.trim()) { setError("Name is required."); return; }
    if (endDate <= startDate) { setError("End date must be after start date."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/mesocycle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), goal, phase, start_date: startDate, end_date: endDate }),
      });
      if (!res.ok) throw new Error();
      router.push("/gym");
      router.refresh();
    } catch {
      setError("Failed to save. Please try again.");
      setSaving(false);
    }
  }

  const durationDays = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 864e5);

  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        <div className="space-y-1.5">
          <label className="label">Block name</label>
          <input
            className="input w-full"
            placeholder="e.g. Mesocycle 3 — Intensification"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label className="label">Goal</label>
          <input
            className="input w-full"
            placeholder="e.g. Strength + hypertrophy for floorball season"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label className="label">Phase</label>
          <div className="flex flex-wrap gap-2">
            {PHASES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPhase(p)}
                className={`rounded-xl border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                  phase === p
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-cardborder text-muted hover:bg-white/5"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card space-y-4">
        <div className="label">Duration</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="label">Start</label>
            <input
              type="date"
              className="input w-full"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="label">End</label>
            <input
              type="date"
              className="input w-full"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
        {durationDays > 0 && (
          <div className="text-xs text-muted">
            {durationDays} days · {Math.round(durationDays / 7)} weeks
          </div>
        )}
      </div>

      {error && <div className="text-sm text-bad">{error}</div>}

      <button onClick={save} disabled={saving} className="btn w-full">
        {saving ? "Saving…" : initial ? "Save changes" : "Create block"}
      </button>
    </div>
  );
}
