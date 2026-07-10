import { signOut } from "@/lib/auth";

export function LogoutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button
        type="submit"
        className="w-full rounded-xl border border-cardborder px-4 py-3 text-sm text-muted hover:bg-white/5 hover:text-fg transition text-left"
      >
        Sign out
      </button>
    </form>
  );
}
