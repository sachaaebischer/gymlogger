import { NextResponse } from "next/server";
import { readPlanForWeek, listPlanWeeks } from "@coach/lib";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const week = searchParams.get("week");

  if (week === "list") {
    const weeks = await listPlanWeeks();
    return NextResponse.json({ weeks });
  }

  if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(week)) {
    return NextResponse.json({ error: "provide ?week=YYYY-MM-DD or ?week=list" }, { status: 400 });
  }

  const plan = await readPlanForWeek(week);
  if (!plan) {
    return NextResponse.json({ error: "no plan for this week" }, { status: 404 });
  }
  return NextResponse.json(plan);
}
