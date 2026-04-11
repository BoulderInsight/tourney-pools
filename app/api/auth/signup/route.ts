import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest) {
  const { email, password, name } = await req.json();

  if (!email || !password || !name) {
    return NextResponse.json({ error: "All fields required" }, { status: 400 });
  }

  const sql = getDb();
  const existing = await sql`SELECT id, email_verified FROM chairmen WHERE email = ${email.toLowerCase()}`;
  if (existing.length > 0) {
    if (!existing[0].email_verified) {
      // Resend verification email
      const token = nanoid(32);
      await sql`UPDATE chairmen SET verification_token = ${token} WHERE id = ${existing[0].id}`;
      try {
        await sendVerificationEmail(email.toLowerCase(), token);
      } catch (err) {
        console.error("Verification email failed (resend):", err);
      }
      return NextResponse.json({ needsVerification: true });
    }
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const hashed = await hashPassword(password);
  const verificationToken = nanoid(32);

  await sql`
    INSERT INTO chairmen (email, password, name, email_verified, verification_token)
    VALUES (${email.toLowerCase()}, ${hashed}, ${name}, false, ${verificationToken})
  `;

  try {
    await sendVerificationEmail(email.toLowerCase(), verificationToken);
  } catch (err) {
    console.error("Verification email failed:", err);
  }

  return NextResponse.json({ needsVerification: true });
}
