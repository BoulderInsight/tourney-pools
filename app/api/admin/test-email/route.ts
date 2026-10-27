import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";
import { isSuperAdmin } from "@/lib/admin-auth";

export async function POST() {
  const session = await getSession();
  if (!(await isSuperAdmin(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await sendVerificationEmail(session!.email, "test-token-12345");
    return NextResponse.json({
      ok: true,
      messageId: result.messageId,
      response: result.response,
      smtpUser: process.env.SMTP_USER ? "set" : "MISSING",
      smtpPass: process.env.SMTP_PASS ? "set" : "MISSING",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const stack = err instanceof Error ? err.stack : "";
    return NextResponse.json({
      error: message,
      stack,
      smtpUser: process.env.SMTP_USER ? "set" : "MISSING",
      smtpPass: process.env.SMTP_PASS ? "set" : "MISSING",
    }, { status: 500 });
  }
}
