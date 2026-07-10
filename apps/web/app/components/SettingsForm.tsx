"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Settings = {
  situation_prompt: string;
  rest_timer_default: number;
  ai_mesocycle_enabled: boolean;
  ai_session_analysis_enabled: boolean;
};

type WeightOverrides = Record<string, { next_weight_kg: number; reason: string; from_session_date?: string }>;

function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-cardborder last:border-0">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted mt-0.5">{desc}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
          checked ? "bg-accent" : "bg-cardborder"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-lg transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

export function SettingsForm({
  initial,
  weightOverrides,
}: {
  initial: Settings;
  weightOverrides: WeightOverrides;
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(initial.situation_prompt);
  const [restSecs, setRestSecs] = useState(initial.rest_timer_default);
  const [aiMesocycle, setAiMesocycle] = useState(initial.ai_mesocycle_enabled);
  const [aiAnalysis, setAiAnalysis] = useState(initial.ai_session_analysis_enabled);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [clearingWeights, setClearingWeights] = useState(false);

  const overrideCount = Object.keys(weightOverrides).length;

  async function save() {
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          situation_prompt: prompt,
          rest_timer_default: restSecs,
          ai_mesocycle_enabled: aiMesocycle,
          ai_session_analysis_enabled: aiAnalysis,
        }),
      });
      if (!res.ok) throw new Error();
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
      router.refresh();
    } catch {
      setSaveStatus("error");
    }
  }

  async function clearWeightOverrides() {
    if (!confirm("Clear all AI weight recommendations? The next session will use mesocycle defaults.")) return;
    setClearingWeights(true);
    try {
      await fetch("/api/settings/weight-overrides", { method: "DELETE" });
      router.refresh();
    } catch {}
    setClearingWeights(false);
  }

  const REST_OPTIONS = [60, 90, 120, 180];

  return (
    <div className="space-y-8">

      {/* Situation prompt */}
      <section className="space-y-3">
        <div>
          <h2 className="font-semibold">Situation prompt</h2>
          <p className="text-xs text-muted mt-0.5">
            Tell the AI about your current situation — goals, injuries, schedule constraints, sport context.
            Included in every session analysis and plan generation.
          </p>
        </div>
        <textarea
          className="input w-full min-h-[10rem] text-sm leading-relaxed resize-y"
          placeholder={"Example:\nI'm a floorball player in off-season. I want an upper/lower split 2× per week. I have mild right ankle instability so avoid heavy bilateral squat loads — prefer single-leg work. My main goal is building strength for the season starting in September."}
          value={prompt}
          onChange={(e) => { setPrompt(e.target.value); setSaveStatus("idle"); }}
        />
      </section>

      {/* Rest timer */}
      <section className="space-y-3">
        <div>
          <h2 className="font-semibold">Default rest timer</h2>
          <p className="text-xs text-muted mt-0.5">Time shown by default when you complete a set.</p>
        </div>
        <div className="flex gap-2">
          {REST_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => { setRestSecs(s); setSaveStatus("idle"); }}
              className={`flex-1 rounded-xl border py-3 text-sm font-medium transition-colors ${
                restSecs === s
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-cardborder text-muted hover:bg-white/5"
              }`}
            >
              {s < 60 ? `${s}s` : `${s / 60}m${s % 60 ? (s % 60) + "s" : ""}`}
            </button>
          ))}
        </div>
      </section>

      {/* AI Features */}
      <section className="space-y-3">
        <div>
          <h2 className="font-semibold">AI features</h2>
          <p className="text-xs text-muted mt-0.5">Toggle individual AI features on or off.</p>
        </div>
        <div className="card divide-y divide-cardborder p-0 overflow-hidden">
          <div className="px-4">
            <Toggle
              checked={aiMesocycle}
              onChange={(v) => { setAiMesocycle(v); setSaveStatus("idle"); }}
              label="Mesocycle generation"
              desc="AI generates your next training block when the current one ends"
            />
            <Toggle
              checked={aiAnalysis}
              onChange={(v) => { setAiAnalysis(v); setSaveStatus("idle"); }}
              label="Session analysis"
              desc="AI evaluates your performance after each session and updates weight targets"
            />
          </div>
        </div>
      </section>

      <button
        onClick={save}
        disabled={saveStatus === "saving"}
        className="btn"
      >
        {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved ✓" : saveStatus === "error" ? "Error — retry" : "Save settings"}
      </button>

      {/* Weight overrides */}
      <section className="space-y-3">
        <div>
          <h2 className="font-semibold">AI weight recommendations</h2>
          <p className="text-xs text-muted mt-0.5">
            After each session the AI sets target weights for next time. These override the mesocycle defaults.
          </p>
        </div>
        {overrideCount > 0 ? (
          <div className="space-y-3">
            <div className="divide-y divide-cardborder rounded-xl border border-cardborder overflow-hidden">
              {Object.entries(weightOverrides).map(([name, ov]) => (
                <div key={name} className="flex items-center justify-between px-3 py-2.5 text-sm">
                  <span>{name}</span>
                  <div className="text-right">
                    <div className="text-accent font-mono">{ov.next_weight_kg}kg</div>
                    <div className="text-xs text-muted">{ov.from_session_date ?? ""}</div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={clearWeightOverrides}
              disabled={clearingWeights}
              className="rounded-xl border border-bad/30 px-4 py-2 text-sm text-bad hover:bg-bad/10 w-full"
            >
              {clearingWeights ? "Clearing…" : "Clear all weight recommendations"}
            </button>
          </div>
        ) : (
          <div className="text-sm text-muted">No weight recommendations set yet. Finish a session to generate them.</div>
        )}
      </section>

    </div>
  );
}
