import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyPassword, createToken, authCookieOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const db = getDb();
    const user = db.prepare("SELECT id, email, password_hash FROM users WHERE email = ?").get(email) as
      | { id: string; email: string; password_hash: string }
      | undefined;

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const token = await createToken(user.id, user.email);
    const res = NextResponse.json({ user: { id: user.id, email: user.email } });
    res.cookies.set(authCookieOptions(token));
    return res;
  } catch (e) {
    console.error("Signin error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
