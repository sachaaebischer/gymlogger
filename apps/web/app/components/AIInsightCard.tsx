"use client";

import { useEffect, useState } from "react";

type Decision = {
  exercise_name: string;
  actual_performance: string;
  decision: "progress" | "maintain" | "regress";
  next_weight_kg?: number | null;
  reason: string;
};

type Analysis = {
  session_date: string;
  analyzed_at?: string;
  session_summary: string;
  exercise_decisions: Decision[];
  overall_recommendation: string;
};

export function AIInsightCard({ date, initialAnalysis }: { date: string; initialAnalysis: Analysis | null }) {
  const [analysis, setAnalysis] = useState<Analysis | null>(initialAnalysis);
  const [status, setStatus] = useState<"idle" | "waiting" | "done" | "failed">(
    initialAnalysis ? "done" : "waiting"
  );

  useEffect(() => {
    if (status !== "waiting") return;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetch(`/api/ai/analyze-session?date=${date}`);
        if (res.ok) {
          const data: Analysis = await res.json();
          setAnalysis(data);
          setStatus("done");
          return;
        }
      } catch {}
      attempts++;
      if (attempts < 40) {
        timer = setTimeout(poll, 3000);
      } else {
        setStatus("failed");
      }
    }

    timer = setTimeout(poll, 2000);
    return () => clearTimeout(timer);
  }, [date, status]);

  if (status === "waiting") {
    return (
      <div className="card flex items-center gap-3 text-sm text-muted">
        <span className="animate-pulse text-accent">✦</span>
        <span>AI coach is reviewing your session…</span>
      </div>
    );
  }

  if (status === "failed" || !analysis) return null;

  const arrowFor = (d: Decision["decision"]) =>
    d === "progress" ? "↑" : d === "regress" ? "↓" : "→";
  const colorFor = (d: Decision["decision"]) =>
    d === "progress" ? "text-good" : d === "regress" ? "text-bad" : "text-muted";

  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-accent text-sm">✦</span>
        <span className="text-xs uppercase tracking-wide text-muted font-semibold">AI Coach</span>
      </div>

      <p className="text-sm leading-relaxed">{analysis.session_summary}</p>

      {analysis.exercise_decisions.length > 0 && (
        <div className="divide-y divide-cardborder">
          {analysis.exercise_decisions.map((d) => (
            <div key={d.exercise_name} className="flex items-start gap-3 py-2.5">
              <span className={`mt-0.5 text-base font-bold w-5 shrink-0 ${colorFor(d.decision)}`}>
                {arrowFor(d.decision)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm font-medium">{d.exercise_name}</span>
                  {d.next_weight_kg != null && (
                    <span className="text-xs text-accent font-mono">→ {d.next_weight_kg}kg</span>
                  )}
                </div>
                <div className="text-xs text-muted mt-0.5">{d.actual_performance}</div>
                <div className="text-xs text-muted italic mt-0.5">{d.reason}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {analysis.overall_recommendation && (
        <div className="rounded-xl bg-accent/10 border border-accent/20 px-3 py-2 text-xs text-accent">
          💡 {analysis.overall_recommendation}
        </div>
      )}
    </div>
  );
}
