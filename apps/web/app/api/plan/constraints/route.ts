import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { WeekConstraintsSchema, readConstraints, writeConstraints } from "@coach/lib";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const week = searchParams.get("week") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) {
    return NextResponse.json({ error: "invalid week parameter" }, { status: 400 });
  }
  const constraints = await readConstraints(week);
  return NextResponse.json(constraints ?? { week_start: week, fixed_events: [] });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = WeekConstraintsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid constraints", issues: parsed.error.issues }, { status: 400 });
  }
  await writeConstraints(parsed.data);

  // Fire a one-shot replan job. Errors here are non-fatal.
  try {
    injectReplanJob(parsed.data.week_start);
  } catch {
    // best-effort
  }

  return NextResponse.json({ ok: true });
}

// Returns a cron expression that fires exactly once, ~2 minutes from now (UTC).
function oneShotCron(): string {
  const t = new Date(Date.now() + 2 * 60 * 1000);
  return `${t.getUTCMinutes()} ${t.getUTCHours()} ${t.getUTCDate()} ${t.getUTCMonth() + 1} *`;
}

function injectReplanJob(weekStart: string): void {
  const jobsPath = path.join(os.homedir(), ".openclaw", "cron", "jobs.json");
  const raw = JSON.parse(fs.readFileSync(jobsPath, "utf8"));

  // Remove any pending replan job to avoid duplicates.
  raw.jobs = (raw.jobs as any[]).filter((j: any) => j.name !== "Re-plan (constraint update)");

  const today = new Date().toLocaleDateString("sv");
  const id = randomUUID();

  const planEditCmd = `cd /home/sacha/coach && COACH_DATA_DIR=/home/sacha/.openclaw/agents/fitness/workspace/data npm run plan-edit --workspace @coach/fetcher --`;
  const validateCmd = `cd /home/sacha/coach && COACH_DATA_DIR=/home/sacha/.openclaw/agents/fitness/workspace/data npm run validate-plan --workspace @coach/fetcher`;

  raw.jobs.push({
    id,
    agentId: "fitness",
    name: "Re-plan (constraint update)",
    enabled: true,
    deleteAfterRun: true,
    createdAtMs: Date.now(),
    schedule: { kind: "cron", expr: oneShotCron(), tz: "UTC" },
    sessionTarget: "isolated",
    payload: {
      kind: "agentTurn",
      message:
        `CONSTRAINTS UPDATE — Re-plan the week of ${weekStart}.\n\n` +
        `HARD RULES:\n` +
        `- Use plan-edit CLI only. Do NOT edit plan/current.json directly.\n` +
        `- NEVER call 'plan-edit set' on a LOCKED day. LOCKED days are shown by 'plan-edit init'.\n` +
        `- Do NOT change sessions already completed before today (${today}).\n\n` +
        `STEP 1 — Re-initialize to bake in updated constraints (this pre-fills locked days automatically):\n` +
        `  ${planEditCmd} init ${weekStart}\n` +
        `  Read the output: note which days are LOCKED.\n\n` +
        `STEP 2 — Re-set the FREE days that are today (${today}) or later.\n` +
        `  Read data/health/daily.csv, data/activities/activities.csv, data/gym/log.csv for context.\n` +
        `  Rest:    ${planEditCmd} set <date> rest\n` +
        `  Session: ${planEditCmd} set <date> '{"type":"...","title":"...","planned_at":"HH:MM","intensity":"...","details":"..."}'\n\n` +
        `STEP 3 — Validate (must print 'Plan OK'):\n` +
        `  ${validateCmd}\n\n` +
        `STEP 4 — Send Sacha ONE concise Telegram message summarising what changed. Do not send multiple messages.`,
      timeoutSeconds: 600,
    },
    delivery: {
      mode: "announce",
      channel: "telegram",
      to: "telegram:7789196354",
    },
    state: {},
  });

  const tmp = `${jobsPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(raw, null, 2) + "\n");
  fs.renameSync(tmp, jobsPath);
}
