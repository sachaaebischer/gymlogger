"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function TemplateImportButton({ templateId }: { templateId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleImport() {
    setLoading(true);
    const res = await fetch(`/api/gym/templates/${templateId}`, { method: "POST" });
    if (res.ok) {
      router.push("/gym");
    } else {
      setLoading(false);
      alert("Failed to import template.");
    }
  }

  return (
    <button
      onClick={handleImport}
      disabled={loading}
      className="w-full rounded-xl bg-accent/20 border border-accent/30 py-2.5 text-sm font-semibold text-accent hover:bg-accent/30 disabled:opacity-50"
    >
      {loading ? "Importing…" : "Use this template"}
    </button>
  );
}
