import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendResetPasswordEmail } from "@/lib/email";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const sql = getDb();
  const rows = await sql`SELECT id FROM chairmen WHERE email = ${email.toLowerCase()} AND email_verified = true`;

  // Always return success to prevent email enumeration
  if (rows.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const token = nanoid(32);
  await sql`UPDATE chairmen SET verification_token = ${token} WHERE id = ${rows[0].id}`;

  try {
    await sendResetPasswordEmail(email.toLowerCase(), token);
  } catch (err) {
    console.error("Reset password email failed:", err);
  }

  return NextResponse.json({ ok: true });
}
