import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { readMesocycle } from "@/lib/data-db";
import { MesocycleEditorForm } from "./MesocycleEditorForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function MesocycleEditPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const meso = await readMesocycle(session.user.id);

  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-center gap-3">
        <Link
          href="/gym"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-muted hover:bg-surface transition"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <h1 className="text-xl font-black">{meso ? "Edit block" : "New block"}</h1>
      </div>
      <MesocycleEditorForm initial={meso} />
    </div>
  );
}
