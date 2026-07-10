"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Goal = "strength" | "hypertrophy" | "general";
type Experience = "beginner" | "intermediate" | "advanced";
type Days = 2 | 3 | 4;

const GOALS: { value: Goal; label: string; desc: string }[] = [
  { value: "strength", label: "Strength", desc: "Max lifts, low reps, heavy weight" },
  { value: "hypertrophy", label: "Hypertrophy", desc: "Muscle size, moderate reps & volume" },
  { value: "general", label: "General Fitness", desc: "Stay active, balanced training" },
];

const EXPERIENCE: { value: Experience; label: string; desc: string }[] = [
  { value: "beginner", label: "Beginner", desc: "Less than 1 year training" },
  { value: "intermediate", label: "Intermediate", desc: "1–3 years training" },
  { value: "advanced", label: "Advanced", desc: "3+ years training" },
];

const DAYS_OPTIONS: { value: Days; label: string }[] = [
  { value: 2, label: "2 days / week" },
  { value: 3, label: "3 days / week" },
  { value: 4, label: "4 days / week" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [experience, setExperience] = useState<Experience | null>(null);
  const [days, setDays] = useState<Days | null>(null);
  const [situation, setSituation] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setGenerating(true);
    setError(null);

    const prompt = [
      `Goal: ${goal}`,
      `Experience: ${experience}`,
      `Training days per week: ${days}`,
      situation ? `Additional context: ${situation}` : "",
    ].filter(Boolean).join(". ");

    try {
      // Save situation prompt
      if (situation || prompt) {
        await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ situation_prompt: prompt }),
        });
      }

      // Generate mesocycle
      const res = await fetch("/api/ai/mesocycle", { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "Generation failed. Please try again.");
        setGenerating(false);
        return;
      }
      router.push("/gym");
    } catch {
      setError("Network error. Please try again.");
      setGenerating(false);
    }
  }

  if (generating) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="text-4xl animate-pulse">🤖</div>
        <div>
          <h1 className="text-xl font-bold">Building your mesocycle</h1>
          <p className="text-sm text-muted mt-1">AI is generating a personalised training plan…</p>
        </div>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
        {error && (
          <div className="card border border-bad/30 text-sm text-bad max-w-sm">{error}</div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-10 max-w-sm mx-auto space-y-8">
      {/* Progress */}
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-cardborder"}`} />
        ))}
      </div>

      {/* Step 0: Goal */}
      {step === 0 && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">What&apos;s your goal?</h1>
            <p className="text-sm text-muted mt-1">We&apos;ll tailor your program around this.</p>
          </div>
          <div className="space-y-3">
            {GOALS.map((g) => (
              <button
                key={g.value}
                onClick={() => { setGoal(g.value); setStep(1); }}
                className={`w-full text-left card hover:bg-white/5 active:bg-white/10 border transition-colors ${goal === g.value ? "border-accent" : "border-transparent"}`}
              >
                <div className="font-semibold">{g.label}</div>
                <div className="text-sm text-muted mt-0.5">{g.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 1: Experience */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Training experience?</h1>
            <p className="text-sm text-muted mt-1">Sets the right starting weights and complexity.</p>
          </div>
          <div className="space-y-3">
            {EXPERIENCE.map((e) => (
              <button
                key={e.value}
                onClick={() => { setExperience(e.value); setStep(2); }}
                className={`w-full text-left card hover:bg-white/5 active:bg-white/10 border transition-colors ${experience === e.value ? "border-accent" : "border-transparent"}`}
              >
                <div className="font-semibold">{e.label}</div>
                <div className="text-sm text-muted mt-0.5">{e.desc}</div>
              </button>
            ))}
          </div>
          <button onClick={() => setStep(0)} className="text-sm text-muted hover:text-fg">← Back</button>
        </div>
      )}

      {/* Step 2: Days */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Days per week?</h1>
            <p className="text-sm text-muted mt-1">Upper/Lower split — be realistic with your schedule.</p>
          </div>
          <div className="space-y-3">
            {DAYS_OPTIONS.map((d) => (
              <button
                key={d.value}
                onClick={() => { setDays(d.value); setStep(3); }}
                className={`w-full text-left card hover:bg-white/5 active:bg-white/10 border transition-colors ${days === d.value ? "border-accent" : "border-transparent"}`}
              >
                <div className="font-semibold">{d.label}</div>
              </button>
            ))}
          </div>
          <button onClick={() => setStep(1)} className="text-sm text-muted hover:text-fg">← Back</button>
        </div>
      )}

      {/* Step 3: Context */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Anything else?</h1>
            <p className="text-sm text-muted mt-1">Optional — injuries, equipment, sport, preferences.</p>
          </div>
          <textarea
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder="e.g. I have a bad left shoulder, I compete in floorball, I prefer dumbbells"
            rows={4}
            className="w-full rounded-xl border border-cardborder bg-card p-3 text-sm text-fg placeholder:text-muted resize-none focus:outline-none focus:border-accent"
          />
          {error && <div className="text-sm text-bad">{error}</div>}
          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="text-sm text-muted hover:text-fg">← Back</button>
            <button
              onClick={generate}
              className="flex-1 rounded-xl bg-accent text-white font-semibold py-3 text-sm hover:bg-accent/90 active:bg-accent/80 transition-colors"
            >
              Generate my program
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
