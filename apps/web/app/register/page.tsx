import { RegisterForm } from "@/app/components/RegisterForm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) redirect("/gym");

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <div className="text-4xl mb-3">🏋️</div>
          <h1 className="text-2xl font-bold">Create account</h1>
          <p className="text-sm text-muted">Start tracking your training</p>
        </div>
        <RegisterForm />
        <p className="text-center text-sm text-muted">
          Already have an account?{" "}
          <a href="/login" className="text-accent hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
