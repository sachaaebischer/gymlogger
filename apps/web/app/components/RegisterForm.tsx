"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setError(null);
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: email.toLowerCase().trim(), password }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Registration failed");
      setLoading(false);
      return;
    }

    // Auto sign-in after registration
    const result = await signIn("credentials", {
      email: email.toLowerCase().trim(),
      password,
      redirect: false,
    });

    setLoading(false);
    if (result?.error) {
      setError("Account created but sign-in failed — try logging in");
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
        <label className="text-xs uppercase tracking-wide text-muted">Name</label>
        <input
          type="text"
          required
          autoComplete="name"
          className="input w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
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
          minLength={8}
          autoComplete="new-password"
          className="input w-full"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="text-xs text-muted">Minimum 8 characters</div>
      </div>
      <button type="submit" disabled={loading} className="btn w-full">
        {loading ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
