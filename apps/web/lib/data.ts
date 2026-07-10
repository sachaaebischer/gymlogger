import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import {
  GymSession,
  Plan,
  PlannedGymSession,
  readAnalysis,
  readGymSession,
  readGymSessions,
  readJson,
  readPlan,
  readPlanForWeek,
  readPlannedSession,
  readExerciseCatalog,
  ExerciseCatalogItem,
  lastExercisePerformance,
  listPlannedSessionsForWeek,
  allExerciseHistory,
  paths,
} from "@coach/lib";

export function todayStr(): string {
  return new Date().toLocaleDateString("sv");
}

export function mondayOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay();
  dt.setUTCDate(dt.getUTCDate() - (day === 0 ? 6 : day - 1));
  return dt.toISOString().slice(0, 10);
}

// ── Mesocycle ────────────────────────────────────────────────────────────────

export interface MesocycleExercise {
  name: string;
  sets: number;
  reps: number | string;
  confirmed_weight?: string;
  start_weight_kg?: number | null;
  weekly_increment_kg?: number;
  weekly_increment_rep?: number;
  target_rpe?: number;
  note?: string;
  config?: string;
  unit?: string;
}

export interface Mesocycle {
  name: string;
  phase: string;
  goal: string;
  start_date: string;
  end_date: string;
  exercises: {
    gym_upper?: Record<string, MesocycleExercise>;
    gym_lower?: Record<string, MesocycleExercise>;
  };
  weekly_structure?: Record<string, string>;
  rules: {
    progression_trigger: string;
    regression_trigger_rpe: number;
  };
}

export async function readMesocycle(): Promise<Mesocycle | null> {
  return readJson<Mesocycle>(path.join(paths.data(), "plan", "mesocycle.json"));
}
export function getMesocycleProgress(meso: Mesocycle): { currentWeek: number; totalWeeks: number; progressPct: number } {
  const today = Date.now();
  const start = new Date(meso.start_date).getTime();
  const end = new Date(meso.end_date).getTime();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const totalWeeks = Math.max(1, Math.ceil((end - start) / msPerWeek));
  const currentWeek = Math.max(1, Math.min(totalWeeks, Math.floor((today - start) / msPerWeek) + 1));
  const progressPct = Math.min(100, Math.max(0, ((today - start) / (end - start)) * 100));
  return { currentWeek, totalWeeks, progressPct };
}

export function getUpcomingGymDays(
  meso: Mesocycle,
  fromDate: string,
  count = 4
): { date: string; type: "gym_upper" | "gym_lower" }[] {
  const DAY_NAMES: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const struct = meso.weekly_structure ?? {};
  const gymDays: Record<string, "gym_upper" | "gym_lower"> = {};
  for (const [day, type] of Object.entries(struct)) {
    if (type === "gym_upper" || type === "gym_lower") gymDays[day] = type as "gym_upper" | "gym_lower";
  }
  const [y, m, d] = fromDate.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  const results: { date: string; type: "gym_upper" | "gym_lower" }[] = [];
  for (let offset = 0; offset < 21 && results.length < count; offset++) {
    const cur = new Date(base);
    cur.setUTCDate(base.getUTCDate() + offset);
    const dow = cur.getUTCDay();
    const dayName = Object.keys(DAY_NAMES).find((k) => DAY_NAMES[k] === dow);
    if (dayName && gymDays[dayName]) {
      results.push({ date: cur.toISOString().slice(0, 10), type: gymDays[dayName] });
    }
  }
  return results;
}


// ── Lift trend ───────────────────────────────────────────────────────────────

export interface LiftPoint { date: string; maxWeight: number; reps: number }
export interface LiftTrend { exercise: string; points: LiftPoint[]; unit: string }

function isBodyweight(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes("bodyweight") ||
    ((n.includes("pull-up") || n.includes("pull up")) && !n.includes("weighted")) ||
    ((n.includes("chin-up") || n.includes("chin up")) && !n.includes("weighted"))
  );
}

function pickKeyExercises(meso: Mesocycle | null): string[] {
  if (!meso?.exercises) {
    return ["DB Bench Press", "Pull-ups (Bodyweight)", "Back Squat", "Romanian Deadlift"];
  }
  const upper = meso.exercises.gym_upper ?? {};
  const lower = meso.exercises.gym_lower ?? {};
  const pick = (obj: Record<string, MesocycleExercise>, prefix: string) =>
    Object.keys(obj)
      .filter((k) => k.startsWith(prefix))
      .map((k) => obj[k]?.name)
      .filter(Boolean) as string[];
  return [
    ...pick(upper, "A"),
    ...pick(lower, "A"),
    ...pick(upper, "B").slice(0, 1),
    ...pick(lower, "B").slice(0, 1),
  ].slice(0, 4);
}

function buildLiftTrends(sessions: GymSession[], exercises: string[]): LiftTrend[] {
  return exercises.map((name) => {
    const bw = isBodyweight(name);
    const points: LiftPoint[] = sessions
      .flatMap((session) => {
        const ex = session.exercises.find(
          (e) => e.name.toLowerCase() === name.toLowerCase()
        );
        if (!ex) return [];
        const done = ex.sets.filter((s) => s.done && (s.reps ?? 0) > 0);
        if (!done.length) return [];
        const best = done.reduce((a, b) => {
          const sa = bw ? (a.reps ?? 0) : (a.weight ?? 0) * (a.reps ?? 0);
          const sb = bw ? (b.reps ?? 0) : (b.weight ?? 0) * (b.reps ?? 0);
          return sb > sa ? b : a;
        });
        return [{ date: session.date, maxWeight: best.weight ?? 0, reps: best.reps ?? 0 }];
      })
      .sort((a, b) => a.date.localeCompare(b.date));
    return { exercise: name, points, unit: bw ? "BW" : "kg" };
  });
}

// ── Progression calculator ────────────────────────────────────────────────────

function isWeightedBW(name: string): boolean {
  const n = name.toLowerCase();
  return (
    (n.includes("pull-up") || n.includes("pull up") || n.includes("chin-up")) ||
    n.includes("weighted dip") ||
    (n.includes("dip") && n.includes("weighted"))
  );
}

function getBaseWeight(ex: MesocycleExercise): number | null {
  if (typeof ex.start_weight_kg === "number") return ex.start_weight_kg;
  if (ex.confirmed_weight && ex.confirmed_weight !== "BW") {
    const parsed = parseFloat(ex.confirmed_weight);
    if (!isNaN(parsed)) return parsed;
  }
  return null;
}

function formatWeightLabel(kg: number | null, exerciseName: string): string {
  if (kg === null) return "BW";
  if (isWeightedBW(exerciseName) && kg > 0) return `BW+${kg}kg`;
  return `${kg}kg`;
}

export function computeTargetWeight(
  ex: MesocycleExercise,
  sessions: GymSession[]
): { kg: number | null; label: string } {
  const baseWeight = getBaseWeight(ex);

  // Pure bodyweight exercise (no base weight, not a weighted BW exercise)
  if (baseWeight === null && !isWeightedBW(ex.name)) {
    return { kg: null, label: "BW" };
  }

  const targetReps =
    typeof ex.reps === "number" ? ex.reps : parseInt(String(ex.reps)) || 8;
  const targetSets = ex.sets;

  // Find most recent session with this exercise
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  for (const s of sorted) {
    const exercise = s.exercises.find(
      (e) => e.name.toLowerCase() === ex.name.toLowerCase()
    );
    if (!exercise) continue;
    const doneSets = exercise.sets.filter((st) => st.done);
    if (!doneSets.length) continue;

    // Last used weight
    const weights = doneSets.map((st) => st.weight ?? 0).filter((w) => w > 0);
    const lastWeight =
      weights.length > 0 ? Math.max(...weights) : (baseWeight ?? 0);

    // All sets completed at target reps?
    const allCompleted =
      doneSets.length >= targetSets &&
      doneSets.every((st) => (st.reps ?? 0) >= targetReps);

    const nextWeight = allCompleted
      ? lastWeight + (ex.weekly_increment_kg ?? 0)
      : lastWeight;

    return {
      kg: nextWeight,
      label: formatWeightLabel(nextWeight, ex.name),
    };
  }

  // No history — use base weight
  if (baseWeight === null) return { kg: null, label: "BW" };
  return { kg: baseWeight, label: formatWeightLabel(baseWeight, ex.name) };
}

export function generateSessionExercises(
  mesocycle: Mesocycle,
  sessionType: "gym_upper" | "gym_lower",
  sessions: GymSession[]
): import("@coach/lib").PlannedExercise[] {
  const exerciseMap =
    sessionType === "gym_upper"
      ? mesocycle.exercises.gym_upper ?? {}
      : mesocycle.exercises.gym_lower ?? {};

  return Object.entries(exerciseMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([, ex]) => ex?.name && (ex.reps !== 0 || ex.config)) // skip empty entries
    .map(([id, ex]) => {
      // Circuit/conditioning exercises get special treatment
      if (ex.reps === 0 && ex.config) {
        return {
          id,
          name: ex.name,
          sets: ex.sets || 3,
          reps: "circuit",
          target_weight_kg: null,
          target_weight_label: "",
          target_rpe: ex.target_rpe ?? null,
          note: ex.config ?? ex.note ?? "",
        } as import("@coach/lib").PlannedExercise;
      }
      const { kg, label } = computeTargetWeight(ex, sessions);
      return {
        id,
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        target_weight_kg: kg,
        target_weight_label: label,
        target_rpe: ex.target_rpe ?? null,
        note: ex.note ?? "",
      } as import("@coach/lib").PlannedExercise;
    });
}

// ── Dashboard data ────────────────────────────────────────────────────────────

export interface DashboardData {
  recentSessions: GymSession[];
  keyLifts: LiftTrend[];
  mesocycle: Mesocycle | null;
  analysis: string | null;
  todaySession: PlannedGymSession | null;
  todayDate: string;
}

export async function getDashboardData(): Promise<DashboardData> {
  const today = todayStr();
  const [sessions, analysis, mesocycle, todayPlanned, todaySaved] = await Promise.all([
    readGymSessions(),
    readAnalysis(),
    readMesocycle(),
    readPlannedSession(today),
    readGymSession(today),
  ]);

  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  const keyExercises = pickKeyExercises(mesocycle);
  const keyLifts = buildLiftTrends(sorted, keyExercises);

  // today's session: prefer already-saved, else planned
  let todaySession: PlannedGymSession | null = null;
  if (todaySaved) {
    todaySession = {
      date: today,
      session_type: "gym_upper",
      generated_at: "",
      week_notes: "",
      exercises: todaySaved.exercises.map((ex, i) => ({
        id: String(i),
        name: ex.name,
        sets: ex.target_sets ?? ex.sets.length,
        reps: ex.target_reps || "varies",
        target_weight_kg: null,
        target_weight_label: "",
        target_rpe: null,
        note: ex.notes,
      })),
    };
  } else {
    todaySession = todayPlanned;
  }

  return {
    recentSessions: sorted.slice(0, 6),
    keyLifts,
    mesocycle,
    analysis,
    todaySession,
    todayDate: today,
  };
}


// ── AI weight overrides ───────────────────────────────────────────────────────

export async function getWeightOverrides(): Promise<Record<string, { next_weight_kg: number; reason: string; from_session: string; updated_at: string }>> {
  try {
    const raw = await fs.readFile(path.join(paths.data(), "gym", "weight_overrides.json"), "utf-8");
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch { return {}; }
}

// ── Gym day data ──────────────────────────────────────────────────────────────

export type LastPerf = Record<
  string,
  { date: string; reps: number | null; weight: number | null }[] | null
>;

export interface GymDayData {
  session: GymSession;
  lastPerf: LastPerf;
  hasSaved: boolean;
  catalog: ExerciseCatalogItem[];
}

function plannedToGymSession(planned: PlannedGymSession): GymSession {
  const typeLabel =
    planned.session_type === "gym_upper" ? "Gym — Upper body" : "Gym — Lower body";
  return {
    id: `${planned.date}-gym`,
    date: planned.date,
    name: typeLabel,
    started_at: "",
    finished_at: "",
    notes: "",
    exercises: planned.exercises.map((ex) => ({
      name: ex.name,
      target_sets: ex.sets,
      target_reps: String(ex.reps),
      notes: ex.note ?? "",
      sets: Array.from({ length: ex.sets }, (_, i) => ({
        set_no: i + 1,
        reps: typeof ex.reps === "number" ? ex.reps : null,
        weight: ex.target_weight_kg,
        rpe: null,
        done: false,
      })),
    })),
  };
}

export async function getGymDayData(
  date: string,
  sessionType?: "gym_upper" | "gym_lower"
): Promise<GymDayData> {
  const [saved, planned, catalog, mesocycle, allSessions] = await Promise.all([
    readGymSession(date),
    readPlannedSession(date),
    readExerciseCatalog(),
    readMesocycle(),
    readGymSessions(),
  ]);
  const catalogMap = new Map(
    catalog.exercises.map((e) => [e.name.toLowerCase(), e])
  );

  let session: GymSession;
  let hasSaved = false;

  if (saved) {
    session = saved;
    hasSaved = true;
  } else if (planned) {
    session = plannedToGymSession(planned);
  } else if (sessionType && mesocycle) {
    const exercises = generateSessionExercises(mesocycle, sessionType, allSessions);
    const overrides = await getWeightOverrides();
    const exercisesWithOverrides = exercises.map((ex) => {
      const ov = overrides[ex.name];
      if (ov) {
        return { ...ex, target_weight_kg: ov.next_weight_kg, target_weight_label: `${ov.next_weight_kg}kg` };
      }
      return ex;
    });
    const typeLabel = sessionType === "gym_upper" ? "Gym — Upper body" : "Gym — Lower body";
    session = plannedToGymSession({
      date,
      session_type: sessionType,
      generated_at: new Date().toISOString(),
      week_notes: "",
      exercises: exercisesWithOverrides,
    });
    session.name = typeLabel;
  } else {
    session = {
      id: `${date}-gym`,
      date,
      name: "Gym session",
      started_at: "",
      finished_at: "",
      notes: "",
      exercises: [],
    };
  }

  // Apply catalog notes where missing
  session = {
    ...session,
    exercises: session.exercises.map((ex) => ({
      ...ex,
      notes:
        ex.notes ||
        catalogMap.get(ex.name.toLowerCase())?.notes ||
        "",
    })),
  };

  const names = [...new Set(session.exercises.map((e) => e.name))];
  const lastPerf: LastPerf = {};
  for (const name of names) {
    lastPerf[name] = await lastExercisePerformance(name, date);
  }

  return { session, lastPerf, hasSaved, catalog: catalog.exercises };
}

export async function getRecentGymSessions(limit = 10): Promise<GymSession[]> {
  const all = await readGymSessions();
  return all.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

export async function getGymWeekSessions(weekStart: string): Promise<PlannedGymSession[]> {
  return listPlannedSessionsForWeek(weekStart);
}

export async function getAllGymSessions(): Promise<GymSession[]> {
  const all = await readGymSessions();
  return all.sort((a, b) => b.date.localeCompare(a.date));
}

export type ExerciseHistoryEntry = {
  date: string;
  sets: { set_no: number; weight: number | null; reps: number | null; rpe: number | null }[];
};

export async function getExerciseHistory(name: string): Promise<ExerciseHistoryEntry[]> {
  return allExerciseHistory(name);
}
