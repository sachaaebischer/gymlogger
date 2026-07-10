import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeMesocycle } from "@/lib/data-db";
import { getTemplate } from "@/lib/mesocycle-templates";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const template = getTemplate(params.id);
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const meso = template.toMesocycle();
  await writeMesocycle(session.user.id, meso);
  return NextResponse.json({ ok: true });
}
