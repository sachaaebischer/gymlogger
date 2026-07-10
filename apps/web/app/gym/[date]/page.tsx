import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getGymDayData, readSettings, getSessionAnalysis } from "@/lib/data-db";
import { GymLogger } from "@/app/components/GymLogger";
import { BackButton } from "@/app/components/BackButton";

export const dynamic = "force-dynamic";

export default async function GymDatePage({
  params,
  searchParams,
}: {
  params: { date: string };
  searchParams: { type?: string; template?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const { date } = params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return <div className="card text-bad">Invalid date.</div>;

  const sessionType = searchParams.type === "gym_upper" || searchParams.type === "gym_lower"
    ? searchParams.type
    : undefined;
  const templateId = searchParams.template;

  const [{ session: gymSession, lastPerf, hasSaved, catalog }, settings] = await Promise.all([
    getGymDayData(userId, date, sessionType, templateId),
    readSettings(userId),
  ]);

  const isFinished = !!gymSession.finished_at;
  const analysis = isFinished && settings.ai_session_analysis_enabled
    ? await getSessionAnalysis(userId, date)
    : null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <BackButton />
        <div className="min-w-0">
          <div className="font-bold truncate leading-tight">{gymSession.name}</div>
          <div className="text-xs text-muted">{date}{hasSaved ? " · saved" : ""}</div>
        </div>
      </div>
      <GymLogger
        initial={gymSession}
        lastPerf={lastPerf}
        catalog={catalog}
        defaultRestSecs={settings.rest_timer_default}
        templateId={templateId}
        aiAnalysisEnabled={settings.ai_session_analysis_enabled}
        initialAnalysis={analysis}
      />
    </div>
  );
}
