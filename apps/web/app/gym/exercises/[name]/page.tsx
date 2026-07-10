import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getExerciseHistory, getPersonalRecords } from "@/lib/data-db";
import { ExerciseProgressChart } from "@/app/components/ExerciseProgressChart";
import { BackButton } from "@/app/components/BackButton";

export const dynamic = "force-dynamic";

function epley1RM(weight: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

function isBW(name: string): boolean {
  const n = name.toLowerCase();
  return (n.includes("pull-up") || n.includes("chin-up") || (n.includes("dip") && !n.includes("weighted")));
}

export default async function ExerciseHistoryPage({ params }: { params: { name: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const name = decodeURIComponent(params.name);

  const [history, allPRs] = await Promise.all([
    getExerciseHistory(userId, name),
    getPersonalRecords(userId),
  ]);

  const pr = allPRs.find((r) => r.exerciseName === name);
  const prE1rm = pr ? pr.e1rm : null;

  const bw = isBW(name);

  const chartPoints = history
    .map((entry) => {
      const done = entry.sets.filter((s) => s.reps && s.reps > 0);
      if (!done.length) return null;
      if (bw) {
        const maxReps = Math.max(...done.map((s) => s.reps!));
        return { date: entry.date, value: maxReps, label: `${maxReps} reps` };
      }
      const best = done
        .filter((s) => s.weight != null)
        .map((s) => ({ est1rm: epley1RM(s.weight!, s.reps!), s }))
        .sort((a, b) => b.est1rm - a.est1rm)[0];
      if (!best) return null;
      return {
        date: entry.date,
        value: best.est1rm,
        label: `${best.est1rm} kg (${best.s.weight}x${best.s.reps})`,
      };
    })
    .filter(Boolean) as { date: string; value: number; label: string }[];

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <BackButton />
        <h1 className="font-semibold truncate">{name}</h1>
        {pr && <span className="ml-auto text-xs text-yellow-400 font-semibold shrink-0">🏆 {pr.e1rm.toFixed(1)} kg 1RM</span>}
      </div>

      {chartPoints.length >= 2 && (
        <section className="card">
          <div className="mb-1 text-xs text-muted uppercase tracking-wide">
            {bw ? "Max reps progression" : "Estimated 1RM progression (Epley)"}
          </div>
          <ExerciseProgressChart points={chartPoints} unit={bw ? "reps" : "kg"} prValue={prE1rm} />
          <div className="mt-2 flex justify-between text-xs">
            <span className="text-muted">Start: <span className="text-fg">{chartPoints[chartPoints.length - 1].value} {bw ? "reps" : "kg"}</span></span>
            <span className="text-muted">Latest: <span className="text-accent font-semibold">{chartPoints[0].value} {bw ? "reps" : "kg"}</span></span>
          </div>
        </section>
      )}

      {chartPoints.length === 1 && (
        <div className="card text-sm text-muted">Only one session logged — chart needs at least 2 data points.</div>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted">All sessions ({history.length})</h2>
        <div className="space-y-2">
          {history.map((entry) => {
            const done = entry.sets.filter((s) => s.reps && s.reps > 0);
            const best = bw
              ? done.length ? Math.max(...done.map((s) => s.reps!)) : null
              : done.filter((s) => s.weight != null).length
              ? Math.max(...done.filter((s) => s.weight != null).map((s) => epley1RM(s.weight!, s.reps!)))
              : null;
            return (
              <div key={entry.date} className="card">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-medium text-sm">
                      {new Date(entry.date + "T12:00:00").toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}
                    </div>
                    <div className="text-xs text-muted">{entry.date}</div>
                  </div>
                  <div className="flex items-start gap-3 shrink-0 ml-3">
                    {best != null && (
                      <div className="text-right">
                        <div className="text-accent font-semibold">{best} {bw ? "reps" : "kg"}</div>
                        <div className="text-xs text-muted">{bw ? "max reps" : "est. 1RM"}</div>
                      </div>
                    )}
                    <Link
                      href={`/gym/${entry.date}`}
                      className="rounded-xl border border-cardborder px-2.5 py-1.5 text-xs text-muted hover:text-accent hover:border-accent/50 whitespace-nowrap"
                    >
                      View →
                    </Link>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {entry.sets.map((s, i) => (
                    <span key={i} className="rounded-lg bg-cardborder/50 px-2 py-1 text-xs">
                      {s.weight != null ? `${s.weight}kg` : "BW"}x{s.reps ?? "–"}{s.rpe != null ? ` @${s.rpe}` : ""}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          {history.length === 0 && (
            <div className="card text-sm text-muted">No logged sets for this exercise yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}
