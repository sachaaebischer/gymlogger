import "server-only";
import {
  eq, and, desc, sql, inArray, like,
} from "drizzle-orm";
import { db } from "./db";
import {
  mesocycles, gymSessions, gymExercises, gymSets,
  exerciseCatalog, weightOverrides, userSettings, aiAnalyses, aiBriefings,
  personalRecords, users, sessionTemplates,
} from "./db/schema";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface MesocycleExercise {
  name: string;
  sets: number;
  reps: string;
  rir?: number;
  notes?: string;
}

export interface Mesocycle {
  id?: string;
  name: string;
  goal: string;
  phase: string;
  start_date: string;
  end_date: string;
  weekly_structure: Record<string, string[]>;
  exercises: Record<string, MesocycleExercise[]>;
  rules?: Record<string, unknown>;
  warmup_protocol?: Record<string, unknown>;
  is_active?: boolean;
}

export interface GymSet {
  set_no: number;
  reps: number | null;
  weight: number | null;
  rpe: number | null;
  done: boolean;
}

export interface GymExercise {
  name: string;
  target_sets: number | null;
  target_reps: string;
  notes: string;
  sets: GymSet[];
}

export interface GymSession {
  id: string;
  date: string;
  name: string;
  session_type?: string | null;
  started_at: string;
  finished_at: string;
  notes: string;
  exercises: GymExercise[];
}

export interface Settings {
  situation_prompt: string;
  rest_timer_default: number;
  ai_enabled: boolean;
  ai_mesocycle_enabled: boolean;
  ai_session_analysis_enabled: boolean;
  ai_briefing_enabled: boolean;
  ai_substitution_enabled: boolean;
  ai_deload_detection_enabled: boolean;
}

export interface SessionTemplate {
  id: string;
  userId: string;
  name: string;
  exercises: Array<{ name: string; sets: number; reps: string; notes?: string }>;
  isActive: boolean;
  mesocycleId?: string | null;
  createdAt: string;
}

export interface WeightOverride {
  next_weight_kg: number;
  reason: string;
  from_session_date?: string;
}

export type WeightOverrides = Record<string, WeightOverride>;

export interface ExerciseCatalogItem {
  name: string;
  notes: string;
  default_sets: number | null;
  default_reps: string;
  default_weight: number | null;
  muscle_groups: string[];
  equipment: string | null;
}

export type LastPerf = Record<string, { date: string; reps: number | null; weight: number | null }[] | null>;

export interface GymDayData {
  session: GymSession;
  lastPerf: LastPerf;
  catalog: ExerciseCatalogItem[];
  hasSaved: boolean;
}

export type ExerciseHistoryEntry = {
  date: string;
  sets: GymSet[];
};

export interface ExerciseDecision {
  exercise_name: string;
  actual_performance: string;
  decision: "progress" | "maintain" | "regress";
  next_weight_kg?: number | null;
  reason: string;
}

export interface SessionAnalysis {
  session_date: string;
  session_summary: string;
  exercise_decisions: ExerciseDecision[];
  overall_recommendation: string;
  analyzed_at?: string;
}

export interface SessionBriefing {
  session_date: string;
  note: string;
  generated_at?: string;
}

export interface PersonalRecord {
  exerciseName: string;
  weight: number;
  reps: number;
  e1rm: number;
  achievedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function mondayOf(date: string): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function getMesocycleProgress(meso: Mesocycle) {
  const start = new Date(meso.start_date);
  const end = new Date(meso.end_date);
  const now = new Date();
  const totalDays = (end.getTime() - start.getTime()) / 86400000;
  const totalWeeks = Math.ceil(totalDays / 7);
  const elapsed = Math.max(0, (now.getTime() - start.getTime()) / 86400000);
  const currentWeek = Math.min(totalWeeks, Math.floor(elapsed / 7) + 1);
  const progressPct = Math.min(100, Math.round((elapsed / totalDays) * 100));
  return { currentWeek, totalWeeks, progressPct };
}

// ── Session loading helper ────────────────────────────────────────────────────

async function loadSessionWithExercises(sessionId: string): Promise<GymSession | null> {
  const [row] = await db.select().from(gymSessions).where(eq(gymSessions.id, sessionId)).limit(1);
  if (!row) return null;

  const exercises = await db.select().from(gymExercises).where(eq(gymExercises.sessionId, sessionId));
  const exerciseIds = exercises.map((e) => e.id);
  const sets = exerciseIds.length
    ? await db.select().from(gymSets).where(inArray(gymSets.exerciseId, exerciseIds))
    : [];

  return {
    id: row.id,
    date: row.date,
    name: row.name,
    session_type: row.sessionType,
    started_at: row.startedAt?.toISOString() ?? "",
    finished_at: row.finishedAt?.toISOString() ?? "",
    notes: row.notes,
    exercises: exercises
      .sort((a, b) => a.orderIdx - b.orderIdx)
      .map((ex) => ({
        name: ex.name,
        target_sets: ex.targetSets ?? null,
        target_reps: ex.targetReps ?? "",
        notes: ex.notes,
        sets: sets
          .filter((s) => s.exerciseId === ex.id)
          .sort((a, b) => a.setNo - b.setNo)
          .map((s) => ({
            set_no: s.setNo,
            reps: s.reps,
            weight: s.weight != null ? Number(s.weight) : null,
            rpe: s.rpe != null ? Number(s.rpe) : null,
            done: s.done,
          })),
      })),
  };
}

// ── Mesocycles ────────────────────────────────────────────────────────────────

export async function readMesocycle(userId: string): Promise<Mesocycle | null> {
  const [row] = await db.select().from(mesocycles)
    .where(and(eq(mesocycles.userId, userId), eq(mesocycles.isActive, true)))
    .orderBy(desc(mesocycles.createdAt))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    goal: row.goal,
    phase: row.phase,
    start_date: row.startDate,
    end_date: row.endDate,
    weekly_structure: (row.weeklyStructure as Record<string, string[]>) ?? {},
    exercises: (row.exercises as Record<string, MesocycleExercise[]>) ?? {},
    rules: (row.rules as Record<string, unknown>) ?? {},
    warmup_protocol: (row.warmupProtocol as Record<string, unknown>) ?? {},
    is_active: row.isActive,
  };
}

export async function writeMesocycle(userId: string, meso: Mesocycle): Promise<string> {
  // Deactivate existing
  await db.update(mesocycles).set({ isActive: false })
    .where(and(eq(mesocycles.userId, userId), eq(mesocycles.isActive, true)));

  const [inserted] = await db.insert(mesocycles).values({
    userId,
    name: meso.name,
    goal: meso.goal,
    phase: meso.phase,
    startDate: meso.start_date,
    endDate: meso.end_date,
    weeklyStructure: meso.weekly_structure,
    exercises: meso.exercises,
    rules: meso.rules ?? {},
    warmupProtocol: meso.warmup_protocol ?? {},
    isActive: true,
  }).returning({ id: mesocycles.id });
  return inserted.id;
}

// ── Gym sessions ──────────────────────────────────────────────────────────────

export async function getAllGymSessions(userId: string): Promise<GymSession[]> {
  const rows = await db.select({ id: gymSessions.id })
    .from(gymSessions)
    .where(eq(gymSessions.userId, userId))
    .orderBy(desc(gymSessions.date));

  const sessions: GymSession[] = [];
  for (const row of rows) {
    const s = await loadSessionWithExercises(row.id);
    if (s) sessions.push(s);
  }
  return sessions;
}

export async function getRecentGymSessions(userId: string, limit = 10): Promise<GymSession[]> {
  const rows = await db.select({ id: gymSessions.id })
    .from(gymSessions)
    .where(eq(gymSessions.userId, userId))
    .orderBy(desc(gymSessions.date))
    .limit(limit);

  const sessions: GymSession[] = [];
  for (const row of rows) {
    const s = await loadSessionWithExercises(row.id);
    if (s) sessions.push(s);
  }
  return sessions;
}

export async function readGymSession(userId: string, date: string): Promise<GymSession | null> {
  const [row] = await db.select({ id: gymSessions.id })
    .from(gymSessions)
    .where(and(eq(gymSessions.userId, userId), eq(gymSessions.date, date)))
    .limit(1);
  if (!row) return null;
  return loadSessionWithExercises(row.id);
}

function epley1RM(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

export async function checkAndSavePRs(userId: string, session: GymSession): Promise<string[]> {
  const newPRs: string[] = [];
  for (const ex of session.exercises) {
    const doneSets = ex.sets.filter((s) => s.done && s.weight && s.weight > 0 && s.reps && s.reps > 0);
    if (!doneSets.length) continue;
    type BestSet = GymSet & { e1rm: number };
    const best = doneSets.reduce<BestSet>((acc, s) => {
      const e1rm = epley1RM(s.weight!, s.reps!);
      return e1rm > acc.e1rm ? { ...s, e1rm } : acc;
    }, { ...doneSets[0], e1rm: epley1RM(doneSets[0].weight!, doneSets[0].reps!) });

    const [existing] = await db.select().from(personalRecords)
      .where(and(eq(personalRecords.userId, userId), eq(personalRecords.exerciseName, ex.name)));

    if (!existing || Number(existing.e1rm) < best.e1rm) {
      await db.insert(personalRecords).values({
        userId,
        exerciseName: ex.name,
        weight: String(best.weight),
        reps: best.reps,
        e1rm: String(best.e1rm),
        achievedAt: session.date,
      }).onConflictDoUpdate({
        target: [personalRecords.userId, personalRecords.exerciseName],
        set: {
          weight: String(best.weight),
          reps: best.reps,
          e1rm: String(best.e1rm),
          achievedAt: session.date,
        },
      });
      newPRs.push(ex.name);
    }
  }
  return newPRs;
}

export async function writeGymSession(userId: string, session: GymSession): Promise<void> {
  const [existing] = await db.select({ id: gymSessions.id })
    .from(gymSessions)
    .where(and(eq(gymSessions.userId, userId), eq(gymSessions.date, session.date)))
    .limit(1);

  let sessionId: string;

  if (existing) {
    await db.update(gymSessions).set({
      name: session.name,
      sessionType: session.session_type ?? null,
      startedAt: session.started_at ? new Date(session.started_at) : null,
      finishedAt: session.finished_at ? new Date(session.finished_at) : null,
      notes: session.notes,
      updatedAt: new Date(),
    }).where(eq(gymSessions.id, existing.id));
    sessionId = existing.id;
    await db.delete(gymExercises).where(eq(gymExercises.sessionId, sessionId));
  } else {
    const [newSession] = await db.insert(gymSessions).values({
      userId,
      date: session.date,
      name: session.name,
      sessionType: session.session_type ?? null,
      startedAt: session.started_at ? new Date(session.started_at) : null,
      finishedAt: session.finished_at ? new Date(session.finished_at) : null,
      notes: session.notes,
    }).returning({ id: gymSessions.id });
    sessionId = newSession.id;
  }

  for (let i = 0; i < session.exercises.length; i++) {
    const ex = session.exercises[i];
    const [newEx] = await db.insert(gymExercises).values({
      sessionId,
      name: ex.name,
      targetSets: ex.target_sets ?? null,
      targetReps: ex.target_reps ?? null,
      notes: ex.notes,
      orderIdx: i,
    }).returning({ id: gymExercises.id });

    if (ex.sets.length) {
      await db.insert(gymSets).values(
        ex.sets.map((s) => ({
          exerciseId: newEx.id,
          setNo: s.set_no,
          reps: s.reps,
          weight: s.weight != null ? String(s.weight) : null,
          rpe: s.rpe != null ? String(s.rpe) : null,
          done: s.done,
        }))
      );
    }
  }

  if (session.finished_at) {
    await checkAndSavePRs(userId, session);
  }
}

export async function deleteGymSession(userId: string, date: string): Promise<void> {
  const [row] = await db.select({ id: gymSessions.id })
    .from(gymSessions)
    .where(and(eq(gymSessions.userId, userId), eq(gymSessions.date, date)))
    .limit(1);
  if (row) {
    await db.delete(gymSessions).where(eq(gymSessions.id, row.id));
  }
}

// ── Exercise catalog ──────────────────────────────────────────────────────────

export async function readExerciseCatalog(userId: string): Promise<ExerciseCatalogItem[]> {
  const rows = await db.select().from(exerciseCatalog)
    .where(sql`${exerciseCatalog.userId} IS NULL OR ${exerciseCatalog.userId} = ${userId}`)
    .orderBy(exerciseCatalog.name);
  return rows.map((r) => ({
    name: r.name,
    notes: r.notes,
    default_sets: r.defaultSets,
    default_reps: r.defaultReps ?? "",
    default_weight: r.defaultWeight != null ? Number(r.defaultWeight) : null,
    muscle_groups: (r.muscleGroups as string[]) ?? [],
    equipment: r.equipment,
  }));
}

export async function getExerciseHistory(userId: string, name: string): Promise<ExerciseHistoryEntry[]> {
  const sessionRows = await db.select({ id: gymSessions.id, date: gymSessions.date })
    .from(gymSessions)
    .where(eq(gymSessions.userId, userId))
    .orderBy(desc(gymSessions.date));

  const results: ExerciseHistoryEntry[] = [];
  for (const row of sessionRows) {
    const [ex] = await db.select({ id: gymExercises.id })
      .from(gymExercises)
      .where(and(eq(gymExercises.sessionId, row.id), eq(gymExercises.name, name)))
      .limit(1);
    if (!ex) continue;

    const sets = await db.select().from(gymSets)
      .where(eq(gymSets.exerciseId, ex.id))
      .orderBy(gymSets.setNo);

    results.push({
      date: row.date,
      sets: sets.map((s) => ({
        set_no: s.setNo,
        reps: s.reps,
        weight: s.weight != null ? Number(s.weight) : null,
        rpe: s.rpe != null ? Number(s.rpe) : null,
        done: s.done,
      })),
    });
  }
  return results;
}

export async function lastExercisePerformance(
  userId: string,
  name: string,
  beforeDate?: string
): Promise<{ date: string; reps: number | null; weight: number | null }[] | null> {
  const query = db.select({ id: gymSessions.id, date: gymSessions.date })
    .from(gymSessions)
    .where(
      beforeDate
        ? and(eq(gymSessions.userId, userId), sql`${gymSessions.date} < ${beforeDate}`)
        : eq(gymSessions.userId, userId)
    )
    .orderBy(desc(gymSessions.date));

  const sessionRows = await query;
  for (const row of sessionRows) {
    const [ex] = await db.select({ id: gymExercises.id })
      .from(gymExercises)
      .where(and(eq(gymExercises.sessionId, row.id), eq(gymExercises.name, name)))
      .limit(1);
    if (!ex) continue;

    const sets = await db.select().from(gymSets)
      .where(and(eq(gymSets.exerciseId, ex.id), eq(gymSets.done, true)))
      .orderBy(gymSets.setNo);
    if (!sets.length) continue;

    return sets.map((s) => ({
      date: row.date,
      reps: s.reps,
      weight: s.weight != null ? Number(s.weight) : null,
    }));
  }
  return null;
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function readSettings(userId: string): Promise<Settings> {
  const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  return {
    situation_prompt: row?.situationPrompt ?? "",
    rest_timer_default: row?.restTimerDefault ?? 120,
    ai_enabled: row?.aiEnabled ?? true,
    ai_mesocycle_enabled: row?.aiMesocycleEnabled ?? true,
    ai_session_analysis_enabled: row?.aiSessionAnalysisEnabled ?? true,
    ai_briefing_enabled: row?.aiBriefingEnabled ?? true,
    ai_substitution_enabled: row?.aiSubstitutionEnabled ?? true,
    ai_deload_detection_enabled: row?.aiDeloadDetectionEnabled ?? true,
  };
}

export async function writeSettings(userId: string, patch: Partial<Settings>): Promise<Settings> {
  const current = await readSettings(userId);
  const next: Settings = { ...current, ...patch };
  await db.insert(userSettings).values({
    userId,
    situationPrompt: next.situation_prompt,
    restTimerDefault: next.rest_timer_default,
    aiEnabled: next.ai_enabled,
    aiMesocycleEnabled: next.ai_mesocycle_enabled,
    aiSessionAnalysisEnabled: next.ai_session_analysis_enabled,
    aiBriefingEnabled: next.ai_briefing_enabled,
    aiSubstitutionEnabled: next.ai_substitution_enabled,
    aiDeloadDetectionEnabled: next.ai_deload_detection_enabled,
  }).onConflictDoUpdate({
    target: userSettings.userId,
    set: {
      situationPrompt: next.situation_prompt,
      restTimerDefault: next.rest_timer_default,
      aiEnabled: next.ai_enabled,
      aiMesocycleEnabled: next.ai_mesocycle_enabled,
      aiSessionAnalysisEnabled: next.ai_session_analysis_enabled,
      aiBriefingEnabled: next.ai_briefing_enabled,
      aiSubstitutionEnabled: next.ai_substitution_enabled,
      aiDeloadDetectionEnabled: next.ai_deload_detection_enabled,
      updatedAt: new Date(),
    },
  });
  return next;
}

// ── Weight overrides ──────────────────────────────────────────────────────────

export async function getWeightOverrides(userId: string): Promise<WeightOverrides> {
  const rows = await db.select().from(weightOverrides).where(eq(weightOverrides.userId, userId));
  const result: WeightOverrides = {};
  for (const r of rows) {
    result[r.exerciseName] = {
      next_weight_kg: Number(r.nextWeightKg),
      reason: r.reason,
      from_session_date: r.fromSessionDate ?? undefined,
    };
  }
  return result;
}

export async function saveWeightOverrides(userId: string, overrides: WeightOverrides): Promise<void> {
  for (const [name, o] of Object.entries(overrides)) {
    await db.insert(weightOverrides).values({
      userId,
      exerciseName: name,
      nextWeightKg: String(o.next_weight_kg),
      reason: o.reason,
      fromSessionDate: o.from_session_date ?? null,
    }).onConflictDoUpdate({
      target: [weightOverrides.userId, weightOverrides.exerciseName],
      set: {
        nextWeightKg: String(o.next_weight_kg),
        reason: o.reason,
        fromSessionDate: o.from_session_date ?? null,
        updatedAt: new Date(),
      },
    });
  }
}

export async function clearWeightOverrides(userId: string): Promise<void> {
  await db.delete(weightOverrides).where(eq(weightOverrides.userId, userId));
}

// ── AI analyses ───────────────────────────────────────────────────────────────

export async function getSessionAnalysis(userId: string, date: string): Promise<SessionAnalysis | null> {
  const [row] = await db.select().from(aiAnalyses)
    .where(and(eq(aiAnalyses.userId, userId), eq(aiAnalyses.sessionDate, date)))
    .limit(1);
  if (!row) return null;
  return {
    session_date: row.sessionDate,
    session_summary: row.sessionSummary ?? "",
    exercise_decisions: (row.exerciseDecisions as SessionAnalysis["exercise_decisions"]) ?? {},
    overall_recommendation: row.overallRecommendation ?? "",
  };
}

export async function saveSessionAnalysis(userId: string, a: SessionAnalysis): Promise<void> {
  await db.insert(aiAnalyses).values({
    userId,
    sessionDate: a.session_date,
    sessionSummary: a.session_summary,
    exerciseDecisions: a.exercise_decisions,
    overallRecommendation: a.overall_recommendation,
  }).onConflictDoUpdate({
    target: [aiAnalyses.userId, aiAnalyses.sessionDate],
    set: {
      sessionSummary: a.session_summary,
      exerciseDecisions: a.exercise_decisions,
      overallRecommendation: a.overall_recommendation,
    },
  });
}

// ── AI briefings ──────────────────────────────────────────────────────────────

export async function getSessionBriefing(userId: string, date: string): Promise<SessionBriefing | null> {
  const [row] = await db.select().from(aiBriefings)
    .where(and(eq(aiBriefings.userId, userId), eq(aiBriefings.sessionDate, date)))
    .limit(1);
  if (!row) return null;
  return { session_date: row.sessionDate, note: row.note, generated_at: row.generatedAt?.toISOString() };
}

export async function saveSessionBriefing(userId: string, b: SessionBriefing): Promise<void> {
  await db.insert(aiBriefings).values({
    userId,
    sessionDate: b.session_date,
    note: b.note,
  }).onConflictDoUpdate({
    target: [aiBriefings.userId, aiBriefings.sessionDate],
    set: { note: b.note },
  });
}

// ── Personal records ──────────────────────────────────────────────────────────

export async function getPersonalRecords(userId: string): Promise<PersonalRecord[]> {
  const rows = await db.select().from(personalRecords)
    .where(eq(personalRecords.userId, userId))
    .orderBy(desc(personalRecords.e1rm));
  return rows.map((r) => ({
    exerciseName: r.exerciseName,
    weight: Number(r.weight),
    reps: r.reps ?? 0,
    e1rm: Number(r.e1rm),
    achievedAt: r.achievedAt,
  }));
}

// ── RPE tracking ──────────────────────────────────────────────────────────────

export async function getRecentSessionRPE(userId: string, sessionCount = 5): Promise<{ date: string; avgRpe: number }[]> {
  const sessions = await getRecentGymSessions(userId, sessionCount * 2);
  const finished = sessions.filter((s) => s.finished_at);
  const results: { date: string; avgRpe: number }[] = [];
  for (const s of finished) {
    const rpeSets = s.exercises.flatMap((ex) => ex.sets.filter((st) => st.done && st.rpe != null));
    if (!rpeSets.length) continue;
    const avg = rpeSets.reduce((sum, st) => sum + st.rpe!, 0) / rpeSets.length;
    results.push({ date: s.date, avgRpe: Math.round(avg * 10) / 10 });
    if (results.length >= sessionCount) break;
  }
  return results;
}

// ── Calendar ──────────────────────────────────────────────────────────────────

export async function getSessionsForMonth(
  userId: string,
  year: number,
  month: number
): Promise<{ date: string; sessionType: string | null }[]> {
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  const rows = await db
    .select({ date: gymSessions.date, sessionType: gymSessions.sessionType })
    .from(gymSessions)
    .where(and(eq(gymSessions.userId, userId), like(gymSessions.date, prefix + "%")));
  return rows;
}

// ── Profile helpers ───────────────────────────────────────────────────────────

export async function getUserById(userId: string): Promise<{ name: string | null; email: string } | null> {
  const [row] = await db.select({ name: users.name, email: users.email })
    .from(users).where(eq(users.id, userId)).limit(1);
  return row ?? null;
}

export async function updateUserName(userId: string, name: string): Promise<void> {
  await db.update(users).set({ name, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function getUserPasswordHash(userId: string): Promise<string | null> {
  const [row] = await db.select({ passwordHash: users.passwordHash })
    .from(users).where(eq(users.id, userId)).limit(1);
  return row?.passwordHash ?? null;
}

export async function updateUserPassword(userId: string, hash: string): Promise<void> {
  await db.update(users).set({ passwordHash: hash, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function isUserAdmin(userId: string): Promise<boolean> {
  const [row] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userId)).limit(1);
  return row?.isAdmin ?? false;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
  createdAt: string;
  sessionCount: number;
}

export async function getAllUsers(adminUserId: string): Promise<AdminUser[]> {
  if (!(await isUserAdmin(adminUserId))) throw new Error("Forbidden");
  const allUsers = await db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    isAdmin: users.isAdmin,
    createdAt: users.createdAt,
  }).from(users).orderBy(users.createdAt);

  const result: AdminUser[] = [];
  for (const u of allUsers) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(gymSessions)
      .where(eq(gymSessions.userId, u.id));
    result.push({
      id: u.id,
      email: u.email,
      name: u.name,
      isAdmin: u.isAdmin,
      createdAt: u.createdAt.toISOString().slice(0, 10),
      sessionCount: count ?? 0,
    });
  }
  return result;
}

export async function adminDeleteUser(adminUserId: string, targetUserId: string): Promise<void> {
  if (!(await isUserAdmin(adminUserId))) throw new Error("Forbidden");
  if (adminUserId === targetUserId) throw new Error("Cannot delete yourself");
  await db.delete(users).where(eq(users.id, targetUserId));
}

export async function adminSetAdmin(adminUserId: string, targetUserId: string, value: boolean): Promise<void> {
  if (!(await isUserAdmin(adminUserId))) throw new Error("Forbidden");
  await db.update(users).set({ isAdmin: value, updatedAt: new Date() }).where(eq(users.id, targetUserId));
}

// ── Gym day data (mesocycle → session scaffold) ───────────────────────────────

function plannedToGymSession(
  date: string,
  sessionType: string,
  meso: Mesocycle,
  overrides: WeightOverrides
): GymSession {
  const raw = meso.exercises[sessionType];
  // AI may generate exercises as object keyed by "A1"/"B1" etc. instead of array
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exercises: any[] = !raw
    ? []
    : Array.isArray(raw)
    ? raw
    : Object.values(raw as Record<string, unknown>);
  const sessionLabel =
    sessionType === "gym_upper" ? "Upper Body"
    : sessionType === "gym_lower" ? "Lower Body"
    : sessionType.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
  return {
    id: "",
    date,
    name: sessionLabel,
    session_type: sessionType,
    started_at: "",
    finished_at: "",
    notes: "",
    exercises: exercises.map((ex) => {
      const name = String(ex.name ?? "");
      const override = overrides[name];
      const startWeight = typeof ex.start_weight_kg === "number" ? ex.start_weight_kg : null;
      const defaultWeight = override ? override.next_weight_kg : startWeight;
      const numSets = Number(ex.sets) || 3;
      return {
        name,
        target_sets: numSets,
        target_reps: String(ex.reps ?? ""),
        notes: String(ex.notes ?? ex.note ?? ""),
        sets: Array.from({ length: numSets }, (_, i) => ({
          set_no: i + 1,
          reps: null,
          weight: defaultWeight,
          rpe: null,
          done: false,
        })),
      };
    }),
  };
}

export async function getGymDayData(
  userId: string,
  date: string,
  sessionType?: string,
  templateId?: string
): Promise<GymDayData> {
  const [existingSession, meso, overrides, catalog] = await Promise.all([
    readGymSession(userId, date),
    readMesocycle(userId),
    getWeightOverrides(userId),
    readExerciseCatalog(userId),
  ]);

  let session: GymSession;

  if (existingSession) {
    session = existingSession;
  } else if (templateId) {
    const template = await getTemplate(userId, templateId);
    session = template
      ? templateToGymSession(date, template, overrides)
      : { id: "", date, name: "Training", session_type: null, started_at: "", finished_at: "", notes: "", exercises: [] };
  } else if (meso && sessionType) {
    session = plannedToGymSession(date, sessionType, meso, overrides);
  } else {
    session = {
      id: "",
      date,
      name: "Training",
      session_type: sessionType ?? null,
      started_at: "",
      finished_at: "",
      notes: "",
      exercises: [],
    };
  }

  // Build lastPerf for each exercise
  const lastPerf: LastPerf = {};
  for (const ex of session.exercises) {
    lastPerf[ex.name] = await lastExercisePerformance(userId, ex.name, date);
  }

  return { session, lastPerf, catalog, hasSaved: !!existingSession };
}

// ── Upcoming gym days ─────────────────────────────────────────────────────────

export function getUpcomingGymDays(
  meso: Mesocycle,
  fromDate: string,
  count: number
): { date: string; sessionType: string }[] {
  const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const results: { date: string; sessionType: string }[] = [];
  const start = new Date(fromDate + "T12:00:00Z");
  for (let i = 1; i <= 21 && results.length < count; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const dayName = DAY_NAMES[d.getUTCDay()];
    const types = meso.weekly_structure[dayName];
    if (types && types.length > 0) {
      results.push({
        date: d.toISOString().slice(0, 10),
        sessionType: types[0],
      });
    }
  }
  return results;
}

// ── Session templates ─────────────────────────────────────────────────────────

function rowToTemplate(row: typeof sessionTemplates.$inferSelect): SessionTemplate {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    exercises: (row.exercises as Array<{ name: string; sets: number; reps: string; notes?: string }>) ?? [],
    isActive: row.isActive,
    mesocycleId: row.mesocycleId,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getActiveTemplates(userId: string): Promise<SessionTemplate[]> {
  const rows = await db
    .select()
    .from(sessionTemplates)
    .where(and(eq(sessionTemplates.userId, userId), eq(sessionTemplates.isActive, true)))
    .orderBy(desc(sessionTemplates.createdAt));
  return rows.map(rowToTemplate);
}

export async function getAllTemplates(userId: string): Promise<SessionTemplate[]> {
  const rows = await db
    .select()
    .from(sessionTemplates)
    .where(eq(sessionTemplates.userId, userId))
    .orderBy(desc(sessionTemplates.createdAt));
  return rows.map(rowToTemplate);
}

const SESSION_TYPE_NAMES: Record<string, string> = {
  gym_upper: "Upper Body",
  gym_lower: "Lower Body",
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  full_body: "Full Body",
};

export async function seedTemplatesFromMesocycle(userId: string): Promise<SessionTemplate[]> {
  const [existing, meso] = await Promise.all([getAllTemplates(userId), readMesocycle(userId)]);
  if (existing.length > 0 || !meso) return existing;

  const created: SessionTemplate[] = [];
  for (const [sessionType, rawExercises] of Object.entries(meso.exercises)) {
    if (!rawExercises || typeof rawExercises !== "object") continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exercises: any[] = Array.isArray(rawExercises)
      ? rawExercises
      : Object.values(rawExercises as Record<string, unknown>);
    if (exercises.length === 0) continue;
    const label = SESSION_TYPE_NAMES[sessionType]
      ?? sessionType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const template = await createTemplate(userId, {
      name: label,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      exercises: exercises.map((ex: any) => ({
        name: String(ex.name ?? ""),
        sets: Number(ex.sets) || 3,
        reps: String(ex.reps ?? "8"),
        ...(ex.note ? { notes: ex.note } : ex.notes ? { notes: ex.notes } : {}),
      })),
      isActive: true,
      mesocycleId: meso.id,
    });
    created.push(template);
  }
  return created.length > 0 ? created : existing;
}

export async function getTemplate(userId: string, templateId: string): Promise<SessionTemplate | null> {
  const [row] = await db
    .select()
    .from(sessionTemplates)
    .where(and(eq(sessionTemplates.id, templateId), eq(sessionTemplates.userId, userId)))
    .limit(1);
  return row ? rowToTemplate(row) : null;
}

export async function createTemplate(
  userId: string,
  data: { name: string; exercises: Array<{ name: string; sets: number; reps: string; notes?: string }>; isActive?: boolean; mesocycleId?: string }
): Promise<SessionTemplate> {
  const [row] = await db
    .insert(sessionTemplates)
    .values({
      userId,
      name: data.name,
      exercises: data.exercises,
      isActive: data.isActive ?? true,
      mesocycleId: data.mesocycleId ?? null,
    })
    .returning();
  return rowToTemplate(row);
}

export async function updateTemplate(
  userId: string,
  templateId: string,
  data: Partial<{ name: string; exercises: Array<{ name: string; sets: number; reps: string; notes?: string }>; isActive: boolean }>
): Promise<void> {
  await db
    .update(sessionTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(sessionTemplates.id, templateId), eq(sessionTemplates.userId, userId)));
}

export async function deleteTemplate(userId: string, templateId: string): Promise<void> {
  await db
    .delete(sessionTemplates)
    .where(and(eq(sessionTemplates.id, templateId), eq(sessionTemplates.userId, userId)));
}

function templateToGymSession(
  date: string,
  template: SessionTemplate,
  overrides: WeightOverrides
): GymSession {
  return {
    id: "",
    date,
    name: template.name,
    session_type: template.id,
    started_at: "",
    finished_at: "",
    notes: "",
    exercises: template.exercises.map((ex) => {
      const override = overrides[ex.name];
      const defaultWeight = override ? override.next_weight_kg : null;
      return {
        name: ex.name,
        target_sets: ex.sets,
        target_reps: ex.reps,
        notes: ex.notes ?? "",
        sets: Array.from({ length: ex.sets }, (_, i) => ({
          set_no: i + 1,
          reps: null,
          weight: defaultWeight,
          rpe: null,
          done: false,
        })),
      };
    }),
  };
}

// ── Mesocycle patch (manual edit) ────────────────────────────────────────────

export async function patchMesocycle(userId: string, fields: {
  name: string; goal: string; phase: string; start_date: string; end_date: string;
}): Promise<void> {
  const existing = await readMesocycle(userId);
  if (existing?.id) {
    await db.update(mesocycles)
      .set({ name: fields.name, goal: fields.goal, phase: fields.phase, startDate: fields.start_date, endDate: fields.end_date })
      .where(and(eq(mesocycles.userId, userId), eq(mesocycles.isActive, true)));
  } else {
    await db.insert(mesocycles).values({
      userId,
      name: fields.name,
      goal: fields.goal,
      phase: fields.phase,
      startDate: fields.start_date,
      endDate: fields.end_date,
      weeklyStructure: {},
      exercises: {},
      rules: {},
      warmupProtocol: {},
      isActive: true,
    });
  }
}
