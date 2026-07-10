import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateTemplate, deleteTemplate } from "@/lib/data-db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const ExerciseSchema = z.object({
  name: z.string().min(1),
  sets: z.number().int().min(1).max(30),
  reps: z.string(),
  notes: z.string().optional(),
});

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  exercises: z.array(ExerciseSchema).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  await updateTemplate(userId, params.id, parsed.data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await deleteTemplate(userId, params.id);
  return NextResponse.json({ ok: true });
}
