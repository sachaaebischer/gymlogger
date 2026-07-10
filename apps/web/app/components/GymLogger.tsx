"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { GymSession, GymSet } from "@coach/lib";
import type { ExerciseCatalogItem } from "@coach/lib";
import type { LastPerf } from "@/lib/data";

type SaveState = "idle" | "saving" | "saved" | "error";

function num(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function swapInSet(s: Set<number>, a: number, b: number): Set<number> {
  const n = new Set<number>();
  for (const idx of s) {
    if (idx === a) n.add(b);
    else if (idx === b) n.add(a);
    else n.add(idx);
  }
  return n;
}

/* ─────────────────── AddExercise drawer ─────────────────────── */
function AddExerciseDrawer({
  catalog, title = "Add exercise", onAdd, onClose,
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
              onClick={() => onAdd({ name: q.trim(), notes: "", default_sets: null, default_reps: "", default_weight: null })}
              className="flex w-full items-center gap-2 rounded-xl p-3 hover:bg-white/5"
            >
              <span className="text-accent">+</span>
              <span className="text-sm">Add "{q.trim()}" as new exercise</span>
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

/* ─────────────────── Rest overlay ──────────────────────────── */
function RestOverlay({
  secondsLeft,
  total,
  nextLabel,
  onSkip,
  onAdjust,
}: {
  secondsLeft: number;
  total: number;
  nextLabel: string;
  onSkip: () => void;
  onAdjust: (delta: number) => void;
}) {
  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const pct = secondsLeft <= 0 ? 100 : Math.max(0, (1 - secondsLeft / total) * 100);
  const done = secondsLeft <= 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg px-6">
      <div className="text-xs uppercase tracking-widest text-muted mb-4">Rest</div>
      <div className={`text-8xl font-bold tabular-nums mb-4 ${done ? "text-good" : "text-accent"}`}>
        {done ? "GO" : `${mm}:${ss}`}
      </div>
      {/* Progress ring */}
      <div className="w-full max-w-xs h-1.5 rounded-full bg-cardborder mb-6">
        <div
          className="h-1.5 rounded-full bg-accent transition-all duration-1000"
          style={{ width: `${pct}%` }}
        />
      </div>
      {nextLabel && (
        <div className="text-sm text-muted mb-8 text-center">{nextLabel}</div>
      )}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => onAdjust(-30)}
          className="rounded-xl border border-cardborder px-4 py-2 text-sm text-muted hover:bg-white/5"
        >
          −30s
        </button>
        <button
          onClick={() => onAdjust(30)}
          className="rounded-xl border border-cardborder px-4 py-2 text-sm text-muted hover:bg-white/5"
        >
          +30s
        </button>
      </div>
      <button
        onClick={onSkip}
        className={`w-full max-w-xs rounded-2xl py-5 text-xl font-bold transition active:scale-95 ${
          done ? "bg-good text-bg" : "bg-cardborder text-[#e6edf3] hover:bg-white/20"
        }`}
      >
        {done ? "Start Next Set →" : "Skip Rest"}
      </button>
    </div>
  );
}

/* ─────────────────── Training set inputs ────────────────────── */
function TrainingSetInputs({
  set,
  onField,
}: {
  set: GymSet;
  onField: (field: "weight" | "reps", value: string) => void;
}) {
  return (
    <div className="flex items-end justify-center gap-4">
      <div className="flex flex-col items-center gap-1.5">
        <input
          className="h-32 w-44 rounded-2xl border-2 border-cardborder bg-card text-center text-6xl font-black tabular-nums outline-none focus:border-accent caret-accent"
          inputMode="decimal"
          defaultValue={set.weight !== null && set.weight !== undefined ? String(set.weight) : ""}
          placeholder="—"
          onChange={(e) => onField("weight", e.target.value)}
        />
        <span className="text-xs text-muted">kg</span>
      </div>
      <span className="text-3xl text-muted mb-6">×</span>
      <div className="flex flex-col items-center gap-1.5">
        <input
          className="h-32 w-32 rounded-2xl border-2 border-cardborder bg-card text-center text-6xl font-black tabular-nums outline-none focus:border-accent caret-accent"
          inputMode="numeric"
          defaultValue={set.reps !== null && set.reps !== undefined ? String(set.reps) : ""}
          placeholder="—"
          onChange={(e) => onField("reps", e.target.value)}
        />
        <span className="text-xs text-muted">reps</span>
      </div>
    </div>
  );
}

/* ─────────────────── Training mode ─────────────────────────── */
function TrainingMode({
  session,
  lastPerf,
  activeExIdx,
  setActiveExIdx,
  onField,
  onToggleDone,
  onSwitchToEdit,
  onPersist,
  onFinish,
  onAbort,
  saveLabel,
  restLeft,
  restTotal,
  onStartRest,
  onSkipRest,
  onAdjustRest,
}: {
  session: GymSession;
  lastPerf: LastPerf;
  activeExIdx: number;
  setActiveExIdx: (i: number) => void;
  onField: (exIdx: number, setIdx: number, field: "weight" | "reps", value: string) => void;
  onToggleDone: (exIdx: number, setIdx: number) => void;
  onSwitchToEdit: () => void;
  onPersist: () => void;
  onFinish: () => void;
  onAbort: () => void;
  saveLabel: string;
  restLeft: number;
  restTotal: number;
  onStartRest: (secs?: number) => void;
  onSkipRest: () => void;
  onAdjustRest: (delta: number) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ex = session.exercises[activeExIdx];
  const totalEx = session.exercises.length;

  // Derived active set (first undone, or all done)
  const rawIdx = ex ? ex.sets.findIndex((s) => !s.done) : -1;
  const activeSetIdx = rawIdx === -1 ? (ex?.sets.length ?? 0) : rawIdx;
  const isExDone = rawIdx === -1 && (ex?.sets.length ?? 0) > 0;

  const isSessionComplete =
    totalEx > 0 &&
    session.exercises.every((e) => e.sets.length > 0 && e.sets.every((s) => s.done));

  const prev = ex ? lastPerf[ex.name] : null;
  const setKey = `${activeExIdx}-${activeSetIdx}`;

  // Next set info for rest overlay
  let nextLabel = "";
  if (ex && !isExDone && activeSetIdx < ex.sets.length) {
    const nextSet = ex.sets[activeSetIdx];
    if (nextSet) {
      const wt = nextSet.weight !== null ? `${nextSet.weight}kg` : "–";
      const rp = nextSet.reps !== null ? `× ${nextSet.reps} reps` : "";
      nextLabel = `Next: Set ${activeSetIdx + 1}/${ex.sets.length} · ${wt} ${rp}`;
    }
  } else if (isExDone && activeExIdx < totalEx - 1) {
    const nextEx = session.exercises[activeExIdx + 1];
    nextLabel = `Next exercise: ${nextEx?.name ?? ""}`;
  }

  if (restLeft > 0 || (restLeft === 0 && restTotal > 0)) {
    // Show rest overlay while resting
  }

  if (totalEx === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="text-muted text-sm">No exercises yet</div>
        <button onClick={onSwitchToEdit} className="btn">Add exercises →</button>
      </div>
    );
  }

  if (isSessionComplete) {
    const totalSets = session.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
    const totalVol = session.exercises.reduce((n, e) => {
      return n + e.sets.filter((s) => s.done && s.weight && s.reps).reduce((m, s) => m + (s.weight! * s.reps!), 0);
    }, 0);
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-6 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-accent/10 mb-2"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#C8FF00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
        <div>
          <h2 className="text-2xl font-bold">Session Complete!</h2>
          <p className="text-muted mt-1">{session.name}</p>
        </div>
        <div className="flex gap-8">
          <div>
            <div className="text-2xl font-bold text-accent">{totalSets}</div>
            <div className="text-xs text-muted">sets done</div>
          </div>
          {totalVol > 0 && (
            <div>
              <div className="text-2xl font-bold text-accent">{(totalVol / 1000).toFixed(1)}t</div>
              <div className="text-xs text-muted">volume</div>
            </div>
          )}
        </div>
        <div className="flex gap-3 w-full max-w-xs">
          <button onClick={onSwitchToEdit} className="btn-ghost flex-1">Review</button>
          <button onClick={onPersist} className="btn flex-1">Finish</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100svh-4rem)] pb-24">
      {/* Exercise progress dots + nav */}
      <div className="flex items-center justify-between mb-4 px-1">
        <button
          onClick={() => setActiveExIdx(Math.max(0, activeExIdx - 1))}
          disabled={activeExIdx === 0}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-lg disabled:opacity-20 hover:bg-white/5"
        >
          ←
        </button>
        <div className="flex items-center gap-1.5">
          {session.exercises.map((e, i) => {
            const done = e.sets.length > 0 && e.sets.every((s) => s.done);
            return (
              <button
                key={i}
                onClick={() => setActiveExIdx(i)}
                className={`rounded-full transition-all ${
                  done
                    ? "w-2.5 h-2.5 bg-good"
                    : i === activeExIdx
                    ? "w-3 h-3 bg-accent"
                    : "w-2 h-2 bg-cardborder"
                }`}
                aria-label={e.name}
              />
            );
          })}
        </div>
        <button
          onClick={() => setActiveExIdx(Math.min(totalEx - 1, activeExIdx + 1))}
          disabled={activeExIdx === totalEx - 1}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-lg disabled:opacity-20 hover:bg-white/5"
        >
          →
        </button>
      </div>

      {/* Exercise name + target */}
      <div className="text-center mb-5">
        <div className="text-xs text-muted mb-0.5">
          Exercise {activeExIdx + 1} of {totalEx}
        </div>
        <div className="relative flex items-center justify-center">
          <h2 className="text-2xl font-bold">{ex?.name}</h2>
          {ex && (
            <a
              href={`/gym/exercises/${encodeURIComponent(ex.name)}`}
              className="absolute -right-10 flex h-8 w-8 items-center justify-center rounded-xl text-base text-muted hover:bg-white/5"
              title="Exercise history"
            >

            </a>
          )}
        </div>
        {ex && (ex.target_sets || ex.target_reps) && (
          <div className="text-sm text-muted mt-1">
            Target: {ex.target_sets ? `${ex.target_sets}×` : ""}{ex.target_reps || ""}
          </div>
        )}
        {ex?.notes && (
          <div className="text-xs italic text-muted mt-1">{ex.notes}</div>
        )}
      </div>

      {isExDone ? (
        /* Exercise complete state */
        <div className="flex flex-col items-center gap-4 flex-1 justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-good/20 text-good"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></div>
          <div className="font-semibold text-lg">{ex?.name}</div>
          <div className="flex flex-wrap gap-2 justify-center">
            {ex?.sets.filter((s) => s.done).map((s, i) => (
              <span key={i} className="rounded-xl bg-good/15 text-good px-3 py-1.5 text-sm">
                ✓ {s.weight ?? "BW"}×{s.reps ?? "–"}
              </span>
            ))}
          </div>
          {activeExIdx < totalEx - 1 ? (
            <button
              onClick={() => setActiveExIdx(activeExIdx + 1)}
              className="btn mt-4 px-8 py-4 text-lg"
            >
              Next Exercise →
            </button>
          ) : (
            <button onClick={onPersist} className="btn mt-4 text-lg">
              Finish Session
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Done sets */}
          {ex && ex.sets.some((s) => s.done) && (
            <div className="flex flex-wrap gap-2 justify-center mb-4">
              {ex.sets.filter((s) => s.done).map((s, i) => (
                <span key={i} className="rounded-xl bg-good/15 text-good px-2.5 py-1 text-xs font-medium">
                  {s.weight ?? "BW"}×{s.reps ?? "–"}
                </span>
              ))}
            </div>
          )}

          {/* Set number */}
          <div className="text-center text-sm text-muted mb-4">
            Set {activeSetIdx + 1} of {ex?.sets.length ?? 0}
          </div>

          {/* Big inputs */}
          {ex && activeSetIdx < ex.sets.length && (
            <div className="flex justify-center">
              <TrainingSetInputs
                key={setKey}
                set={ex.sets[activeSetIdx]}
                onField={(field, val) => onField(activeExIdx, activeSetIdx, field, val)}
              />
            </div>
          )}

          {/* Last performance */}
          {prev && prev.length > 0 && (
            <div className="text-center text-xs text-muted mt-4">
              Last: {prev.map((p) => `${p.weight ?? "BW"}×${p.reps ?? "–"}`).join(", ")}
            </div>
          )}

          {/* Done button */}
          <div className="mt-auto pt-6">
            <button
              onClick={() => {
                if (ex && activeSetIdx < ex.sets.length) {
                  onToggleDone(activeExIdx, activeSetIdx);
                  onStartRest(120);
                }
              }}
              className="btn h-16 text-xl"
            >
              Done
            </button>
          </div>
        </>
      )}

      {/* Rest timer overlay */}
      {restLeft > 0 && (
        <RestOverlay
          secondsLeft={restLeft}
          total={restTotal}
          nextLabel={nextLabel}
          onSkip={onSkipRest}
          onAdjust={onAdjustRest}
        />
      )}

      {/* Bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-cardborder bg-bg/95 backdrop-blur safe-bottom">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-3">
          <div className="flex gap-1">
            {[90, 120, 180].map((s) => (
              <button
                key={s}
                onClick={() => onStartRest(s)}
                className="rounded-lg px-2.5 py-2 text-xs text-muted hover:bg-white/5"
              >
                {s}s
              </button>
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            <button onClick={onSwitchToEdit} className="btn-ghost text-xs py-2 px-3">
              ✏ Edit
            </button>
            <button
              onClick={() => setMenuOpen(true)}
              className="rounded-xl border border-cardborder bg-card px-3 py-2 text-xs text-muted hover:bg-white/5"
            >
              ⋯
            </button>
          </div>
        </div>
      </div>

      {/* Overflow menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/60" onClick={() => setMenuOpen(false)}>
          <div className="rounded-t-3xl border-t border-cardborder bg-bg p-4 pb-8 space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="text-xs text-muted text-center mb-3 uppercase tracking-wide">Session options</div>
            <button
              onClick={() => { setMenuOpen(false); onFinish(); }}
              className="flex w-full items-center gap-3 rounded-2xl border border-cardborder bg-card p-4 text-left hover:bg-white/5"
            >
              <div>
                <div className="font-semibold">Finish session</div>
                <div className="text-xs text-muted">Save and mark as done</div>
              </div>
            </button>
            <button
              onClick={() => { setMenuOpen(false); onAbort(); }}
              className="flex w-full items-center gap-3 rounded-2xl border border-bad/30 bg-card p-4 text-left hover:bg-bad/10"
            >
              <div>
                <div className="font-semibold text-bad">Abort session</div>
                <div className="text-xs text-muted">Delete all data from this session</div>
              </div>
            </button>
            <button onClick={() => setMenuOpen(false)} className="w-full py-3 text-sm text-muted">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────── Edit mode ──────────────────────────────── */
function EditMode({
  session,
  lastPerf,
  catalog,
  onField,
  onToggleDone,
  onAddSet,
  onRemoveSet,
  onAddExercise,
  onReplaceExercise,
  onRenameExercise,
  onRemoveExercise,
  onMoveExercise,
  onUpdateNotes,
  onUpdateSessionNotes,
  onSwitchToTraining,
  onPersist,
  onAbort,
  saveLabel,
  isDirty,
}: {
  session: GymSession;
  lastPerf: LastPerf;
  catalog: ExerciseCatalogItem[];
  onField: (exIdx: number, setIdx: number, field: "weight" | "reps", value: string) => void;
  onToggleDone: (exIdx: number, setIdx: number) => void;
  onAddSet: (exIdx: number) => void;
  onRemoveSet: (exIdx: number, setIdx: number) => void;
  onAddExercise: (item: ExerciseCatalogItem) => void;
  onReplaceExercise: (exIdx: number, item: ExerciseCatalogItem) => void;
  onRenameExercise: (exIdx: number, name: string) => void;
  onRemoveExercise: (exIdx: number) => void;
  onMoveExercise: (exIdx: number, dir: -1 | 1) => void;
  onUpdateNotes: (exIdx: number, notes: string) => void;
  onUpdateSessionNotes: (notes: string) => void;
  onSwitchToTraining: () => void;
  onPersist: () => void;
  onAbort: () => void;
  saveLabel: string;
  isDirty: boolean;
}) {
  const [addExOpen, setAddExOpen] = useState(false);
  const [replaceExIdx, setReplaceExIdx] = useState<number | null>(null);
  const [notesOpen, setNotesOpen] = useState<Set<number>>(new Set());
  return (
    <div className="space-y-4 pb-28">
      {session.exercises.map((ex, exIdx) => {
        const prev = lastPerf[ex.name];
        const isFirst = exIdx === 0;
        const isLast = exIdx === session.exercises.length - 1;
        const showNotes = notesOpen.has(exIdx);

        return (
          <div key={exIdx} className="card">
            {/* Header */}
            <div className="flex items-start gap-2 mb-3">
              <div className="flex flex-col gap-1 shrink-0 pt-0.5">
                <button
                  onClick={() => onMoveExercise(exIdx, -1)}
                  disabled={isFirst}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-sm disabled:opacity-20 hover:bg-white/5"
                >
                  ↑
                </button>
                <button
                  onClick={() => onMoveExercise(exIdx, 1)}
                  disabled={isLast}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-sm disabled:opacity-20 hover:bg-white/5"
                >
                  ↓
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{ex.name}</h3>
                {ex.target_sets || ex.target_reps ? (
                  <div className="text-xs text-muted">{ex.target_sets ? `${ex.target_sets}×` : ""}{ex.target_reps || ""}</div>
                ) : null}
                {ex.notes && !showNotes && (
                  <div className="text-xs italic text-muted mt-0.5 truncate">{ex.notes}</div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  onClick={() => setNotesOpen((s) => { const n = new Set(s); showNotes ? n.delete(exIdx) : n.add(exIdx); return n; })}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-sm hover:bg-white/5"
                  title="Notes"
                >
                  ✎
                </button>
                <button
                  onClick={() => setReplaceExIdx(exIdx)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-sm hover:bg-white/5"
                  title="Replace"
                >
                  ⇄
                </button>
                <button
                  onClick={() => onRemoveExercise(exIdx)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-sm text-bad hover:bg-bad/10"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            </div>

            {showNotes && (
              <textarea
                className="w-full rounded-xl border border-cardborder bg-bg p-2 text-sm outline-none focus:border-accent mb-3"
                rows={2}
                placeholder="Seat position, grip, cues…"
                value={ex.notes}
                onChange={(e) => onUpdateNotes(exIdx, e.target.value)}
              />
            )}

            {prev && prev.length > 0 && (
              <div className="text-xs text-muted mb-2">
                Last: {prev.map((p) => `${p.weight ?? "BW"}×${p.reps ?? "–"}`).join(", ")}
              </div>
            )}

            {/* Sets */}
            <div className="space-y-2">
              <div className="grid grid-cols-[28px_1fr_1fr_44px_32px] gap-1.5 text-xs text-muted text-center">
                <span>#</span><span>kg</span><span>reps</span><span></span><span></span>
              </div>
              {ex.sets.map((set, setIdx) => (
                <div
                  key={setIdx}
                  className={`grid grid-cols-[28px_1fr_1fr_44px_32px] gap-1.5 items-center ${set.done ? "opacity-50" : ""}`}
                >
                  <span className="text-center text-xs text-muted">{set.set_no}</span>
                  <input
                    className="input h-10 text-center text-sm"
                    inputMode="decimal"
                    defaultValue={set.weight ?? ""}
                    placeholder="–"
                    onChange={(e) => onField(exIdx, setIdx, "weight", e.target.value)}
                  />
                  <input
                    className="input h-10 text-center text-sm"
                    inputMode="numeric"
                    defaultValue={set.reps ?? ""}
                    placeholder="–"
                    onChange={(e) => onField(exIdx, setIdx, "reps", e.target.value)}
                  />
                  <button
                    onClick={() => onToggleDone(exIdx, setIdx)}
                    className={`h-10 w-full rounded-xl border-2 text-base transition-colors ${
                      set.done ? "border-good bg-good/20 text-good" : "border-cardborder text-muted hover:border-good/50"
                    }`}
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => onRemoveSet(exIdx, setIdx)}
                    className="flex h-10 w-8 items-center justify-center rounded-xl text-xs text-bad hover:bg-bad/10"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() => onAddSet(exIdx)}
                className="h-10 w-full rounded-xl border border-dashed border-cardborder text-xs text-muted hover:border-accent hover:text-accent"
              >
                + Add set
              </button>
            </div>
          </div>
        );
      })}

      <button
        onClick={() => setAddExOpen(true)}
        className="h-12 w-full rounded-xl border border-dashed border-cardborder text-sm text-muted hover:border-accent hover:text-accent"
      >
        + Add exercise
      </button>

      <div className="card">
        <div className="text-xs uppercase tracking-wide text-muted mb-1">Session notes</div>
        <textarea
          className="w-full rounded-xl border border-cardborder bg-bg p-3 text-sm outline-none focus:border-accent"
          rows={2}
          defaultValue={session.notes}
          onChange={(e) => onUpdateSessionNotes(e.target.value)}
        />
      </div>

      {/* Bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-cardborder bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-3">
          <button onClick={onSwitchToTraining} className="btn-ghost text-sm">
            ← Training
          </button>
          <button onClick={onAbort} className="rounded-xl border border-bad/30 px-3 py-2 text-xs text-bad hover:bg-bad/10">
            Abort
          </button>
          <button
            onClick={onPersist}
            className={`btn ml-auto ${!isDirty ? "opacity-60" : ""}`}
          >
            {saveLabel}
          </button>
        </div>
      </div>

      {addExOpen && (
        <AddExerciseDrawer
          catalog={catalog}
          onAdd={(item) => { onAddExercise(item); setAddExOpen(false); }}
          onClose={() => setAddExOpen(false)}
        />
      )}
      {replaceExIdx !== null && (
        <AddExerciseDrawer
          catalog={catalog}
          title={`Replace: ${session.exercises[replaceExIdx]?.name ?? ""}`}
          onAdd={(item) => { onReplaceExercise(replaceExIdx, item); setReplaceExIdx(null); }}
          onClose={() => setReplaceExIdx(null)}
        />
      )}
    </div>
  );
}

/* ─────────────────── Template update prompt ─────────────────── */
function TemplateUpdatePrompt({
  session,
  templateId,
  onClose,
}: {
  session: GymSession;
  templateId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function update() {
    setBusy(true);
    const exercises = session.exercises.map((ex) => ({
      name: ex.name,
      sets: ex.target_sets ?? ex.sets.length,
      reps: ex.target_reps || "8",
      ...(ex.notes ? { notes: ex.notes } : {}),
    }));
    await fetch(`/api/templates/${templateId}/update-from-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exercises }),
    });
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70">
      <div className="rounded-t-3xl bg-card p-6 pb-10 space-y-4">
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-cardborder" />
        <div className="font-black text-lg">Update template?</div>
        <p className="text-sm text-muted">
          You changed the exercise list during this session. Archive the current template and save the new exercise order?
        </p>
        <button
          onClick={update}
          disabled={busy}
          className="btn"
        >
          {busy ? "Saving…" : "Yes, update template"}
        </button>
        <button onClick={onClose} className="w-full py-3 text-sm text-muted-fg">
          Keep template as-is
        </button>
      </div>
    </div>
  );
}

/* ─────────────────── Main GymLogger ─────────────────────────── */
export function GymLogger({
  initial,
  lastPerf,
  catalog,
  defaultRestSecs = 120,
  templateId,
  aiAnalysisEnabled = true,
}: {
  initial: GymSession;
  lastPerf: LastPerf;
  catalog: ExerciseCatalogItem[];
  defaultRestSecs?: number;
  templateId?: string;
  aiAnalysisEnabled?: boolean;
}) {
  const router = useRouter();
  const [session, setSession] = useState<GymSession>(initial);
  const [save, setSave] = useState<SaveState>("idle");
  const [templatePrompt, setTemplatePrompt] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [mode, setMode] = useState<"training" | "editing">(
    initial.exercises.length === 0 ? "editing" : "training"
  );
  const [activeExIdx, setActiveExIdx] = useState(0);

  // Hide the app header while the logger is active
  useEffect(() => {
    document.documentElement.classList.add("gym-logger");
    return () => document.documentElement.classList.remove("gym-logger");
  }, []);

  // Rest timer
  const [restLeft, setRestLeft] = useState(0);
  const [restTotal, setRestTotal] = useState(defaultRestSecs);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (restLeft <= 0) { if (tick.current) clearInterval(tick.current); return; }
    tick.current = setInterval(() => setRestLeft((s) => Math.max(0, s - 1)), 1000);
    return () => { if (tick.current) clearInterval(tick.current); };
  }, [restLeft > 0]);

  const startRest = (secs = restTotal) => { setRestTotal(secs); setRestLeft(secs); };
  const skipRest = () => { setRestLeft(0); };
  const adjustRest = (delta: number) => { setRestLeft((s) => Math.max(0, s + delta)); };

  // Auto-save
  const pendingSave = useRef<GymSession | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleSave(s: GymSession, delayMs = 600) {
    pendingSave.current = s;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const toSave = pendingSave.current;
      if (toSave) void doSave(toSave, false);
    }, delayMs);
  }

  async function doSave(s: GymSession, finalize: boolean) {
    pendingSave.current = null;
    setSave("saving");
    const payload: GymSession = {
      ...s,
      started_at: s.started_at || new Date().toISOString(),
      ...(finalize ? { finished_at: new Date().toISOString() } : {}),
    };
    try {
      const res = await fetch(`/api/gym/${s.date}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      if (finalize) {
        setSession(payload);
        if (aiAnalysisEnabled) {
          void fetch("/api/ai/analyze-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date: s.date }),
          }).catch(() => {});
        }
        // Offer to update the template if exercises changed
        if (templateId) {
          const origNames = initial.exercises.map((e) => e.name).join("|");
          const newNames = payload.exercises.map((e) => e.name).join("|");
          if (origNames !== newNames) setTemplatePrompt(true);
        }
        router.refresh();
      }
      setSave("saved");
      setIsDirty(false);
    } catch (e) {
      console.error(e);
      setSave("error");
    }
  }

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  function update(fn: (draft: GymSession) => void, immediate = false) {
    setSession((prev) => {
      const next: GymSession = structuredClone(prev);
      fn(next);
      scheduleSave(next, immediate ? 80 : 600);
      return next;
    });
    setSave("idle");
    setIsDirty(true);
  }

  // Set operations
  function setField(exIdx: number, setIdx: number, field: "reps" | "weight", value: string) {
    update((d) => { (d.exercises[exIdx].sets[setIdx][field] as number | null) = num(value); });
  }

  function toggleDone(exIdx: number, setIdx: number) {
    const wasDone = session.exercises[exIdx].sets[setIdx].done;
    update((d) => {
      const s = d.exercises[exIdx].sets[setIdx];
      s.done = !s.done;
      if (s.done && !d.started_at) d.started_at = new Date().toISOString();
    }, !wasDone);
  }

  function addSet(exIdx: number) {
    update((d) => {
      const sets = d.exercises[exIdx].sets;
      const last = sets[sets.length - 1];
      sets.push({ set_no: sets.length + 1, reps: last?.reps ?? null, weight: last?.weight ?? null, rpe: null, done: false });
    });
  }

  function removeSet(exIdx: number, setIdx: number) {
    update((d) => {
      d.exercises[exIdx].sets.splice(setIdx, 1);
      d.exercises[exIdx].sets.forEach((s, i) => { s.set_no = i + 1; });
    });
  }

  function removeExercise(exIdx: number) {
    if (!confirm(`Remove "${session.exercises[exIdx].name}"?`)) return;
    update((d) => { d.exercises.splice(exIdx, 1); });
    if (activeExIdx >= session.exercises.length - 1) {
      setActiveExIdx(Math.max(0, session.exercises.length - 2));
    }
  }

  function moveExercise(exIdx: number, dir: -1 | 1) {
    const newIdx = exIdx + dir;
    if (newIdx < 0 || newIdx >= session.exercises.length) return;
    update((d) => {
      const tmp = d.exercises[exIdx];
      d.exercises[exIdx] = d.exercises[newIdx];
      d.exercises[newIdx] = tmp;
    });
  }

  function addExercise(item: ExerciseCatalogItem) {
    update((d) => {
      d.exercises.push({
        name: item.name,
        target_sets: item.default_sets,
        target_reps: item.default_reps,
        notes: item.notes,
        sets: Array.from({ length: Math.max(1, item.default_sets ?? 3) }, (_, i) => ({
          set_no: i + 1, reps: null, weight: item.default_weight ?? null, rpe: null, done: false,
        })),
      });
    });
  }

  function replaceExercise(exIdx: number, item: ExerciseCatalogItem) {
    update((d) => {
      d.exercises[exIdx].name = item.name;
      d.exercises[exIdx].notes = item.notes;
      d.exercises[exIdx].target_sets = item.default_sets;
      d.exercises[exIdx].target_reps = item.default_reps;
    });
  }

  function renameExercise(exIdx: number, name: string) {
    update((d) => { d.exercises[exIdx].name = name; });
  }

  function updateExNotes(exIdx: number, notes: string) {
    update((d) => { d.exercises[exIdx].notes = notes; });
  }

  function updateSessionNotes(notes: string) {
    update((d) => { d.notes = notes; });
  }

  async function persist() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await doSave(pendingSave.current ?? session, true);
  }

  async function finish() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await doSave(pendingSave.current ?? session, true);
  }

  async function abort() {
    const hasDone = session.exercises.some((e) => e.sets.some((s) => s.done));
    const msg = hasDone
      ? "Abort this session? All logged sets will be permanently deleted."
      : "Abort this session?";
    if (!confirm(msg)) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      await fetch(`/api/gym/${session.date}`, { method: "DELETE" });
    } catch (e) {
      console.error(e);
    }
    router.push("/gym");
    router.refresh();
  }

  const saveLabel =
    save === "saving" ? "Saving…" :
    save === "saved" ? "Saved ✓" :
    save === "error" ? "Error — retry" :
    isDirty ? "Save" : "Saved ✓";

  if (mode === "training") {
    return (
      <>
        <TrainingMode
          session={session}
          lastPerf={lastPerf}
          activeExIdx={activeExIdx}
          setActiveExIdx={setActiveExIdx}
          onField={setField}
          onToggleDone={toggleDone}
          onSwitchToEdit={() => setMode("editing")}
          onPersist={persist}
          onFinish={finish}
          onAbort={abort}
          saveLabel={saveLabel}
          restLeft={restLeft}
          restTotal={restTotal}
          onStartRest={startRest}
          onSkipRest={skipRest}
          onAdjustRest={adjustRest}
        />
        {templatePrompt && templateId && (
          <TemplateUpdatePrompt
            session={session}
            templateId={templateId}
            onClose={() => setTemplatePrompt(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <EditMode
        session={session}
        lastPerf={lastPerf}
        catalog={catalog}
        onField={setField}
        onToggleDone={toggleDone}
        onAddSet={addSet}
        onRemoveSet={removeSet}
        onAddExercise={addExercise}
        onReplaceExercise={replaceExercise}
        onRenameExercise={renameExercise}
        onRemoveExercise={removeExercise}
        onMoveExercise={moveExercise}
        onUpdateNotes={updateExNotes}
        onUpdateSessionNotes={updateSessionNotes}
        onSwitchToTraining={() => setMode("training")}
        onPersist={persist}
        onAbort={abort}
        saveLabel={saveLabel}
        isDirty={isDirty}
      />
      {templatePrompt && templateId && (
        <TemplateUpdatePrompt
          session={session}
          templateId={templateId}
          onClose={() => setTemplatePrompt(false)}
        />
      )}
    </>
  );
}
