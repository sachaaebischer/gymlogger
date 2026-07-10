import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createTemplate } from "@/lib/data-db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const ExerciseSchema = z.object({
  name: z.string().min(1),
  sets: z.number().int().min(1).max(30),
  reps: z.string(),
  notes: z.string().optional(),
});

const CreateSchema = z.object({
  name: z.string().min(1),
  exercises: z.array(ExerciseSchema),
  isActive: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const template = await createTemplate(userId, parsed.data);
  return NextResponse.json(template, { status: 201 });
}
