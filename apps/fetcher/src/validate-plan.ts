import { PlanSchema, WeekConstraintsSchema, paths, readJson } from "@coach/lib";
import fs from "node:fs";

/**
 * Validates plan/current.json against the schema AND constraint file.
 * The coach agent must run this after writing a plan to catch mistakes.
 */
async function main() {
  const raw = await readJson<unknown>(paths.planJson());
  if (!raw) {
    console.error(`No plan found at ${paths.planJson()}`);
    process.exit(1);
  }

  // Schema check
  const result = PlanSchema.safeParse(raw);
  if (!result.success) {
    console.error("Plan is INVALID (schema errors):\n");
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
    process.exit(1);
  }
  const plan = result.data;

  // Constraint check
  const constraintsPath = paths.constraints(plan.week_start);
  const violations: string[] = [];
  if (fs.existsSync(constraintsPath)) {
    const rawC = await readJson<unknown>(constraintsPath);
    const parsedC = WeekConstraintsSchema.safeParse(rawC);
    if (parsedC.success) {
      for (const fe of parsedC.data.fixed_events) {
        const day = plan.days.find((d) => d.date === fe.date);
        if (!day) {
          violations.push(`${fe.date}: missing from plan (constrained to ${fe.type}: "${fe.title}")`);
          continue;
        }
        if (fe.type === "rest") {
          // Rest constraint: day must have no non-rest sessions
          const nonRest = day.sessions.filter((s) => s.type !== "rest");
          if (nonRest.length > 0) {
            violations.push(
              `${fe.date}: constrained as REST but has sessions: ${nonRest.map((s) => s.type).join(", ")}`
            );
          }
        } else {
          // Activity constraint: day must have at least one session with matching type
          const match = day.sessions.find((s) => s.type === fe.type);
          if (!match) {
            const actual = day.sessions.length === 0 ? "rest" : day.sessions.map((s) => s.type).join(", ");
            violations.push(
              `${fe.date}: constrained to "${fe.type}: ${fe.title}" but has: ${actual}`
            );
          }
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error("Plan is INVALID (constraint violations):\n");
    for (const v of violations) {
      console.error(`  - ${v}`);
    }
    console.error(
      "\nFix: run 'plan-edit init <week_start>' to reset constrained days, then re-set the free days."
    );
    process.exit(1);
  }

  const sessions = plan.days.reduce((n, d) => n + d.sessions.length, 0);
  console.log(`Plan OK: week of ${plan.week_start}, ${plan.days.length} days, ${sessions} sessions.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
