"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GenerateMesocycleButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!confirm("Generate the next mesocycle with AI? Your current block will be replaced (a backup is kept).")) return;
    setState("generating");
    setError(null);
    try {
      const res = await fetch("/api/ai/mesocycle", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Unknown error"); setState("error"); return; }
      setState("done");
      setTimeout(() => { router.refresh(); }, 1500);
    } catch (e) {
      setError(String(e));
      setState("error");
    }
  }

  if (state === "generating") {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-sm text-muted-fg">
        <span className="animate-pulse text-accent">●</span>
        AI is building your next block — takes 30–60s
      </div>
    );
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl bg-good/10 border border-good/20 px-4 py-3 text-sm text-good font-medium">
        New block generated. Refreshing…
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="space-y-2">
        <div className="text-sm text-bad">Failed: {error}</div>
        <button onClick={() => setState("idle")} className="text-xs text-muted-fg underline">Try again</button>
      </div>
    );
  }

  return (
    <button onClick={generate} className="btn">
      Generate next block with AI
    </button>
  );
}
