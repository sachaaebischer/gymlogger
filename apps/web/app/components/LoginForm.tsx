"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signIn("credentials", {
      email: email.toLowerCase().trim(),
      password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("Invalid email or password");
    } else {
      router.push("/gym");
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      {error && (
        <div className="rounded-xl bg-bad/10 border border-bad/30 px-3 py-2 text-sm text-bad">
          {error}
        </div>
      )}
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-wide text-muted">Email</label>
        <input
          type="email"
          required
          autoComplete="email"
          className="input w-full"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-wide text-muted">Password</label>
        <input
          type="password"
          required
          autoComplete="current-password"
          className="input w-full"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <button type="submit" disabled={loading} className="btn w-full">
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
