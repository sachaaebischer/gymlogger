import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { readSettings, getWeightOverrides } from "@/lib/data-db";
import { SettingsForm } from "@/app/components/SettingsForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [settings, overrides] = await Promise.all([readSettings(userId), getWeightOverrides(userId)]);

  return (
    <div className="pb-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black">Settings</h1>
        <div className="text-sm text-muted mt-0.5">{session.user.name ?? session.user.email}</div>
      </div>
      <SettingsForm initial={settings} weightOverrides={overrides} />
      <div className="mt-8 pt-6 border-t border-cardborder">
        <Link href="/settings/profile" className="btn-ghost w-full justify-center">
          Account &amp; password
        </Link>
      </div>
    </div>
  );
}
