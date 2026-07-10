import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clearWeightOverrides } from "@/lib/data-db";

export const dynamic = "force-dynamic";

export async function DELETE() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await clearWeightOverrides(userId);
  return NextResponse.json({ ok: true });
}
