import "server-only";
import { z } from "zod";
import {
  readMesocycle, writeMesocycle, getAllGymSessions, readSettings, readExerciseCatalog,
  getWeightOverrides, saveWeightOverrides, getSessionAnalysis, saveSessionAnalysis,
  getSessionBriefing, saveSessionBriefing, getPersonalRecords,
  type Mesocycle, type SessionAnalysis, type SessionBriefing,
} from "./data-db";

const MODEL = "google/gemini-2.5-flash";

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
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        temperature: 0.3,
        max_tokens: 4096,
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) { console.error("[ai-coach] API error:", res.status, await res.text()); return null; }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : null;
  } catch (e) { console.error("[ai-coach] fetch:", e); return null; }
}

function extractJson(raw: string): unknown {
  try { return JSON.parse(raw); } catch {}
  const block = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (block) try { return JSON.parse(block[1]); } catch {}
  const start = raw.indexOf("{"); const end = raw.lastIndexOf("}");
  if (start !== -1 && end > start) try { return JSON.parse(raw.slice(start, end + 1)); } catch {}
  return null;
}

async function situationContext(userId: string): Promise<string> {
  try {
    const s = await readSettings(userId);
    return s.situation_prompt?.trim()
      ? `\n\nCURRENT ATHLETE SITUATION (always factor this in):\n${s.situation_prompt.trim()}`
      : "";
  } catch { return ""; }
}

// ── Session analysis ──────────────────────────────────────────────────────────

const ExerciseDecisionSchema = z.object({
  exercise_name: z.string(),
  actual_performance: z.string(),
  decision: z.enum(["progress", "maintain", "regress"]),
  next_weight_kg: z.number().nullable().optional(),
  reason: z.string(),
});

export async function analyzeSession(userId: string, date: string): Promise<SessionAnalysis | null> {
  const cached = await getSessionAnalysis(userId, date);
  if (cached) return cached;

  const [meso, allSessions] = await Promise.all([readMesocycle(userId), getAllGymSessions(userId)]);
  const session = allSessions.find((s) => s.date === date);
  if (!session) return null;

  const situation = await situationContext(userId);
  const recent = allSessions.filter((s) => s.date !== date && s.date < date).slice(0, 5);

  const system = `You are an expert strength coach AI. Analyze gym sessions and determine weight adjustments.
RULES: Only include exercises with done=true sets. progress if all sets/reps complete and RPE<=8.5, maintain if borderline, regress if failed. Bodyweight exercises: next_weight_kg=null. Round weights to 0.25kg. Max change: +5kg/-10kg per session.
Output ONLY valid JSON.${situation}`;

  const user = `SESSION: ${JSON.stringify({ date: session.date, name: session.name, exercises: session.exercises.map((ex) => ({ name: ex.name, target: `${ex.target_sets}x${ex.target_reps}`, sets: ex.sets })) }, null, 2)}
MESOCYCLE EXERCISES: ${meso ? JSON.stringify(meso.exercises, null, 2) : "none"}
RECENT: ${JSON.stringify(recent.slice(0, 3).map((s) => ({ date: s.date, exercises: s.exercises.map((ex) => ({ name: ex.name, done: ex.sets.filter((st) => st.done).map((st) => ({ w: st.weight, r: st.reps, rpe: st.rpe })) })) })), null, 2)}
Output: { "session_summary": "2-3 sentences", "exercise_decisions": [{ "exercise_name": "", "actual_performance": "", "decision": "progress|maintain|regress", "next_weight_kg": 0, "reason": "" }], "overall_recommendation": "1 sentence" }`;

  const raw = await callAI(system, user);
  if (!raw) return null;

  const parsed = extractJson(raw);
  if (!parsed) { console.error("[ai-coach] no JSON in:", raw.slice(0, 200)); return null; }

  const result = z.object({
    session_summary: z.string(),
    exercise_decisions: z.array(ExerciseDecisionSchema),
    overall_recommendation: z.string(),
  }).safeParse(parsed);
  if (!result.success) { console.error("[ai-coach] validation:", result.error.issues); return null; }

  const analysis: SessionAnalysis = {
    session_date: date,
    analyzed_at: new Date().toISOString(),
    ...result.data,
  };

  await saveSessionAnalysis(userId, analysis);

  // Update weight overrides with safety bounds
  const overrides = await getWeightOverrides(userId);
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
      from_session_date: date,
    };
  }
  await saveWeightOverrides(userId, overrides);

  return analysis;
}

// ── Mesocycle status ──────────────────────────────────────────────────────────

export async function getMesocycleStatus(userId: string) {
  const meso = await readMesocycle(userId);
  if (!meso) return { active: false, name: null, endDate: null, daysLeft: null, ended: false };
  const daysLeft = Math.ceil((new Date(meso.end_date + "T23:59:59").getTime() - Date.now()) / 86_400_000);
  return { active: true, name: meso.name, endDate: meso.end_date, daysLeft, ended: daysLeft < 0 };
}

// ── Mesocycle generation ──────────────────────────────────────────────────────

const MesocycleExSchema = z.object({
  name: z.string().min(1),
  sets: z.number().int().min(1).max(10),
  reps: z.union([z.number().int().min(1).max(50), z.string()]),
  target_rpe: z.number().min(5).max(10).optional(),
  weekly_increment_kg: z.number().min(0).max(10).optional(),
  start_weight_kg: z.number().min(0).max(500).nullable().optional(),
  note: z.string().optional(),
});

const MesocycleAISchema = z.object({
  name: z.string().min(1),
  goal: z.string().min(5),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  phase: z.string().min(1),
  weekly_structure: z.record(z.string()),
  exercises: z.object({
    gym_upper: z.record(MesocycleExSchema).optional(),
    gym_lower: z.record(MesocycleExSchema).optional(),
  }),
  rules: z.object({ progression_trigger: z.string(), regression_trigger_rpe: z.number() }),
  warmup_protocol: z.object({ gym_sessions: z.array(z.string()), note: z.string() }).optional(),
});

export async function generateNextMesocycle(userId: string): Promise<{ success: boolean; error?: string }> {
  const [currentMeso, allSessions] = await Promise.all([readMesocycle(userId), getAllGymSessions(userId)]);

  const recentAnalyses = await Promise.all(
    allSessions.slice(0, 10).map((s) => getSessionAnalysis(userId, s.date))
  );
  const analyses = recentAnalyses.filter(Boolean) as SessionAnalysis[];

  const startDate = new Date(); startDate.setDate(startDate.getDate() + 1);
  const endDate = new Date(startDate); endDate.setDate(endDate.getDate() + 27);
  const startIso = startDate.toISOString().slice(0, 10);
  const endIso = endDate.toISOString().slice(0, 10);
  const situation = await situationContext(userId);

  const system = `You are an expert strength coach. Create 4-week mesocycle plans. Use ACTUAL weights from recent sessions as start_weight_kg. Output ONLY valid JSON.${situation}`;

  const user = `Create next mesocycle starting ${startIso}.
COMPLETED: ${currentMeso ? JSON.stringify({ name: currentMeso.name, phase: currentMeso.phase, exercises: currentMeso.exercises }, null, 2) : "none"}
RECENT SESSIONS: ${JSON.stringify(allSessions.slice(0, 6).map((s) => ({ date: s.date, name: s.name, exercises: s.exercises.map((ex) => ({ name: ex.name, done: ex.sets.filter((st) => st.done).map((st) => ({ w: st.weight, r: st.reps })) })) })), null, 2)}
AI NOTES: ${analyses.slice(0, 3).map((a) => `${a.session_date}: ${a.session_summary}`).join("\n") || "none"}
Output JSON: { "name": "Mesocycle N — Phase", "goal": "...", "start_date": "${startIso}", "end_date": "${endIso}", "phase": "accumulation|intensification|realization", "weekly_structure": { "mon": "gym_upper", "tue": "rest", "wed": "floorball", "thu": "gym_lower", "fri": "floorball", "sat": "active_recovery", "sun": "rest" }, "rules": { "progression_trigger": "all_sets_completed_as_planned", "regression_trigger_rpe": 9 }, "warmup_protocol": { "gym_sessions": [], "note": "" }, "exercises": { "gym_upper": { "A1": { "name": "...", "sets": 4, "reps": 8, "target_rpe": 7.5, "weekly_increment_kg": 1.25, "start_weight_kg": 40 } }, "gym_lower": {} } }`;

  const raw = await callAI(system, user);
  if (!raw) return { success: false, error: "AI did not respond" };
  const parsed = extractJson(raw);
  if (!parsed) return { success: false, error: "AI response was not valid JSON" };
  const result = MesocycleAISchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return { success: false, error: `Validation failed: ${issues.slice(0, 200)}` };
  }
  const dur = (new Date(result.data.end_date).getTime() - new Date(result.data.start_date).getTime()) / 86_400_000;
  if (dur < 7 || dur > 150) return { success: false, error: "Generated mesocycle has invalid duration" };

  await writeMesocycle(userId, result.data as unknown as Mesocycle);
  await saveWeightOverrides(userId, {});
  return { success: true };
}

// ── Pre-session briefing ──────────────────────────────────────────────────────

export async function briefSession(userId: string, date: string, sessionName: string): Promise<SessionBriefing | null> {
  const cached = await getSessionBriefing(userId, date);
  if (cached) return cached;

  const [meso, allSessions] = await Promise.all([readMesocycle(userId), getAllGymSessions(userId)]);
  const situation = await situationContext(userId);
  const sameType = allSessions.filter((s) => s.date < date && s.name === sessionName).slice(0, 1);

  const system = `You are a concise strength coach giving a pre-session briefing. Write 2-3 short sentences only. Use specific numbers. Be direct and motivating.${situation}`;
  const user = `Today: ${sessionName} on ${date}
LAST TIME THIS SESSION: ${sameType.length ? JSON.stringify(sameType[0].exercises.map((ex) => ({ name: ex.name, done: ex.sets.filter((s) => s.done).map((s) => ({ w: s.weight, r: s.reps })) }))) : "First time"}
PLANNED: ${meso ? JSON.stringify(sessionName.includes("Upper") ? meso.exercises.gym_upper : meso.exercises.gym_lower) : "No mesocycle"}
Write coaching note (plain text, no JSON):`;

  const raw = await callAI(system, user);
  if (!raw || raw.length < 10) return null;

  const b: SessionBriefing = { session_date: date, generated_at: new Date().toISOString(), note: raw.trim() };
  await saveSessionBriefing(userId, b);
  return b;
}


// ── Exercise substitution ─────────────────────────────────────────────────────

export async function suggestSubstitutions(userId: string, exerciseName: string): Promise<string[]> {
  const [catalog, situation] = await Promise.all([
    readExerciseCatalog(userId),
    situationContext(userId),
  ]);
  const catalogNames = catalog.map((e) => e.name).join(", ");

  const system = `You are a strength coach. Suggest 3 exercise substitutions targeting the same primary muscle groups. Return ONLY a JSON array of 3 strings (exercise names). No explanation.${situation}`;
  const user = `Exercise to substitute: ${exerciseName}
Available exercises in catalog: ${catalogNames || "no catalog"}
Return JSON array of exactly 3 alternatives, e.g. ["Alt 1", "Alt 2", "Alt 3"]`;

  const raw = await callAI(system, user);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw.match(/\[.*?\]/s)?.[0] ?? raw);
    if (Array.isArray(arr)) return arr.slice(0, 3).map(String);
  } catch {}
  return [];
}

// ── Weekly summary ────────────────────────────────────────────────────────────

