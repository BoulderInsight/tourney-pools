import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { hashPassword, createToken, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();

  if (!token || !password) {
    return NextResponse.json({ error: "Token and password are required" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const sql = getDb();

  // Find the chairman by token
  const rows = await sql`
    SELECT id, email, name, is_super_admin, email_verified
    FROM chairmen
    WHERE verification_token = ${token}
  `;

  if (rows.length === 0) {
    return NextResponse.json({ error: "Invalid or expired link. Please request a new one." }, { status: 400 });
  }

  const chairman = rows[0];
  const hashed = await hashPassword(password);

  // Set the password, verify email if not already, clear the token
  await sql`
    UPDATE chairmen
    SET password = ${hashed}, email_verified = true, verification_token = NULL
    WHERE id = ${chairman.id}
  `;

  // Auto-login
  const sessionToken = await createToken({
    chairmanId: chairman.id,
    email: chairman.email,
    name: chairman.name,
    isSuperAdmin: chairman.is_super_admin || false,
  });

  setSessionCookie(sessionToken);
  return NextResponse.json({ ok: true });
}
