'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { PlannedSession } from '@coach/lib';

interface PlanDay {
  date: string;
  weekday: string;
  sessions: PlannedSession[];
}

interface Plan {
  week_start: string;
  days: PlanDay[];
}

const typeIcon: Record<string, string> = {
  gym: '🏋️',
  floorball: '🏑',
  floorball_training: '🏑',
  floorball_game: '🏑',
  bike: '🚴',
  cycling: '🚴',
  run: '🏃',
  running: '🏃',
  rest: '😴',
  swim: '🏊',
  tennis: '🎾',
  paddel: '🎾',
  other: '📅',
};

const intensityColor: Record<string, string> = {
  hard: 'text-bad',
  moderate: 'text-warn',
  easy: 'text-good',
};

function currentMondayStr(): string {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d.toLocaleDateString('sv');
}

function addWeeks(weekStart: string, n: number): string {
  const d = new Date(weekStart + 'T12:00:00');
  d.setDate(d.getDate() + n * 7);
  return d.toLocaleDateString('sv');
}

function SessionRow({ session, date }: { session: PlannedSession; date: string }) {
  const [open, setOpen] = useState(false);
  const icon = typeIcon[session.type] ?? '•';
  const isGym = session.type === 'gym';
  const hasDetails = !!session.details;

  const content = (
    <div className="flex items-start gap-2 py-1">
      <span className="mt-0.5 text-base leading-none">{icon}</span>
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium">{session.title}</span>
        {session.planned_at && (
          <span className="ml-2 text-xs text-muted">{session.planned_at}</span>
        )}
        {session.intensity && (
          <span className={`ml-2 text-xs ${intensityColor[session.intensity] ?? 'text-muted'}`}>
            {session.intensity}
          </span>
        )}
        {open && hasDetails && (
          <p className="mt-1 text-xs leading-relaxed text-muted">{session.details}</p>
        )}
      </div>
      {hasDetails && !isGym && (
        <button
          onClick={(e) => { e.preventDefault(); setOpen((o) => !o); }}
          className="shrink-0 text-xs text-muted"
        >
          {open ? '▲' : '▼'}
        </button>
      )}
    </div>
  );

  if (isGym) {
    return (
      <Link href={`/gym/${date}`} className="block rounded-lg hover:bg-white/5 active:bg-white/10 -mx-1 px-1">
        {content}
      </Link>
    );
  }

  return (
    <div
      className={hasDetails ? 'cursor-pointer rounded-lg -mx-1 px-1 hover:bg-white/5' : ''}
      onClick={() => hasDetails && setOpen((o) => !o)}
    >
      {content}
    </div>
  );
}

export function WeekPlanSection() {
  const [weekStart, setWeekStart] = useState(currentMondayStr);
  const [plan, setPlan] = useState<Plan | null | 'loading'>('loading');
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);
  const today = new Date().toLocaleDateString('sv');
  const thisMonday = currentMondayStr();

  useEffect(() => {
    fetch('/api/plan/week?week=list')
      .then((r) => r.json())
      .then((d) => setAvailableWeeks(d.weeks ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setPlan('loading');
    fetch(`/api/plan/week?week=${weekStart}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPlan(d))
      .catch(() => setPlan(null));
  }, [weekStart]);

  const hasPrev = availableWeeks.some((w) => w < weekStart);
  const hasNext = availableWeeks.some((w) => w > weekStart);
  const isCurrentWeek = weekStart === thisMonday;

  return (
    <div className="space-y-3">
      {/* Week navigation */}
      <div className="flex items-center gap-2">
        <h2 className="label flex-1">Week plan</h2>
        <button
          onClick={() => setWeekStart((w) => addWeeks(w, -1))}
          disabled={!hasPrev}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-white/5 disabled:opacity-25"
        >←</button>
        <span className="min-w-[88px] text-center text-xs text-muted">
          {weekStart}{isCurrentWeek ? ' · now' : ''}
        </span>
        <button
          onClick={() => setWeekStart((w) => addWeeks(w, 1))}
          disabled={!hasNext}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-white/5 disabled:opacity-25"
        >→</button>
        {!isCurrentWeek && (
          <button
            onClick={() => setWeekStart(thisMonday)}
            className="text-xs text-accent hover:underline"
          >today</button>
        )}
      </div>

      {/* Days */}
      {plan === 'loading' && (
        <div className="text-sm text-muted">Loading…</div>
      )}
      {plan === null && (
        <div className="text-sm text-muted">No plan for this week yet.</div>
      )}
      {plan && plan !== 'loading' && (
        <div className="space-y-1">
          {plan.days.map((day) => {
            const isToday = day.date === today;
            const isPast = day.date < today;
            return (
              <div
                key={day.date}
                className={`rounded-xl border px-3 py-2 ${
                  isToday
                    ? 'border-accent/60 bg-accent/5'
                    : isPast
                    ? 'border-cardborder/30 opacity-50'
                    : 'border-cardborder'
                }`}
              >
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-xs font-semibold">{day.weekday}</span>
                  <span className="text-xs text-muted">{day.date.slice(5)}</span>
                  {isToday && <span className="text-xs text-accent">today</span>}
                </div>
                {day.sessions.length === 0 ? (
                  <div className="text-xs text-muted">Rest</div>
                ) : (
                  day.sessions.map((s, i) => (
                    <SessionRow key={i} session={s} date={day.date} />
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
