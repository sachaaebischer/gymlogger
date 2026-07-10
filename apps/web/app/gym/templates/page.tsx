import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { seedTemplatesFromMesocycle } from "@/lib/data-db";
import { TemplateActions } from "@/app/components/TemplateActions";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const allTemplates = await seedTemplatesFromMesocycle(userId);
  const active = allTemplates.filter((t) => t.isActive);
  const archived = allTemplates.filter((t) => !t.isActive);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Templates</h1>
        <Link href="/gym/templates/new" className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-bg">
          + New
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Active</h2>
        {active.length === 0 ? (
          <div className="card text-sm text-muted text-center py-8">
            No active templates yet.{" "}
            <Link href="/gym/templates/new" className="text-accent underline">Create one</Link> to start a session from it.
          </div>
        ) : (
          active.map((t) => (
            <div key={t.id} className="card space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{t.name}</div>
                  <div className="text-xs text-muted mt-0.5">
                    {t.exercises.length} exercise{t.exercises.length !== 1 ? "s" : ""} · {t.createdAt.slice(0, 10)}
                  </div>
                </div>
                <TemplateActions templateId={t.id} isActive={t.isActive} />
              </div>
              {t.exercises.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {t.exercises.slice(0, 5).map((ex, i) => (
                    <span key={i} className="pill text-xs">{ex.name}</span>
                  ))}
                  {t.exercises.length > 5 && (
                    <span className="pill text-xs text-muted">+{t.exercises.length - 5} more</span>
                  )}
                </div>
              )}
              <Link href={`/gym/templates/${t.id}`} className="block text-center text-xs font-medium text-accent py-1">
                Edit template →
              </Link>
            </div>
          ))
        )}
      </section>

      {archived.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Archived</h2>
          {archived.map((t) => (
            <div key={t.id} className="card opacity-60 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{t.name}</div>
                  <div className="text-xs text-muted mt-0.5">
                    {t.exercises.length} exercise{t.exercises.length !== 1 ? "s" : ""} · {t.createdAt.slice(0, 10)}
                  </div>
                </div>
                <TemplateActions templateId={t.id} isActive={t.isActive} />
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
