import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { paths } from "@coach/lib";
import type { GymSession } from "@coach/lib";
import {
  readMesocycle,
  getAllGymSessions,
  type Mesocycle,
  type MesocycleExercise,
} from "./data";
import { readSettings } from "./settings";

const MODEL = "google/gemini-2.5-flash";

async function situationContext(): Promise<string> {
  try {
    const s = await readSettings();
    return s.situation_prompt?.trim()
      ? `\n\nCURRENT ATHLETE SITUATION (always factor this in):\n${s.situation_prompt.trim()}`
      : "";
  } catch { return ""; }
}

// ── Raw AI call ───────────────────────────────────────────────────────────────

async function callAI(system: string, user: string): Promise<string | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) { console.error("[ai-coach] OPENROUTER_API_KEY not set"); return null; }
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": "https://coach.local",
        "X-Title": "Gym Coach",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.3,
        max_tokens: 4096,
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) { console.error("[ai-coach] API error:", res.status, await res.text()); return null; }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : null;
  } catch (e) {
    console.error("[ai-coach] fetch error:", e);
    return null;
  }
}

function extractJson(raw: string): unknown {
  try { return JSON.parse(raw); } catch {}
  const block = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (block) try { return JSON.parse(block[1]); } catch {}
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end > start) try { return JSON.parse(raw.slice(start, end + 1)); } catch {}
  return null;
}

// ── Weight overrides ──────────────────────────────────────────────────────────

const WeightOverrideSchema = z.object({
  next_weight_kg: z.number().min(0).max(500),
  reason: z.string(),
  from_session: z.string(),
  updated_at: z.string(),
});

export type WeightOverride = z.infer<typeof WeightOverrideSchema>;
const WeightOverridesSchema = z.record(z.string(), WeightOverrideSchema);
export type WeightOverrides = z.infer<typeof WeightOverridesSchema>;

const overridesPath = () => path.join(paths.data(), "gym", "weight_overrides.json");

export async function getWeightOverrides(): Promise<WeightOverrides> {
  try {
    const raw = await fs.readFile(overridesPath(), "utf-8");
    return WeightOverridesSchema.parse(JSON.parse(raw));
  } catch { return {}; }
}

async function saveWeightOverrides(overrides: WeightOverrides): Promise<void> {
  await fs.writeFile(overridesPath(), JSON.stringify(overrides, null, 2), "utf-8");
}

// ── Session analysis ──────────────────────────────────────────────────────────

const ExerciseDecisionSchema = z.object({
  exercise_name: z.string(),
  actual_performance: z.string(),
  decision: z.enum(["progress", "maintain", "regress"]),
  next_weight_kg: z.number().nullable().optional(),
  reason: z.string(),
});

export const SessionAnalysisSchema = z.object({
  session_date: z.string(),
  analyzed_at: z.string(),
  session_summary: z.string(),
  exercise_decisions: z.array(ExerciseDecisionSchema),
  overall_recommendation: z.string(),
});

export type SessionAnalysis = z.infer<typeof SessionAnalysisSchema>;

const analysisDir = () => path.join(paths.data(), "gym", "ai_analysis");

export async function getSessionAnalysis(date: string): Promise<SessionAnalysis | null> {
  try {
    const raw = await fs.readFile(path.join(analysisDir(), `${date}.json`), "utf-8");
    return SessionAnalysisSchema.parse(JSON.parse(raw));
  } catch { return null; }
}

async function saveSessionAnalysis(a: SessionAnalysis): Promise<void> {
  await fs.mkdir(analysisDir(), { recursive: true });
  await fs.writeFile(path.join(analysisDir(), `${a.session_date}.json`), JSON.stringify(a, null, 2), "utf-8");
}

export async function analyzeSession(date: string): Promise<SessionAnalysis | null> {
  // Return cached if already analyzed
  const cached = await getSessionAnalysis(date);
  if (cached) return cached;

  const [mesocycle, allSessions] = await Promise.all([readMesocycle(), getAllGymSessions()]);
  const session = allSessions.find((s) => s.date === date);
  if (!session) return null;

  const recentSessions = allSessions
    .filter((s) => s.date !== date && s.date < date)
    .slice(0, 5)
    .map((s) => ({
      date: s.date,
      exercises: s.exercises.map((ex) => ({
        name: ex.name,
        done_sets: ex.sets.filter((st) => st.done).map((st) => ({ w: st.weight, r: st.reps, rpe: st.rpe })),
      })),
    }));

  const situation = await situationContext();
  const system = `You are an expert strength & conditioning coach AI. Analyze gym sessions and determine weight adjustments.

RULES:
- Only include exercises that have at least one done=true set
- progress: all target sets/reps completed, RPE <= 8.5 → increase by weekly_increment_kg
- maintain: borderline completion or RPE 8.5–9 → same weight
- regress: failed sets or RPE > 9 → reduce by one increment
- For bodyweight exercises set next_weight_kg to null
- Round weights to nearest 0.25kg for DBs, 1.25kg for barbells
- Be conservative — slightly too light beats crashing progression
- Max single-session change: +5kg, -10kg (hard limit, even if AI says more)

Output ONLY valid JSON, no markdown, no explanation.${situation}`;

  const user = `SESSION:
${JSON.stringify({
  date: session.date,
  name: session.name,
  exercises: session.exercises.map((ex) => ({
    name: ex.name,
    target: `${ex.target_sets ?? "?"}x${ex.target_reps ?? "?"}`,
    sets: ex.sets.map((s) => ({ ...s })),
  })),
}, null, 2)}

MESOCYCLE EXERCISES:
${mesocycle ? JSON.stringify(mesocycle.exercises, null, 2) : "none"}

RECENT SESSIONS (context):
${JSON.stringify(recentSessions, null, 2)}

Output JSON:
{
  "session_summary": "2-3 sentence assessment",
  "exercise_decisions": [
    {
      "exercise_name": "exact name",
      "actual_performance": "e.g. 3x8 @39kg",
      "decision": "progress|maintain|regress",
      "next_weight_kg": 40.25,
      "reason": "brief reason"
    }
  ],
  "overall_recommendation": "1 sentence for next session"
}`;

  const raw = await callAI(system, user);
  if (!raw) return null;

  const parsed = extractJson(raw);
  if (!parsed) { console.error("[ai-coach] no JSON in response:", raw.slice(0, 300)); return null; }

  const partial = z.object({
    session_summary: z.string(),
    exercise_decisions: z.array(ExerciseDecisionSchema),
    overall_recommendation: z.string(),
  }).safeParse(parsed);

  if (!partial.success) { console.error("[ai-coach] validation:", partial.error.issues); return null; }

  const analysis: SessionAnalysis = {
    session_date: date,
    analyzed_at: new Date().toISOString(),
    ...partial.data,
  };

  // Save analysis to disk
  await saveSessionAnalysis(analysis);

  // Update weight overrides with safety bounds
  const overrides = await getWeightOverrides();
  for (const d of analysis.exercise_decisions) {
    if (d.next_weight_kg == null) continue;
    const ex = session.exercises.find((e) => e.name === d.exercise_name);
    if (!ex) continue;
    const weights = ex.sets.filter((s) => s.done && s.weight != null).map((s) => s.weight!);
    if (!weights.length) continue;
    const current = Math.max(...weights);
    const bounded = Math.min(current + 5, Math.max(current - 10, d.next_weight_kg));
    overrides[d.exercise_name] = {
      next_weight_kg: Math.round(bounded * 4) / 4,
      reason: d.reason,
      from_session: date,
      updated_at: new Date().toISOString(),
    };
  }
  await saveWeightOverrides(overrides);

  return analysis;
}

// ── Mesocycle status ──────────────────────────────────────────────────────────

export async function getMesocycleStatus(): Promise<{
  active: boolean;
  name: string | null;
  endDate: string | null;
  daysLeft: number | null;
  ended: boolean;
}> {
  const meso = await readMesocycle();
  if (!meso) return { active: false, name: null, endDate: null, daysLeft: null, ended: false };
  const now = new Date();
  const end = new Date(meso.end_date + "T23:59:59");
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
  return { active: true, name: meso.name, endDate: meso.end_date, daysLeft, ended: daysLeft < 0 };
}

// ── Mesocycle generation ──────────────────────────────────────────────────────

const MesocycleExerciseAISchema = z.object({
  name: z.string().min(1),
  sets: z.number().int().min(1).max(10),
  reps: z.union([z.number().int().min(1).max(50), z.string()]),
  target_rpe: z.number().min(5).max(10).optional(),
  weekly_increment_kg: z.number().min(0).max(10).optional(),
  start_weight_kg: z.number().min(0).max(500).nullable().optional(),
  unit: z.string().optional(),
  note: z.string().optional(),
  config: z.string().optional(),
});

const MesocycleAIOutputSchema = z.object({
  name: z.string().min(1),
  goal: z.string().min(5),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  phase: z.string().min(1),
  weekly_structure: z.record(z.string(), z.string()),
  exercises: z.object({
    gym_upper: z.record(z.string(), MesocycleExerciseAISchema).optional(),
    gym_lower: z.record(z.string(), MesocycleExerciseAISchema).optional(),
  }),
  rules: z.object({
    progression_trigger: z.string(),
    regression_trigger_rpe: z.number().min(7).max(10),
  }),
  warmup_protocol: z.object({
    gym_sessions: z.array(z.string()),
    note: z.string(),
  }).optional(),
});

export async function generateNextMesocycle(): Promise<{
  success: boolean;
  error?: string;
}> {
  const [currentMeso, allSessions] = await Promise.all([readMesocycle(), getAllGymSessions()]);

  // Gather recent AI analyses for context
  const recentAnalyses: SessionAnalysis[] = [];
  for (const s of allSessions.slice(0, 10)) {
    const a = await getSessionAnalysis(s.date);
    if (a) recentAnalyses.push(a);
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 27);
  const startIso = startDate.toISOString().slice(0, 10);
  const endIso = endDate.toISOString().slice(0, 10);

  const situation = await situationContext();
  const system = `You are an expert strength & conditioning coach. Create 4-week mesocycle plans.

ATHLETE: Sacha, intermediate lifter, floorball player (off-season)
- Has right ankle instability → prioritize single-leg stability exercises
- Schedule: Mon/Thu flexible gym days; Wed+Fri floorball; Tue/Sat/Sun flexible
- Goal: strength for floorball performance
- Style: RPE-based progression, 3-4 sets, 6-10 reps for main lifts

PRINCIPLES:
- Small progressive overload: 1.25-2.5kg/week per exercise
- Push/pull balance in upper sessions
- Single-leg dominant in lower sessions
- RPE 7-8 for primary, 7 for accessories
- Use ACTUAL weights from recent sessions as start_weight_kg

Output ONLY valid JSON. No markdown. No explanation outside JSON.${situation}`;

  const user = `Create the next mesocycle starting ${startIso}.

COMPLETED MESOCYCLE:
${currentMeso ? JSON.stringify(currentMeso, null, 2) : "none"}

RECENT SESSIONS (use these ACTUAL weights as start_weight_kg):
${JSON.stringify(allSessions.slice(0, 8).map((s) => ({
  date: s.date,
  name: s.name,
  exercises: s.exercises.map((ex) => ({
    name: ex.name,
    done_sets: ex.sets.filter((st) => st.done).map((st) => ({ w: st.weight, r: st.reps, rpe: st.rpe })),
  })),
})), null, 2)}

AI ANALYSIS NOTES:
${recentAnalyses.slice(0, 5).map((a) => `${a.session_date}: ${a.session_summary}`).join("\n") || "none"}

Output JSON (exact structure — keep same exercise slot format A1/B1/C1 etc):
{
  "name": "Mesocycle N — Phase Name",
  "goal": "Specific performance goal",
  "start_date": "${startIso}",
  "end_date": "${endIso}",
  "phase": "accumulation|intensification|realization",
  "weekly_structure": { "mon": "gym_upper", "tue": "rest", "wed": "floorball", "thu": "gym_lower", "fri": "floorball", "sat": "active_recovery", "sun": "rest" },
  "rules": { "progression_trigger": "all_sets_completed_as_planned", "regression_trigger_rpe": 9 },
  "warmup_protocol": { "gym_sessions": ["Exercise 1", "Exercise 2"], "note": "Note" },
  "exercises": {
    "gym_upper": {
      "A1": { "name": "Exercise", "sets": 4, "reps": 8, "target_rpe": 7.5, "weekly_increment_kg": 1.25, "start_weight_kg": 40.0, "note": "Cue" }
    },
    "gym_lower": {
      "A1": { "name": "Exercise", "sets": 4, "reps": 6, "target_rpe": 7.5, "weekly_increment_kg": 2.5, "start_weight_kg": 80.0 }
    }
  }
}`;

  const raw = await callAI(system, user);
  if (!raw) return { success: false, error: "AI did not respond" };

  const parsed = extractJson(raw);
  if (!parsed) return { success: false, error: "AI response was not valid JSON" };

  const result = MesocycleAIOutputSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    console.error("[ai-coach] mesocycle validation:", issues);
    return { success: false, error: `Validation failed: ${issues.slice(0, 200)}` };
  }

  const newMeso = result.data;
  const durationDays = (new Date(newMeso.end_date).getTime() - new Date(newMeso.start_date).getTime()) / 86_400_000;
  if (durationDays < 7) return { success: false, error: "Generated mesocycle too short" };
  if (durationDays > 150) return { success: false, error: "Generated mesocycle too long" };

  // Backup current before overwriting
  const mesoPath = path.join(paths.data(), "plan", "mesocycle.json");
  try {
    const bak = path.join(paths.data(), "plan", `mesocycle.${new Date().toISOString().slice(0, 10)}.bak.json`);
    await fs.copyFile(mesoPath, bak);
  } catch { /* no existing file to backup */ }

  await fs.writeFile(mesoPath, JSON.stringify(newMeso, null, 2), "utf-8");
  // Clear weight overrides — fresh start for new mesocycle
  await saveWeightOverrides({});

  return { success: true };
}

// ── Pre-session briefing ──────────────────────────────────────────────────────

const briefingsDir = () => path.join(paths.data(), "gym", "ai_briefings");

export interface SessionBriefing {
  session_date: string;
  generated_at: string;
  note: string;
}

export async function getSessionBriefing(date: string): Promise<SessionBriefing | null> {
  try {
    const raw = await fs.readFile(path.join(briefingsDir(), `${date}.json`), "utf-8");
    return JSON.parse(raw) as SessionBriefing;
  } catch { return null; }
}

export async function briefSession(date: string, sessionName: string): Promise<SessionBriefing | null> {
  const cached = await getSessionBriefing(date);
  if (cached) return cached;

  const [mesocycle, allSessions] = await Promise.all([readMesocycle(), getAllGymSessions()]);
  const situation = await situationContext();

  // Find last session of same type
  const sameType = allSessions.filter(
    (s) => s.date < date && s.name === sessionName
  ).slice(0, 3);

  const recentAll = allSessions.filter((s) => s.date < date).slice(0, 3);

  const system = `You are a concise strength coach giving a pre-session briefing to an athlete.
Write 2-3 SHORT sentences only. Focus on: what weights to aim for today, one performance note from last session, and one tactical cue.
Be direct and motivating. Use specific numbers. No fluff. No headers. Just the coaching note.${situation}`;

  const user = `Today's session: ${sessionName} on ${date}

LAST TIME THIS SESSION:
${sameType.length ? JSON.stringify(sameType[0].exercises.map((ex) => ({
  name: ex.name,
  sets: ex.sets.filter((s) => s.done).map((s) => ({ w: s.weight, r: s.reps, rpe: s.rpe })),
})), null, 2) : "No previous session of this type found"}

RECENT SESSIONS (last 3):
${JSON.stringify(recentAll.map((s) => ({
  date: s.date,
  name: s.name,
  volume: s.exercises.reduce((sum, ex) => sum + ex.sets.filter((st) => st.done).length, 0) + " sets done",
})), null, 2)}

PLANNED EXERCISES TODAY:
${mesocycle ? JSON.stringify(
  sessionName.includes("Upper")
    ? mesocycle.exercises.gym_upper
    : mesocycle.exercises.gym_lower
  , null, 2) : "No mesocycle"}

Write a 2-3 sentence pre-session coaching note (plain text, no JSON):`;

  const raw = await callAI(system, user);
  if (!raw || raw.length < 10) return null;

  const briefing: SessionBriefing = {
    session_date: date,
    generated_at: new Date().toISOString(),
    note: raw.trim(),
  };

  await fs.mkdir(briefingsDir(), { recursive: true });
  await fs.writeFile(
    path.join(briefingsDir(), `${date}.json`),
    JSON.stringify(briefing, null, 2),
    "utf-8"
  );

  return briefing;
}
