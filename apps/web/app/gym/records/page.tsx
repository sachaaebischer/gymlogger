import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPersonalRecords } from "@/lib/data-db";

export const dynamic = "force-dynamic";

export default async function RecordsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const prs = await getPersonalRecords(session.user.id);

  return (
    <div className="pb-6">
      <h1 className="text-2xl font-black mb-6">Personal Records</h1>
      {prs.length === 0 ? (
        <div className="py-16 text-center">
          <div className="text-sm text-muted">No records yet. Finish a session to set your first PR.</div>
        </div>
      ) : (
        <div className="space-y-1">
          {prs.map((pr) => (
            <div key={pr.exerciseName} className="flex items-center justify-between rounded-2xl bg-card px-4 py-3 gap-4">
              <div className="min-w-0">
                <div className="font-semibold truncate">{pr.exerciseName}</div>
                <div className="text-xs text-muted mt-0.5">{pr.achievedAt}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-bold text-accent">{pr.weight} kg × {pr.reps}</div>
                <div className="text-xs text-muted">{pr.e1rm.toFixed(1)} kg 1RM</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
