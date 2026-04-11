import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sendFeedbackEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { message } = await req.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  try {
    await sendFeedbackEmail(session.name, session.email, message.trim());
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Feedback email failed:", err);
    return NextResponse.json({ error: "Failed to send feedback" }, { status: 500 });
  }
}
