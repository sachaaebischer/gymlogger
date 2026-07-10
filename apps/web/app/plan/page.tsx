"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { PlannedGymSession, DayActivity } from "@coach/lib";

// ── constants ────────────────────────────────────────────────────────────────

const ACTIVITY_TYPES: { type: string; label: string; icon: string; intensity: "high" | "medium" | "low" }[] = [
  { type: "floorball_training", label: "Floorball training", icon: "🏑", intensity: "medium" },
  { type: "floorball_game",     label: "Floorball game",     icon: "🏆", intensity: "high" },
  { type: "tennis",             label: "Tennis",             icon: "🎾", intensity: "medium" },
  { type: "cycling",            label: "Cycling",            icon: "🚴", intensity: "medium" },
  { type: "hiking",             label: "Hiking",             icon: "🥾", intensity: "low" },
  { type: "crossfit",           label: "CrossFit",           icon: "💪", intensity: "high" },
  { type: "swimming",           label: "Swimming",           icon: "🏊", intensity: "medium" },
  { type: "other",              label: "Other",              icon: "📌", intensity: "medium" },
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── date helpers ─────────────────────────────────────────────────────────────

function currentMondayStr(): string {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d.toLocaleDateString("sv");
}

function addWeeks(weekStart: string, n: number): string {
  const d = new Date(weekStart + "T12:00:00");
  d.setDate(d.getDate() + n * 7);
  return d.toLocaleDateString("sv");
}

function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + "T12:00:00");
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString("sv");
  });
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── components ───────────────────────────────────────────────────────────────

function ActivityPicker({
  onPick,
  onClose,
}: {
  onPick: (a: DayActivity) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-30 flex flex-col justify-end bg-black/60"
      onClick={onClose}
    >
      <div
        className="max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-cardborder bg-bg p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center">
          <span className="font-semibold">What else is happening?</span>
          <button onClick={onClose} className="ml-auto text-muted">✕</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {ACTIVITY_TYPES.map((a) => (
            <button
              key={a.type}
              onClick={() => onPick({ type: a.type, label: a.label, intensity: a.intensity, notes: "" })}
              className="flex items-center gap-2 rounded-xl border border-cardborder p-3 text-left hover:bg-white/5 active:bg-white/10"
            >
              <span className="text-xl">{a.icon}</span>
              <span className="text-sm">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SessionTypeIcon({ type }: { type: "gym_upper" | "gym_lower" }) {
  return <span>{type === "gym_upper" ? "💪" : "🦵"}</span>;
}

function SessionPreview({ session, onRemove }: { session: PlannedGymSession; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const label = session.session_type === "gym_upper" ? "Upper body" : "Lower body";
  const topEx = session.exercises.slice(0, 3);

  return (
    <div className="rounded-xl border border-accent/40 bg-accent/5 p-3">
      <div className="flex items-center gap-2">
        <SessionTypeIcon type={session.session_type} />
        <span className="font-medium text-sm">{label}</span>
        <button
          onClick={() => setOpen((o) => !o)}
          className="ml-auto text-xs text-muted"
        >
          {open ? "▲" : "▼"}
        </button>
        <button onClick={onRemove} className="text-xs text-bad/70 hover:text-bad">
          ✕
        </button>
      </div>
      {!open && (
        <div className="mt-1 text-xs text-muted truncate">
          {topEx.map((e) => `${e.name} ${e.target_weight_label || e.target_weight_kg + "kg" || ""}`).join(" · ")}
          {session.exercises.length > 3 ? ` +${session.exercises.length - 3} more` : ""}
        </div>
      )}
      {open && (
        <div className="mt-2 space-y-1">
          {session.exercises.map((ex) => (
            <div key={ex.id} className="flex items-baseline gap-2 text-xs">
              <span className="font-medium truncate flex-1">{ex.name}</span>
              <span className="text-muted shrink-0">
                {ex.sets}×{ex.reps === "circuit" ? "circuit" : ex.reps}
                {ex.target_weight_label ? ` @ ${ex.target_weight_label}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
      <Link
        href={`/gym/${session.date}`}
        className="mt-2 block rounded-lg bg-accent/20 px-3 py-1.5 text-center text-xs font-semibold text-accent hover:bg-accent/30"
      >
        Start session →
      </Link>
    </div>
  );
}

// ── main page ────────────────────────────────────────────────────────────────

export default function PlanPage() {
  const [weekStart, setWeekStart] = useState(currentMondayStr);
  const today = new Date().toLocaleDateString("sv");

  // Activities per day: date -> DayActivity[]
  const [activities, setActivities] = useState<Record<string, DayActivity[]>>({});
  // Planned gym sessions: date -> PlannedGymSession
  const [sessions, setSessions] = useState<Record<string, PlannedGymSession>>({});

  const [pickerDay, setPickerDay] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dates = weekDates(weekStart);

  // Load week data
  useEffect(() => {
    // Load activities
    fetch(`/api/plan/activities?week=${weekStart}`)
      .then((r) => r.json())
      .then((d) => setActivities(d?.days ?? {}))
      .catch(() => {});

    // Load planned sessions for the week
    Promise.all(dates.map((date) => 
      fetch(`/api/plan/generate?date=${date}`)
        .then((r) => r.ok ? r.json() : null)
        .catch(() => null)
    )).then((results) => {
      const map: Record<string, PlannedGymSession> = {};
      results.forEach((s, i) => { if (s) map[dates[i]] = s; });
      setSessions(map);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  const addActivity = useCallback((date: string, activity: DayActivity) => {
    setActivities((prev) => {
      const updated = { ...prev, [date]: [...(prev[date] ?? []), activity] };
      // Save immediately
      fetch("/api/plan/activities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ week_start: weekStart, days: updated }),
      }).catch(() => {});
      return updated;
    });
  }, [weekStart]);

  const removeActivity = useCallback((date: string, idx: number) => {
    setActivities((prev) => {
      const updated = {
        ...prev,
        [date]: (prev[date] ?? []).filter((_, i) => i !== idx),
      };
      fetch("/api/plan/activities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ week_start: weekStart, days: updated }),
      }).catch(() => {});
      return updated;
    });
  }, [weekStart]);

  const generateSession = useCallback(async (date: string, type: "gym_upper" | "gym_lower") => {
    setGenerating(`${date}-${type}`);
    try {
      const r = await fetch("/api/plan/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date, session_type: type }),
      });
      if (r.ok) {
        const s = await r.json();
        setSessions((prev) => ({ ...prev, [date]: s }));
      }
    } catch {}
    setGenerating(null);
  }, []);

  const removeSession = useCallback(async (date: string) => {
    await fetch(`/api/plan/generate?date=${date}`, { method: "DELETE" });
    setSessions((prev) => {
      const n = { ...prev };
      delete n[date];
      return n;
    });
  }, []);

  const thisMonday = currentMondayStr();

  return (
    <div className="space-y-4">
      {/* Week nav */}
      <div className="flex items-center gap-2">
        <h1 className="text-base font-bold flex-1">Week plan</h1>
        <button
          onClick={() => setWeekStart((w) => addWeeks(w, -1))}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-white/5"
        >←</button>
        <span className="text-xs text-muted min-w-[80px] text-center">
          {weekStart === thisMonday ? "This week" : weekStart}
        </span>
        <button
          onClick={() => setWeekStart((w) => addWeeks(w, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-white/5"
        >→</button>
        {weekStart !== thisMonday && (
          <button
            onClick={() => setWeekStart(thisMonday)}
            className="text-xs text-accent hover:underline"
          >today</button>
        )}
      </div>

      {/* Days */}
      <div className="space-y-2">
        {dates.map((date, idx) => {
          const isToday = date === today;
          const isPast = date < today;
          const dayActivities = activities[date] ?? [];
          const session = sessions[date];
          const weekday = WEEKDAYS[idx];
          const isGenerating = generating === `${date}-gym_upper` || generating === `${date}-gym_lower`;

          return (
            <div
              key={date}
              className={`rounded-xl border p-3 ${
                isToday
                  ? "border-accent/60 bg-accent/5"
                  : isPast
                  ? "border-cardborder/30 opacity-60"
                  : "border-cardborder"
              }`}
            >
              {/* Day header */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold">{weekday}</span>
                <span className="text-xs text-muted">{fmtDate(date)}</span>
                {isToday && <span className="text-xs text-accent">· today</span>}
                <button
                  onClick={() => setPickerDay(date)}
                  className="ml-auto text-xs text-muted hover:text-accent"
                  title="Add activity"
                >
                  + activity
                </button>
              </div>

              {/* Non-gym activities */}
              {dayActivities.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {dayActivities.map((a, i) => {
                    const at = ACTIVITY_TYPES.find((t) => t.type === a.type);
                    const bgColor = a.intensity === "high" ? "bg-bad/15 text-bad/80" : a.intensity === "low" ? "bg-good/15 text-good/80" : "bg-warn/15 text-warn/80";
                    return (
                      <span
                        key={i}
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${bgColor}`}
                      >
                        {at?.icon} {a.label}
                        {!isPast && (
                          <button onClick={() => removeActivity(date, i)} className="opacity-60 hover:opacity-100">✕</button>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Planned session or generate buttons */}
              {session ? (
                <SessionPreview
                  session={session}
                  onRemove={() => removeSession(date)}
                />
              ) : !isPast ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => generateSession(date, "gym_upper")}
                    disabled={!!isGenerating}
                    className="flex-1 rounded-lg border border-dashed border-cardborder py-2 text-xs text-muted hover:border-accent/60 hover:text-accent disabled:opacity-40"
                  >
                    {generating === `${date}-gym_upper` ? "..." : "💪 Upper body"}
                  </button>
                  <button
                    onClick={() => generateSession(date, "gym_lower")}
                    disabled={!!isGenerating}
                    className="flex-1 rounded-lg border border-dashed border-cardborder py-2 text-xs text-muted hover:border-accent/60 hover:text-accent disabled:opacity-40"
                  >
                    {generating === `${date}-gym_lower` ? "..." : "🦵 Lower body"}
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Activity picker modal */}
      {pickerDay && (
        <ActivityPicker
          onPick={(a) => {
            addActivity(pickerDay, a);
            setPickerDay(null);
          }}
          onClose={() => setPickerDay(null)}
        />
      )}
    </div>
  );
}
