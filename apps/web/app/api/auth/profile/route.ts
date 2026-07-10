import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { getUserPasswordHash, updateUserName, updateUserPassword } from "@/lib/data-db";

export async function PATCH(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  if ("name" in body) {
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    await updateUserName(userId, name);
    return NextResponse.json({ ok: true });
  }

  if ("currentPassword" in body) {
    const { currentPassword, newPassword } = body;
    const hash = await getUserPasswordHash(userId);
    if (!hash) return NextResponse.json({ error: "No password set" }, { status: 400 });
    const valid = await bcrypt.compare(String(currentPassword), hash);
    if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    if (!newPassword || String(newPassword).length < 6)
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    const newHash = await bcrypt.hash(String(newPassword), 12);
    await updateUserPassword(userId, newHash);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}
