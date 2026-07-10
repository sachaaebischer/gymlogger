import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTemplate, updateTemplate } from "@/lib/data-db";

export const dynamic = "force-dynamic";

export async function PATCH(_: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const template = await getTemplate(userId, params.id);
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await updateTemplate(userId, params.id, { isActive: !template.isActive });
  return NextResponse.json({ ok: true });
}
