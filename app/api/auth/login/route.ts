import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyPassword, createToken, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const sql = getDb();
  const result = await sql`
    SELECT id, email, password, name, email_verified FROM chairmen WHERE email = ${email.toLowerCase()}
  `;

  if (result.length === 0) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const chairman = result[0];
  const valid = await verifyPassword(password, chairman.password);
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  if (!chairman.email_verified) {
    return NextResponse.json({ error: "Please verify your email first. Check your inbox for the verification link." }, { status: 403 });
  }

  const token = await createToken({
    chairmanId: chairman.id,
    email: chairman.email,
    name: chairman.name,
  });

  setSessionCookie(token);
  return NextResponse.json({ ok: true });
}
