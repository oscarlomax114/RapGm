import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { hashPassword, createToken, authCookieOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const db = getDb();
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    db.prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)").run(id, email, passwordHash);

    const token = await createToken(id, email);
    const res = NextResponse.json({ user: { id, email } });
    res.cookies.set(authCookieOptions(token));
    return res;
  } catch (e) {
    console.error("Signup error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
