/**
 * plan-edit — the ONLY way the coach agent should modify the weekly plan.
 * Enforces schema and constraint compliance; refuses to touch constrained days.
 *
 * Usage:
 *   plan-edit init <YYYY-MM-DD>         — create new week plan (Monday date)
 *   plan-edit set <YYYY-MM-DD> rest     — mark day as rest
 *   plan-edit set <YYYY-MM-DD> '<json>' — set session(s) for day
 *   plan-edit show                      — print current plan
 *
 * The <json> for a session must match PlannedSessionSchema:
 *   { "type": "gym|floorball|bike|run|rest|...",
 *     "title": "...",
 *     "planned_at": "HH:MM",        (optional)
 *     "duration_min": 60,           (optional)
 *     "intensity": "easy|moderate|hard",  (optional)
 *     "details": "...",             (optional — shown in dashboard)
 *     "exercises": [...]            (optional — for gym sessions)
 *   }
 */

import fs from "node:fs";
import {
  paths,
  PlanSchema,
  PlannedSessionSchema,
  WeekConstraintsSchema,
  readConstraints,
  readPlan,
  writePlan,
} from "@coach/lib";
import type { Plan, PlannedSession } from "@coach/lib";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function weekdayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function datesOfWeek(weekStart: string): string[] {
  const [y, m, d] = weekStart.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(base);
    dt.setUTCDate(dt.getUTCDate() + i);
    return dt.toISOString().slice(0, 10);
  });
}

async function loadConstraints(weekStart: string) {
  const c = await readConstraints(weekStart);
  return new Map(c?.fixed_events.map((e) => [e.date, e]) ?? []);
}

function printPlan(plan: Plan) {
  console.log(`\nPlan: week of ${plan.week_start}`);
  for (const day of plan.days) {
    const label =
      day.sessions.length === 0
        ? "— rest —"
        : day.sessions.map((s) => `${s.type}: ${s.title}`).join(" + ");
    console.log(`  ${day.date}  ${day.weekday.padEnd(9)}  ${label}`);
  }
  console.log();
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);

  /* ── show ─────────────────────────────────────────────────────────── */
  if (!cmd || cmd === "show") {
    const plan = await readPlan();
    if (!plan) { console.log("No plan found."); return; }
    printPlan(plan);
    return;
  }

  /* ── init <week_start> ────────────────────────────────────────────── */
  if (cmd === "init") {
    const weekStart = args[0];
    if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      console.error("Usage: plan-edit init <YYYY-MM-DD>  (must be a Monday)");
      process.exit(1);
    }
    const fixed = await loadConstraints(weekStart);
    const days = datesOfWeek(weekStart).map((date) => {
      const fe = fixed.get(date);
      if (fe) {
        const session: PlannedSession = {
          type: fe.type,
          title: fe.title,
          planned_at: fe.time || "",
          duration_min: null,
          intensity: "",
          details: fe.notes || "",
          exercises: [],
        };
        return { date, weekday: weekdayOf(date), sessions: [session] };
      }
      return { date, weekday: weekdayOf(date), sessions: [] };
    });

    const plan: Plan = {
      week_start: weekStart,
      generated_at: new Date().toISOString(),
      days,
      notes: "",
    };
    const check = PlanSchema.safeParse(plan);
    if (!check.success) {
      console.error("Internal schema error during init:", check.error.issues);
      process.exit(1);
    }
    await writePlan(check.data);
    console.log(`\nInitialized plan for week of ${weekStart}.`);
    if (fixed.size > 0) {
      console.log("Constrained days (pre-filled, do NOT call set on these):");
      for (const [date, fe] of fixed) {
        console.log(`  LOCKED  ${date}  ${fe.type}: ${fe.title}`);
      }
    } else {
      console.log("No constraints found for this week.");
    }
    printPlan(check.data);
    return;
  }

  /* ── set <date> <rest | json> ─────────────────────────────────────── */
  if (cmd === "set") {
    const dateStr = args[0];
    const sessionArg = args.slice(1).join(" "); // allow spaces in JSON
    if (!dateStr || !sessionArg) {
      console.error("Usage: plan-edit set <YYYY-MM-DD> rest");
      console.error("       plan-edit set <YYYY-MM-DD> '{\"type\":\"gym\",\"title\":\"...\", ...}'");
      process.exit(1);
    }

    const plan = await readPlan();
    if (!plan) {
      console.error("No plan found. Run: plan-edit init <week_start>");
      process.exit(1);
    }

    // Block constrained days
    const fixed = await loadConstraints(plan.week_start);
    if (fixed.has(dateStr)) {
      const fe = fixed.get(dateStr)!;
      console.error(`\nBLOCKED: ${dateStr} is a fixed constraint (${fe.type}: "${fe.title}").`);
      console.error("Constrained days are pre-filled by 'plan-edit init' and cannot be changed.");
      console.error("If the constraint itself needs changing, ask Sacha to update it in the dashboard.");
      process.exit(1);
    }

    const dayIdx = plan.days.findIndex((d) => d.date === dateStr);
    if (dayIdx === -1) {
      console.error(`Date ${dateStr} is not part of the current plan (week of ${plan.week_start}).`);
      process.exit(1);
    }

    // Build sessions
    let sessions: PlannedSession[];
    if (sessionArg.trim().toLowerCase() === "rest") {
      sessions = [];
    } else {
      let raw: unknown;
      try {
        raw = JSON.parse(sessionArg.trim());
      } catch {
        console.error("Invalid JSON. Provide a valid session object or the word 'rest'.");
        console.error("Example: plan-edit set 2026-07-01 '{\"type\":\"gym\",\"title\":\"Gym — Upper\",\"planned_at\":\"09:00\",\"intensity\":\"hard\",\"details\":\"Push focus: Bench, OHP, Dips\"}'");
        process.exit(1);
      }
      const items = Array.isArray(raw) ? raw : [raw];
      sessions = [];
      for (let i = 0; i < items.length; i++) {
        const r = PlannedSessionSchema.safeParse(items[i]);
        if (!r.success) {
          console.error(`\nSession ${i + 1} is invalid:`);
          for (const issue of r.error.issues) {
            console.error(`  - ${issue.path.join(".") || "(root)"}: ${issue.message}`);
          }
          console.error("\nRequired field: type, title");
          console.error("Optional fields: planned_at (HH:MM), duration_min, intensity, details, exercises");
          process.exit(1);
        }
        sessions.push(r.data);
      }
    }

    plan.days[dayIdx].sessions = sessions;
    plan.generated_at = new Date().toISOString();

    const check = PlanSchema.safeParse(plan);
    if (!check.success) {
      console.error("Plan failed schema validation after update:", check.error.issues);
      process.exit(1);
    }
    await writePlan(check.data);

    const label = sessions.length === 0 ? "rest" : sessions.map((s) => `${s.type}: ${s.title}`).join(" + ");
    console.log(`Set ${dateStr} (${plan.days[dayIdx].weekday}): ${label}`);
    return;
  }

  console.error(`Unknown command: ${cmd}`);
  console.error("Available: init <week_start> | set <date> <rest|json> | show");
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
