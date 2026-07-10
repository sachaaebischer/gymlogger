import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { analyzeSession } from "@/lib/ai-coach-db";
import { getSessionAnalysis } from "@/lib/data-db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const date = new URL(req.url).searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json(null, { status: 400 });

  const analysis = await getSessionAnalysis(userId, date);
  if (!analysis) return NextResponse.json(null, { status: 404 });
  return NextResponse.json(analysis);
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let date: string | undefined;
  try { ({ date } = await req.json()); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Invalid date" }, { status: 400 });

  const analysis = await analyzeSession(userId, date);
  if (!analysis) return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  return NextResponse.json(analysis);
}
