'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { PlannedSession } from '@coach/lib';

const intensityColor: Record<string, string> = {
  hard: 'bg-bad/20 text-bad',
  moderate: 'bg-warn/20 text-warn',
  easy: 'bg-good/20 text-good',
};

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
};

export function PlanSessionCard({
  session,
  gymDate,
  compact = false,
}: {
  session: PlannedSession;
  gymDate?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const icon = typeIcon[session.type] ?? '•';
  const hasDetails = !!session.details;

  // ── compact mode: icon + short title only, no expand ─────────────────
  if (compact) {
    const inner = (
      <div className="flex items-start gap-1">
        <span className="text-sm leading-tight">{icon}</span>
        <span className="truncate text-xs leading-tight text-muted">{session.title}</span>
      </div>
    );
    if (gymDate) {
      return (
        <Link href={gymDate} className="mt-1 block rounded hover:bg-white/5">
          {inner}
        </Link>
      );
    }
    if (hasDetails) {
      return (
        <div className="mt-1 cursor-pointer rounded hover:bg-white/5" onClick={() => setOpen((o) => !o)}>
          {inner}
          {open && (
            <p className="mt-1 border-t border-cardborder/30 pt-1 text-xs leading-relaxed text-muted">
              {session.details}
            </p>
          )}
        </div>
      );
    }
    return <div className="mt-1">{inner}</div>;
  }

  // ── full mode ─────────────────────────────────────────────────────────
  const header = (
    <div className="flex items-start gap-2">
      <span>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{session.title}</div>
        <div className="text-xs text-muted">
          {session.planned_at ? `${session.planned_at} · ` : ''}
          {session.duration_min ? `${session.duration_min} min` : ''}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {session.intensity && (
          <span className={`pill ${intensityColor[session.intensity] ?? 'bg-cardborder text-muted'}`}>
            {session.intensity}
          </span>
        )}
        {hasDetails && !gymDate && (
          <span className="text-xs text-muted">{open ? '▲' : '▼'}</span>
        )}
      </div>
    </div>
  );

  if (gymDate) {
    return (
      <Link href={gymDate} className="block rounded-lg p-1 hover:bg-white/5">
        {header}
      </Link>
    );
  }

  return (
    <div
      className={`rounded-lg p-1 ${hasDetails ? 'cursor-pointer hover:bg-white/5' : ''}`}
      onClick={() => hasDetails && setOpen((o) => !o)}
    >
      {header}
      {open && (
        <p className="mt-2 border-t border-cardborder/50 pt-2 text-xs leading-relaxed text-muted">
          {session.details}
        </p>
      )}
    </div>
  );
}
