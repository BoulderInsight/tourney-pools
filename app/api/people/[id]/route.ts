import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getPersonForChairman, setPersonHandles } from "@/lib/people";
import type { PaymentMethod } from "@/lib/types";

function cleanHandle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/^@+/, ""); // strip a leading @ if user typed one
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

  return NextResponse.json({ person: updated });
}
