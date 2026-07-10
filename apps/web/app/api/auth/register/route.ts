import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, userSettings } from "@/lib/db/schema";

export async function POST(req: Request) {
  let body: { name?: string; email?: string; password?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, email, password } = body;
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Check if email already taken
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [newUser] = await db.insert(users).values({
    email: normalizedEmail,
    name: name?.trim() || null,
    passwordHash,
  }).returning({ id: users.id });

  // Create default settings for new user
  await db.insert(userSettings).values({
    userId: newUser.id,
    situationPrompt: "",
    restTimerDefault: 120,
    aiEnabled: true,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
