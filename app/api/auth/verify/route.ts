import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createToken, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { token } = await req.json();

  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const sql = getDb();
  const result = await sql`
    UPDATE chairmen
    SET email_verified = true, verification_token = NULL
    WHERE verification_token = ${token} AND email_verified = false
    RETURNING id, email, name, is_super_admin
  `;

  if (result.length === 0) {
    return NextResponse.json({ error: "Invalid or expired verification link" }, { status: 400 });
  }

  const chairman = result[0];
  const sessionToken = await createToken({
    chairmanId: chairman.id,
    email: chairman.email,
    name: chairman.name,
    isSuperAdmin: chairman.is_super_admin || false,
  });

  setSessionCookie(sessionToken);
  return NextResponse.json({ ok: true });
}
