import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isUserAdmin, getAllUsers } from "@/lib/data-db";
import { AdminUserRow } from "@/app/components/AdminUserRow";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  if (!(await isUserAdmin(userId))) redirect("/gym");

  const users = await getAllUsers(userId);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <Link href="/gym" className="flex h-9 w-9 items-center justify-center rounded-xl border border-cardborder text-muted hover:bg-white/5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <h1 className="text-2xl font-black">Admin</h1>
      </div>

      <div className="card space-y-1">
        <div className="flex items-center gap-3 px-1 pb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted flex-1">User</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted w-16 text-center">Sessions</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted w-20 text-center">Joined</span>
          <span className="w-20" />
        </div>
        {users.map((u) => (
          <AdminUserRow key={u.id} user={u} currentUserId={userId} />
        ))}
      </div>

      <div className="card space-y-3">
        <div className="text-sm font-semibold">Invite new user</div>
        <p className="text-xs text-muted">Share the registration link. Users self-register at <code className="text-accent">/register</code>.</p>
        <Link href="/register" className="text-xs text-accent underline">Open registration page →</Link>
      </div>
    </div>
  );
}
