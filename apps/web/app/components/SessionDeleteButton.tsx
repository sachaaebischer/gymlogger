"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SessionDeleteButton({ date }: { date: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function del() {
    if (!confirm("Delete this session? This cannot be undone.")) return;
    setBusy(true);
    try {
      await fetch(`/api/gym/${date}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={del}
      disabled={busy}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted hover:text-bad hover:bg-bad/10 transition disabled:opacity-40"
      title="Delete session"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      </svg>
    </button>
  );
}
