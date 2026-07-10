import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeGymSession, deleteGymSession } from "@/lib/data-db";
import type { GymSession } from "@/lib/data-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { date: string } }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date } = params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  let body: GymSession;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  await writeGymSession(userId, { ...body, date });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { date: string } }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date } = params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  await deleteGymSession(userId, date);
  return NextResponse.json({ ok: true });
}
