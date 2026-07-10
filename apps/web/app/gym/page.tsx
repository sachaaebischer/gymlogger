import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { readMesocycle, getMesocycleProgress, todayStr, getRecentGymSessions, getActiveTemplates, seedTemplatesFromMesocycle, readSettings } from "@/lib/data-db";
import { getMesocycleStatus } from "@/lib/ai-coach-db";
import { GymStartButton } from "@/app/components/GymStartButton";
import { GenerateMesocycleButton } from "@/app/components/GenerateMesocycleButton";

export const dynamic = "force-dynamic";

export default async function GymIndexPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const today = todayStr();
  const [mesocycle, recent, mesoStatus, settings] = await Promise.all([
    readMesocycle(userId),
    getRecentGymSessions(userId, 1),
    getMesocycleStatus(userId),
    readSettings(userId),
  ]);

  await seedTemplatesFromMesocycle(userId);
  const activeTemplates = await getActiveTemplates(userId);

  const hasSession = recent.some((s) => s.date === today);
  const progress = mesocycle ? getMesocycleProgress(mesocycle) : null;
  const showEnded = mesoStatus.ended;
  const showWarning = mesoStatus.active && (mesoStatus.daysLeft ?? 99) <= 7 && !showEnded;
  const aiMeso = settings.ai_mesocycle_enabled;

  const dayOfWeek = new Date().toLocaleDateString("en-US", { weekday: "long" });

  return (
    <div className="flex flex-col gap-5 pb-4">

      {/* Header */}
      <div>
        <div className="label mb-1">{dayOfWeek}</div>
        <h1 className="text-3xl font-black tracking-tight">
          {hasSession ? "Session logged" : "Ready to train"}
        </h1>
      </div>

      {/* Block ended */}
      {showEnded && (
        <div className="card border border-bad/20 space-y-4">
          <div>
            <div className="label mb-1">Block complete</div>
            <div className="font-bold">{mesoStatus.name}</div>
            <div className="text-sm text-muted mt-0.5">Ended {mesoStatus.endDate}</div>
          </div>
          {aiMeso ? (
            <GenerateMesocycleButton />
          ) : (
            <Link href="/gym/mesocycle" className="btn">
              Create new block
            </Link>
          )}
        </div>
      )}

      {/* Ending soon warning */}
      {showWarning && !showEnded && (
        <div className="card border border-accent/15 space-y-4">
          <div>
            <div className="label mb-1" style={{ color: "#C8FF00" }}>
              {mesoStatus.daysLeft === 0 ? "Ends today" : `${mesoStatus.daysLeft} days left`}
            </div>
            <div className="font-bold">{mesoStatus.name}</div>
          </div>
          {aiMeso && <GenerateMesocycleButton />}
        </div>
      )}

      {/* Mesocycle progress card */}
      {mesocycle && progress && !showEnded && (
        <div className="card space-y-5">
          <div className="flex items-start justify-between">
            <div className="space-y-0.5">
              <div className="label">Current block</div>
              <div className="text-base font-bold leading-snug">{mesocycle.name}</div>
              <div className="text-xs text-muted capitalize">{mesocycle.phase}</div>
            </div>
            <div className="flex items-start gap-3">
              <Link href="/gym/mesocycle" className="text-xs text-muted hover:text-accent transition mt-0.5">
                Edit
              </Link>
              <div className="text-right">
                <div className="text-5xl font-black text-accent leading-none tracking-tight">
                  {progress.currentWeek}
                </div>
                <div className="text-xs text-muted mt-1">of {progress.totalWeeks} weeks</div>
              </div>
            </div>
          </div>
          {/* Progress bar */}
          <div>
            <div className="h-1 rounded-full bg-white/[0.06]">
              <div
                className="h-1 rounded-full bg-accent transition-all"
                style={{ width: `${progress.progressPct}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-muted/50">
              <span>{mesocycle.start_date}</span>
              <span>{progress.progressPct}%</span>
              <span>{mesocycle.end_date}</span>
            </div>
          </div>
        </div>
      )}

      {!mesocycle && !showEnded && (
        <div className="card space-y-4 text-center py-8">
          <div className="text-muted text-sm">No active training block</div>
          {aiMeso ? (
            <GenerateMesocycleButton />
          ) : (
            <Link href="/gym/mesocycle" className="btn">
              Create block
            </Link>
          )}
        </div>
      )}

      {/* Start training */}
      <GymStartButton today={today} hasSession={hasSession} activeTemplates={activeTemplates} />
    </div>
  );
}
