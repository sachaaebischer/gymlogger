import { LoginForm } from "@/app/components/LoginForm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/gym");

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <div className="text-4xl mb-3">🏋️</div>
          <h1 className="text-2xl font-bold">Coach</h1>
          <p className="text-sm text-muted">Your AI-driven gym companion</p>
        </div>
        <LoginForm />
        <p className="text-center text-sm text-muted">
          No account?{" "}
          <a href="/register" className="text-accent hover:underline">
            Create one
          </a>
        </p>
      </div>
    </div>
  );
}
