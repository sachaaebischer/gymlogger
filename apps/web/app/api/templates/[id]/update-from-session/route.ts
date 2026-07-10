import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTemplate, updateTemplate, createTemplate } from "@/lib/data-db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const ExerciseSchema = z.object({
  name: z.string().min(1),
  sets: z.number().int().min(1).max(30),
  reps: z.string(),
  notes: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const old = await getTemplate(userId, params.id);
  if (!old) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = z.object({ exercises: z.array(ExerciseSchema) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  // Archive old template, create new one with same name + updated exercises
  await updateTemplate(userId, params.id, { isActive: false });
  const created = await createTemplate(userId, {
    name: old.name,
    exercises: parsed.data.exercises,
    isActive: true,
    mesocycleId: old.mesocycleId ?? undefined,
  });

  return NextResponse.json(created, { status: 201 });
}
