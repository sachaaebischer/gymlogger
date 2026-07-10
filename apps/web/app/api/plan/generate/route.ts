import { NextResponse } from "next/server";
import { readGymSessions, writePlannedSession, readPlannedSession, deletePlannedSession } from "@coach/lib";
import { readMesocycle, generateSessionExercises } from "@/lib/data";

export const dynamic = "force-dynamic";

// GET: read existing planned session for a date
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(null);
  }
  const session = await readPlannedSession(date);
  if (!session) return NextResponse.json(null, { status: 404 });
  return NextResponse.json(session);
}

// POST: generate new planned session
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { date, session_type } = body as {
      date: string;
      session_type: "gym_upper" | "gym_lower";
    };

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "invalid date" }, { status: 400 });
    }
    if (session_type !== "gym_upper" && session_type !== "gym_lower") {
      return NextResponse.json({ error: "invalid session_type" }, { status: 400 });
    }

    const [mesocycle, sessions] = await Promise.all([
      readMesocycle(),
      readGymSessions(),
    ]);

    if (!mesocycle) {
      return NextResponse.json({ error: "no mesocycle found" }, { status: 404 });
    }

    const exercises = generateSessionExercises(mesocycle, session_type, sessions);

    const planned = {
      date,
      session_type,
      generated_at: new Date().toISOString(),
      week_notes: "",
      exercises,
    };

    await writePlannedSession(planned);
    return NextResponse.json(planned);
  } catch (e) {
    console.error("generate error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE: remove planned session
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "missing date" }, { status: 400 });
  await deletePlannedSession(date);
  return NextResponse.json({ ok: true });
}
