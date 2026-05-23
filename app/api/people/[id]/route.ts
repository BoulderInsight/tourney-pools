import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getPersonForChairman, setPersonHandles, setPersonPhone } from "@/lib/people";
import { normalizeUsPhoneE164 } from "@/lib/phone";
import type { PaymentMethod } from "@/lib/types";

function cleanHandle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  // Tolerate both Twitter-style (@) and Cash App-style ($) sigils on input. Storage
  // stays bare so display sites can prepend the sigil consistently and the payment
  // URL builders don't double-encode it.
  const trimmed = value.trim().replace(/^[@$]+/, "");
  return trimmed.length === 0 ? null : trimmed;
}

function cleanPreferred(value: unknown): PaymentMethod | null {
  if (value === "venmo" || value === "cashapp" || value === "paypal") return value;
  return null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const existing = await getPersonForChairman(sql, params.id, session.chairmanId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const updated = await setPersonHandles(sql, params.id, {
    venmoHandle: cleanHandle(body.venmoHandle),
    cashappHandle: cleanHandle(body.cashappHandle),
    paypalHandle: cleanHandle(body.paypalHandle),
    preferredMethod: cleanPreferred(body.preferredMethod),
  });

  // Phone is chairman-only: only update when the client explicitly sends the field.
  // An empty string clears it; a non-empty string that can't be normalized to E.164
  // is rejected (caller surfaces a "re-enter" hint). The public /collect endpoint
  // never reaches this code path because it has its own handler.
  if (typeof body.phone === "string") {
    if (body.phone.trim() === "") {
      await setPersonPhone(sql, params.id, null);
    } else {
      const e164 = normalizeUsPhoneE164(body.phone);
      if (!e164) {
        return NextResponse.json({ error: "Invalid US phone number" }, { status: 400 });
      }
      await setPersonPhone(sql, params.id, e164);
    }
  } else if (body.phone === null) {
    await setPersonPhone(sql, params.id, null);
  }

  const refreshed = await getPersonForChairman(sql, params.id, session.chairmanId);
  return NextResponse.json({ person: refreshed ?? updated });
}
