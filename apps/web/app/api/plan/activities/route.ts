import { NextResponse } from "next/server";
import { readWeekActivities, writeWeekActivities } from "@coach/lib";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const week = searchParams.get("week");
  if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(week)) {
    return NextResponse.json({ error: "provide ?week=YYYY-MM-DD" }, { status: 400 });
  }
  const activities = await readWeekActivities(week);
  return NextResponse.json(activities ?? { week_start: week, days: {} });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    await writeWeekActivities(body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
