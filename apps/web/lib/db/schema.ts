import {
  pgTable, uuid, text, timestamp, boolean, integer,
  numeric, date, jsonb, uniqueIndex, index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash"),
  emailVerified: timestamp("email_verified"),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
});

// ── Auth.js required tables ───────────────────────────────────────────────────

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (t) => ({
  providerUq: uniqueIndex("accounts_provider_uq").on(t.provider, t.providerAccountId),
}));

export const authSessions = pgTable("auth_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionToken: text("session_token").notNull().unique(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires").notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull().unique(),
  expires: timestamp("expires").notNull(),
});

// ── User settings ─────────────────────────────────────────────────────────────

export const userSettings = pgTable("user_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  situationPrompt: text("situation_prompt").default("").notNull(),
  restTimerDefault: integer("rest_timer_default").default(120).notNull(),
  aiEnabled: boolean("ai_enabled").default(true).notNull(),
  aiMesocycleEnabled: boolean("ai_mesocycle_enabled").default(true).notNull(),
  aiSessionAnalysisEnabled: boolean("ai_session_analysis_enabled").default(true).notNull(),
  aiBriefingEnabled: boolean("ai_briefing_enabled").default(true).notNull(),
  aiSubstitutionEnabled: boolean("ai_substitution_enabled").default(true).notNull(),
  aiDeloadDetectionEnabled: boolean("ai_deload_detection_enabled").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Mesocycles ────────────────────────────────────────────────────────────────

export const mesocycles = pgTable("mesocycles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  goal: text("goal").default("").notNull(),
  phase: text("phase").default("").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  weeklyStructure: jsonb("weekly_structure"),
  exercises: jsonb("exercises").notNull(), // { gym_upper: {...}, gym_lower: {...} }
  rules: jsonb("rules"),
  warmupProtocol: jsonb("warmup_protocol"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  userIdx: index("mesocycles_user_idx").on(t.userId),
}));

// ── Gym sessions ──────────────────────────────────────────────────────────────

export const gymSessions = pgTable("gym_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  name: text("name").notNull(),
  sessionType: text("session_type"), // gym_upper | gym_lower | custom
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  notes: text("notes").default("").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  userDateUq: uniqueIndex("gym_sessions_user_date_uq").on(t.userId, t.date),
  userIdx: index("gym_sessions_user_idx").on(t.userId),
}));

export const gymExercises = pgTable("gym_exercises", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").notNull().references(() => gymSessions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  targetSets: integer("target_sets"),
  targetReps: text("target_reps"),
  notes: text("notes").default("").notNull(),
  orderIdx: integer("order_idx").notNull().default(0),
});

export const gymSets = pgTable("gym_sets", {
  id: uuid("id").defaultRandom().primaryKey(),
  exerciseId: uuid("exercise_id").notNull().references(() => gymExercises.id, { onDelete: "cascade" }),
  setNo: integer("set_no").notNull(),
  reps: integer("reps"),
  weight: numeric("weight", { precision: 6, scale: 2 }),
  rpe: numeric("rpe", { precision: 3, scale: 1 }),
  done: boolean("done").default(false).notNull(),
});

// ── Exercise catalog ──────────────────────────────────────────────────────────

export const exerciseCatalog = pgTable("exercise_catalog", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }), // null = global
  name: text("name").notNull(),
  notes: text("notes").default("").notNull(),
  defaultSets: integer("default_sets"),
  defaultReps: text("default_reps"),
  defaultWeight: numeric("default_weight", { precision: 6, scale: 2 }),
  muscleGroups: jsonb("muscle_groups").$type<string[]>(),
  equipment: text("equipment"), // barbell | dumbbell | cable | machine | bodyweight
  createdByAi: boolean("created_by_ai").default(false).notNull(),
});

// ── Personal records ──────────────────────────────────────────────────────────

export const personalRecords = pgTable("personal_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  exerciseName: text("exercise_name").notNull(),
  weight: numeric("weight", { precision: 6, scale: 2 }),
  reps: integer("reps"),
  e1rm: numeric("e1rm", { precision: 6, scale: 2 }),
  achievedAt: date("achieved_at").notNull(),
}, (t) => ({
  userExerciseIdx: index("prs_user_exercise_idx").on(t.userId, t.exerciseName),
}));

// ── AI tables ─────────────────────────────────────────────────────────────────

export const aiAnalyses = pgTable("ai_analyses", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").references(() => gymSessions.id, { onDelete: "set null" }),
  sessionDate: date("session_date").notNull(),
  sessionSummary: text("session_summary"),
  exerciseDecisions: jsonb("exercise_decisions"),
  overallRecommendation: text("overall_recommendation"),
  analyzedAt: timestamp("analyzed_at").defaultNow().notNull(),
}, (t) => ({
  userDateUq: uniqueIndex("ai_analyses_user_date_uq").on(t.userId, t.sessionDate),
}));

export const aiBriefings = pgTable("ai_briefings", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").references(() => gymSessions.id, { onDelete: "set null" }),
  sessionDate: date("session_date").notNull(),
  note: text("note").notNull(),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
}, (t) => ({
  userDateUq: uniqueIndex("ai_briefings_user_date_uq").on(t.userId, t.sessionDate),
}));

export const weightOverrides = pgTable("weight_overrides", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  exerciseName: text("exercise_name").notNull(),
  nextWeightKg: numeric("next_weight_kg", { precision: 6, scale: 2 }).notNull(),
  reason: text("reason").default("").notNull(),
  fromSessionDate: date("from_session_date"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  userExerciseUq: uniqueIndex("weight_overrides_user_exercise_uq").on(t.userId, t.exerciseName),
}));

// ── Body weight log ───────────────────────────────────────────────────────────

export const bodyWeightLog = pgTable("body_weight_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  kg: numeric("kg", { precision: 5, scale: 1 }).notNull(),
}, (t) => ({
  userDateUq: uniqueIndex("body_weight_user_date_uq").on(t.userId, t.date),
}));



// ── Session templates ─────────────────────────────────────────────────────────

export const sessionTemplates = pgTable("session_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  exercises: jsonb("exercises").notNull().$type<Array<{ name: string; sets: number; reps: string; notes?: string }>>(),
  isActive: boolean("is_active").notNull().default(true),
  mesocycleId: uuid("mesocycle_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  userIdx: index("session_templates_user_idx").on(t.userId),
}));

// ── Weekly AI Summaries ───────────────────────────────────────────────────────

export const weeklyAiSummaries = pgTable("weekly_ai_summaries", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  weekStart: text("week_start").notNull(),
  summary: text("summary").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  userWeekUq: uniqueIndex("weekly_summary_user_week_uq").on(t.userId, t.weekStart),
}));
// ── Relations ─────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ one, many }) => ({
  settings: one(userSettings),
  mesocycles: many(mesocycles),
  gymSessions: many(gymSessions),
  personalRecords: many(personalRecords),
  aiAnalyses: many(aiAnalyses),
  weightOverrides: many(weightOverrides),
  bodyWeightLog: many(bodyWeightLog),
  weeklySummaries: many(weeklyAiSummaries),
  sessionTemplates: many(sessionTemplates),
}));

export const gymSessionsRelations = relations(gymSessions, ({ one, many }) => ({
  user: one(users, { fields: [gymSessions.userId], references: [users.id] }),
  exercises: many(gymExercises),
}));

export const gymExercisesRelations = relations(gymExercises, ({ one, many }) => ({
  session: one(gymSessions, { fields: [gymExercises.sessionId], references: [gymSessions.id] }),
  sets: many(gymSets),
}));

export const gymSetsRelations = relations(gymSets, ({ one }) => ({
  exercise: one(gymExercises, { fields: [gymSets.exerciseId], references: [gymExercises.id] }),
}));
