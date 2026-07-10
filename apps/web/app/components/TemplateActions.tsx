"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function TemplateActions({ templateId, isActive }: { templateId: string; isActive: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    await fetch(`/api/templates/${templateId}/toggle`, { method: "PATCH" });
    router.refresh();
    setBusy(false);
  }

  async function remove() {
    if (!confirm("Delete this template? This cannot be undone.")) return;
    setBusy(true);
    await fetch(`/api/templates/${templateId}`, { method: "DELETE" });
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        onClick={toggle}
        disabled={busy}
        className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition ${
          isActive
            ? "border-cardborder text-muted hover:bg-white/5"
            : "border-accent/40 text-accent hover:bg-accent/10"
        }`}
      >
        {isActive ? "Archive" : "Activate"}
      </button>
      <button
        onClick={remove}
        disabled={busy}
        className="text-xs font-medium px-2 py-1.5 rounded-lg text-bad hover:bg-bad/10 transition"
      >
        ✕
      </button>
    </div>
  );
}
