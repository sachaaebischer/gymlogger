"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { SessionTemplate } from "@/lib/data-db";

export function GymStartButton({
  today,
  hasSession,
  sessionFinished = false,
  activeTemplates,
}: {
  today: string;
  hasSession: boolean;
  sessionFinished?: boolean;
  activeTemplates: SessionTemplate[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (hasSession && sessionFinished) {
    return (
      <Link
        href={`/gym/${today}`}
        className="flex items-center gap-4 rounded-2xl bg-card border border-cardborder p-4 active:scale-[0.98] transition"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-good/15">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00C980" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold">View today's session</div>
          <div className="text-sm text-muted">Tap to see results</div>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted shrink-0">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </Link>
    );
  }

  if (hasSession && !sessionFinished) {
    return (
      <Link
        href={`/gym/${today}`}
        className="flex items-center gap-4 rounded-2xl bg-good/10 border border-good/20 p-4 active:scale-[0.98] transition"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-good/20">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00D68F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-good">Session in progress</div>
          <div className="text-sm text-muted">Tap to continue</div>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted shrink-0">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </Link>
    );
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn text-lg font-black tracking-tight h-16">
        Start Training
      </button>

      {open && (
        <div className="fixed inset-0 z-30 flex flex-col justify-end bg-black/70" onClick={() => setOpen(false)}>
          <div
            className="rounded-t-3xl bg-card p-6 pb-10 space-y-3 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-cardborder" />
            <h2 className="text-xl font-black mb-5">Pick a template</h2>

            {activeTemplates.map((t) => (
              <button
                key={t.id}
                onClick={() => router.push(`/gym/${today}?template=${t.id}`)}
                className="flex w-full items-center gap-4 rounded-2xl bg-surface p-5 active:scale-[0.98] transition text-left"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C8FF00" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 4v6M18 4v6M4 7h4M16 7h4M8 12v8M16 12v8M10 15h4" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-base truncate">{t.name}</div>
                  <div className="text-xs text-muted mt-0.5">
                    {t.exercises.length} exercise{t.exercises.length !== 1 ? "s" : ""}
                  </div>
                </div>
              </button>
            ))}

            <button
              onClick={() => router.push(`/gym/${today}`)}
              className="flex w-full items-center gap-4 rounded-2xl border border-cardborder p-5 active:scale-[0.98] transition text-left"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/5">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="font-bold text-base">Blank session</div>
                <div className="text-xs text-muted mt-0.5">Add exercises as you go</div>
              </div>
            </button>

            <Link
              href="/gym/templates"
              className="block w-full text-center text-sm text-muted py-2 hover:text-fg"
              onClick={() => setOpen(false)}
            >
              Manage templates →
            </Link>
            <button onClick={() => setOpen(false)} className="w-full py-3 text-sm text-muted-fg">
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
