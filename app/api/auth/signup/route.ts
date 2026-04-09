import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { hashPassword, createToken, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password, name } = await req.json();

  if (!email || !password || !name) {
    return NextResponse.json({ error: "All fields required" }, { status: 400 });
  }

  const sql = getDb();
  const existing = await sql`SELECT id FROM chairmen WHERE email = ${email.toLowerCase()}`;
  if (existing.length > 0) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const hashed = await hashPassword(password);
  const result = await sql`
    INSERT INTO chairmen (email, password, name)
    VALUES (${email.toLowerCase()}, ${hashed}, ${name})
    RETURNING id, email, name
  `;

  const chairman = result[0];
  const token = await createToken({
    chairmanId: chairman.id,
    email: chairman.email,
    name: chairman.name,
  });

  setSessionCookie(token);
  return NextResponse.json({ ok: true });
}
