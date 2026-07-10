/**
 * One-time migration: reads all existing JSON data files and inserts into PostgreSQL.
 * Safe to run multiple times (idempotent via upserts).
 * Run with: npx tsx scripts/migrate-json.ts
 */
import path from "node:path";
import fs from "node:fs/promises";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import * as schema from "../apps/web/lib/db/schema.js";

const DATA_DIR = process.env.COACH_DATA_DIR ?? path.join(process.env.HOME!, ".openclaw/agents/fitness/workspace/data");
const DB_URL = process.env.DATABASE_URL!;
if (!DB_URL) throw new Error("DATABASE_URL required");

const client = postgres(DB_URL);
const db = drizzle(client, { schema });

async function readJson<T>(filePath: string): Promise<T | null> {
  try { return JSON.parse(await fs.readFile(filePath, "utf-8")) as T; } catch { return null; }
}

async function main() {
  console.log("Starting JSON → PostgreSQL migration...");
  console.log("Data dir:", DATA_DIR);

  // ── Create Sacha's user ────────────────────────────────────────────────────
  const EMAIL = "sacha.aebischer@gmail.com";
  const [existingUser] = await db.select().from(schema.users).where(eq(schema.users.email, EMAIL)).limit(1);

  let userId: string;
  if (existingUser) {
    userId = existingUser.id;
    console.log("✓ User already exists:", userId);
  } else {
    const tempPassword = "change-me-" + Math.random().toString(36).slice(2);
    const [newUser] = await db.insert(schema.users).values({
      email: EMAIL,
      name: "Sacha",
      passwordHash: await bcrypt.hash(tempPassword, 12),
    }).returning({ id: schema.users.id });
    userId = newUser.id;
    console.log("✓ Created user:", userId);
    console.log("  ⚠️  Set your password at /gym/settings or via the register page");
  }

  // ── Default settings ───────────────────────────────────────────────────────
  const settingsFile = await readJson<{ situation_prompt?: string; rest_timer_default?: number }>(
    path.join(DATA_DIR, "settings.json")
  );
  await db.insert(schema.userSettings).values({
    userId,
    situationPrompt: settingsFile?.situation_prompt ?? "",
    restTimerDefault: settingsFile?.rest_timer_default ?? 120,
    aiEnabled: true,
  }).onConflictDoUpdate({
    target: schema.userSettings.userId,
    set: {
      situationPrompt: settingsFile?.situation_prompt ?? "",
      restTimerDefault: settingsFile?.rest_timer_default ?? 120,
    },
  });
  console.log("✓ Settings migrated");

  // ── Mesocycle ──────────────────────────────────────────────────────────────
  const meso = await readJson<Record<string, unknown>>(path.join(DATA_DIR, "plan", "mesocycle.json"));
  if (meso) {
    await db.update(schema.mesocycles).set({ isActive: false }).where(eq(schema.mesocycles.userId, userId));
    await db.insert(schema.mesocycles).values({
      userId,
      name: String(meso.name ?? "Mesocycle"),
      goal: String(meso.goal ?? ""),
      phase: String(meso.phase ?? ""),
      startDate: String(meso.start_date ?? "2026-01-01"),
      endDate: String(meso.end_date ?? "2026-12-31"),
      exercises: (meso.exercises ?? {}) as Record<string, unknown>,
      weeklyStructure: (meso.weekly_structure ?? null) as Record<string, string> | null,
      rules: (meso.rules ?? {}) as Record<string, unknown>,
      warmupProtocol: (meso.warmup_protocol ?? null) as Record<string, unknown> | null,
      isActive: true,
    });
    console.log("✓ Mesocycle migrated:", meso.name);
  } else {
    console.log("  (no mesocycle.json found)");
  }

  // ── Gym sessions ───────────────────────────────────────────────────────────
  const sessionsDir = path.join(DATA_DIR, "gym", "sessions");
  let sessionFiles: string[] = [];
  try { sessionFiles = (await fs.readdir(sessionsDir)).filter((f) => f.endsWith(".json")).sort(); }
  catch { console.log("  (no sessions dir found)"); }

  let sessionCount = 0;
  for (const file of sessionFiles) {
    const date = file.replace(".json", "");
    const raw = await readJson<Record<string, unknown>>(path.join(sessionsDir, file));
    if (!raw) continue;

    // Skip if already migrated
    const [existing] = await db.select({ id: schema.gymSessions.id })
      .from(schema.gymSessions)
      .where(and(eq(schema.gymSessions.userId, userId), eq(schema.gymSessions.date, date)))
      .limit(1);
    if (existing) continue;

    const [newSession] = await db.insert(schema.gymSessions).values({
      userId,
      date,
      name: String(raw.name ?? "Gym session"),
      sessionType: (raw.session_type as string) ?? null,
      startedAt: raw.started_at ? new Date(raw.started_at as string) : null,
      finishedAt: raw.finished_at ? new Date(raw.finished_at as string) : null,
      notes: String(raw.notes ?? ""),
    }).returning({ id: schema.gymSessions.id });

    const exercises = (raw.exercises as Array<Record<string, unknown>>) ?? [];
    for (let i = 0; i < exercises.length; i++) {
      const ex = exercises[i];
      const [newEx] = await db.insert(schema.gymExercises).values({
        sessionId: newSession.id,
        name: String(ex.name ?? ""),
        targetSets: (ex.target_sets as number) ?? null,
        targetReps: (ex.target_reps as string) ?? null,
        notes: String(ex.notes ?? ""),
        orderIdx: i,
      }).returning({ id: schema.gymExercises.id });

      const sets = (ex.sets as Array<Record<string, unknown>>) ?? [];
      if (sets.length) {
        await db.insert(schema.gymSets).values(
          sets.map((s) => ({
            exerciseId: newEx.id,
            setNo: (s.set_no as number) ?? 1,
            reps: (s.reps as number) ?? null,
            weight: s.weight != null ? String(s.weight) : null,
            rpe: s.rpe != null ? String(s.rpe) : null,
            done: Boolean(s.done),
          }))
        );
      }
    }
    sessionCount++;
  }
  console.log(`✓ Migrated ${sessionCount} sessions`);

  // ── Weight overrides ───────────────────────────────────────────────────────
  const ovFile = await readJson<Record<string, unknown>>(path.join(DATA_DIR, "gym", "weight_overrides.json"));
  if (ovFile) {
    await db.delete(schema.weightOverrides).where(eq(schema.weightOverrides.userId, userId));
    const entries = Object.entries(ovFile);
    if (entries.length) {
      await db.insert(schema.weightOverrides).values(
        entries.map(([name, ov]: [string, unknown]) => {
          const o = ov as Record<string, unknown>;
          return {
            userId,
            exerciseName: name,
            nextWeightKg: String(o.next_weight_kg ?? 0),
            reason: String(o.reason ?? ""),
            fromSessionDate: (o.from_session as string) ?? null,
          };
        })
      );
    }
    console.log(`✓ Weight overrides migrated: ${entries.length}`);
  }

  // ── AI analyses ────────────────────────────────────────────────────────────
  const analysisDir = path.join(DATA_DIR, "gym", "ai_analysis");
  let analysisFiles: string[] = [];
  try { analysisFiles = (await fs.readdir(analysisDir)).filter((f) => f.endsWith(".json")); }
  catch {}

  let analysisCount = 0;
  for (const file of analysisFiles) {
    const date = file.replace(".json", "");
    const raw = await readJson<Record<string, unknown>>(path.join(analysisDir, file));
    if (!raw) continue;
    await db.insert(schema.aiAnalyses).values({
      userId,
      sessionDate: date,
      sessionSummary: String(raw.session_summary ?? ""),
      exerciseDecisions: (raw.exercise_decisions ?? []) as Record<string, unknown>[],
      overallRecommendation: String(raw.overall_recommendation ?? ""),
      analyzedAt: raw.analyzed_at ? new Date(raw.analyzed_at as string) : new Date(),
    }).onConflictDoUpdate({
      target: [schema.aiAnalyses.userId, schema.aiAnalyses.sessionDate],
      set: { sessionSummary: String(raw.session_summary ?? "") },
    });
    analysisCount++;
  }
  console.log(`✓ AI analyses migrated: ${analysisCount}`);

  // ── Exercise catalog ───────────────────────────────────────────────────────
  const catalog = await readJson<{ exercises: Array<Record<string, unknown>> }>(
    path.join(DATA_DIR, "gym", "catalog.json")
  );
  if (catalog?.exercises?.length) {
    for (const ex of catalog.exercises) {
      await db.insert(schema.exerciseCatalog).values({
        userId,
        name: String(ex.name ?? ""),
        notes: String(ex.notes ?? ""),
        defaultSets: (ex.default_sets as number) ?? null,
        defaultReps: String(ex.default_reps ?? ""),
        defaultWeight: ex.default_weight != null ? String(ex.default_weight) : null,
      }).onConflictDoNothing();
    }
    console.log(`✓ Exercise catalog migrated: ${catalog.exercises.length} exercises`);
  }

  console.log("\n✅ Migration complete!");
  await client.end();
}

main().catch((e) => { console.error("Migration failed:", e); process.exit(1); });
