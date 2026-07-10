import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readSettings, writeSettings } from "@/lib/data-db";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await readSettings(userId));
}

export async function PUT(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const patch = z.object({
    situation_prompt: z.string().optional(),
    rest_timer_default: z.number().int().min(30).max(600).optional(),
    ai_enabled: z.boolean().optional(),
    ai_mesocycle_enabled: z.boolean().optional(),
    ai_session_analysis_enabled: z.boolean().optional(),
    ai_briefing_enabled: z.boolean().optional(),
    ai_deload_detection_enabled: z.boolean().optional(),
  }).safeParse(body);
  if (!patch.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  return NextResponse.json(await writeSettings(userId, patch.data));
}
