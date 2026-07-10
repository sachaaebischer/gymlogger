import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserById, isUserAdmin } from "@/lib/data-db";
import ProfileForm from "./ProfileForm";
import { LogoutButton } from "@/app/components/LogoutButton";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const [user, admin] = await Promise.all([getUserById(userId), isUserAdmin(userId)]);
  if (!user) redirect("/login");

  return (
    <div className="space-y-6 pb-8">
      <div className="text-xl font-bold">Profile</div>
      <ProfileForm name={user.name ?? ""} email={user.email} />
      <div className="space-y-3">
        {admin && (
          <Link
            href="/admin"
            className="flex w-full items-center gap-3 rounded-xl border border-accent/30 px-4 py-3 text-sm font-medium text-accent hover:bg-accent/10 transition"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/><path d="M12 8v4l3 3"/>
            </svg>
            Admin dashboard
          </Link>
        )}
        <LogoutButton />
      </div>
    </div>
  );
}
