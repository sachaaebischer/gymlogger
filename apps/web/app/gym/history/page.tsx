import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAllGymSessions } from "@/lib/data-db";
import Link from "next/link";
import { SessionDeleteButton } from "@/app/components/SessionDeleteButton";

export const dynamic = "force-dynamic";

function monthLabel(date: string) {
  const d = new Date(date + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const sessions = await getAllGymSessions(session.user.id);
  const finished = sessions.filter((s) => s.finished_at);
  const inProgress = sessions.filter((s) => s.started_at && !s.finished_at);

  // Group finished sessions by month
  const byMonth: Record<string, typeof finished> = {};
  for (const s of finished) {
    const m = monthLabel(s.date);
    (byMonth[m] ??= []).push(s);
  }
  const months = Object.keys(byMonth);

  return (
    <div className="pb-4">
      <h1 className="text-2xl font-black mb-6">Sessions</h1>

      {inProgress.length > 0 && (
        <div className="mb-6">
          <div className="label mb-3">In progress</div>
          <div className="space-y-1">
            {inProgress.map((s) => (
              <Link
                key={s.date}
                href={`/gym/${s.date}`}
                className="flex items-center justify-between rounded-2xl bg-good/5 border border-good/15 px-4 py-3 active:bg-good/10 transition"
              >
                <div>
                  <div className="font-semibold text-good">{s.name}</div>
                  <div className="text-xs text-muted-fg">{s.date}</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-good shrink-0">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      )}

      {months.length === 0 && !inProgress.length && (
        <div className="py-16 text-center text-muted-fg text-sm">No sessions yet. Start training!</div>
      )}

      <div className="space-y-6">
        {months.map((month) => (
          <div key={month}>
            <div className="label mb-3">{month}</div>
            <div className="space-y-1">
              {byMonth[month].map((s) => {
                const vol = s.exercises.reduce(
                  (sum, ex) => sum + ex.sets.filter((st) => st.done && st.weight && st.reps).reduce((a, st) => a + (st.weight! * st.reps!) / 1000, 0),
                  0
                );
                const sets = s.exercises.reduce((sum, ex) => sum + ex.sets.filter((st) => st.done).length, 0);
                return (
                  <div key={s.date} className="flex items-center gap-1 rounded-2xl bg-card pr-1 active:bg-surface transition">
                    <Link
                      href={`/gym/${s.date}`}
                      className="flex flex-1 items-center justify-between px-4 py-3 min-w-0"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{s.name}</div>
                        <div className="text-xs text-muted">{s.date}</div>
                      </div>
                      <div className="text-right text-xs text-muted shrink-0 ml-3">
                        <div>{sets} sets</div>
                        {vol > 0 && <div className="text-accent font-semibold">{vol.toFixed(1)}t</div>}
                      </div>
                    </Link>
                    <SessionDeleteButton date={s.date} />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
