import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTemplate, readExerciseCatalog } from "@/lib/data-db";
import { TemplateEditor } from "@/app/components/TemplateEditor";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TemplateEditorPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [template, catalog] = await Promise.all([
    getTemplate(userId, params.id),
    readExerciseCatalog(userId),
  ]);

  if (!template) {
    return (
      <div className="card text-center py-12 space-y-4">
        <div className="text-muted">Template not found.</div>
        <Link href="/gym/templates" className="text-accent text-sm">← Back to templates</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center gap-3">
        <Link href="/gym/templates" className="flex h-9 w-9 items-center justify-center rounded-xl border border-cardborder text-muted hover:bg-white/5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <h1 className="text-xl font-black">Edit Template</h1>
      </div>
      <TemplateEditor template={template} catalog={catalog} />
    </div>
  );
}
