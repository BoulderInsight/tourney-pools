import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest) {
  const { email, name } = await req.json();

  if (!email || !name) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  const sql = getDb();
  const existing = await sql`SELECT id, email_verified FROM chairmen WHERE email = ${email.toLowerCase()}`;
  if (existing.length > 0) {
    if (!existing[0].email_verified) {
      // Resend verification email
      const token = nanoid(32);
      await sql`UPDATE chairmen SET verification_token = ${token}, name = ${name} WHERE id = ${existing[0].id}`;
      try {
        await sendVerificationEmail(email.toLowerCase(), token);
      } catch (err) {
        console.error("Verification email failed (resend):", err);
      }
      return NextResponse.json({ needsVerification: true });
    }
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const verificationToken = nanoid(32);

  // Create account without a password — they'll set it when they click the email link
  await sql`
    INSERT INTO chairmen (email, password, name, email_verified, verification_token)
    VALUES (${email.toLowerCase()}, '', ${name}, false, ${verificationToken})
  `;

  try {
    await sendVerificationEmail(email.toLowerCase(), verificationToken);
  } catch (err) {
    console.error("Verification email failed:", err);
  }

  return NextResponse.json({ needsVerification: true });
}
