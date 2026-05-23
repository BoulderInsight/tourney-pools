import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { setPersonHandles } from "@/lib/people";
import type { PaymentMethod } from "@/lib/types";

export const dynamic = "force-dynamic";

interface TokenContext {
  personId: string;
  personName: string;
  commissionerName: string;
  poolName: string;
  tournamentName: string | null;
  submittedAt: string | null;
}

async function loadContext(
  sql: ReturnType<typeof getDb>,
  token: string,
): Promise<TokenContext | null> {
  const rows = await sql`
    SELECT cr.person_id, cr.submitted_at,
           pe.name AS person_name,
           p.pool_name,
           c.name AS commissioner_name,
           t.name AS tournament_name
    FROM collection_requests cr
    JOIN people pe ON pe.id = cr.person_id
    JOIN pools p ON p.id = cr.pool_id
    JOIN chairmen c ON c.id = p.chairman_id
    LEFT JOIN tournaments t ON t.id = p.tournament_id
    WHERE cr.token = ${token}
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    personId: r.person_id as string,
    personName: r.person_name as string,
    commissionerName: r.commissioner_name as string,
    poolName: r.pool_name as string,
    tournamentName: (r.tournament_name as string | null) ?? null,
    submittedAt: (r.submitted_at as string | null) ?? null,
  };
}

function cleanHandle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/^@+/, "");
  return trimmed.length === 0 ? null : trimmed;
}

function cleanPreferred(value: unknown): PaymentMethod | null {
  if (value === "venmo" || value === "cashapp" || value === "paypal") return value;
  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  const sql = getDb();
  const ctx = await loadContext(sql, params.token);
  if (!ctx) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }
  // Do NOT expose handles. The page only needs context to address the recipient.
  return NextResponse.json({
    personName: ctx.personName,
    commissionerName: ctx.commissionerName,
    poolName: ctx.poolName,
    tournamentName: ctx.tournamentName,
    submitted: ctx.submittedAt !== null,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  const sql = getDb();
  const ctx = await loadContext(sql, params.token);
  if (!ctx) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  // A link is single-use. Once submitted, reject further writes so a leaked token
  // cannot be used to overwrite the recipient's handles with someone else's.
  if (ctx.submittedAt) {
    return NextResponse.json({ error: "This link has already been used. Ask the chairman for a new one." }, { status: 409 });
  }

  const body = await req.json();
  await setPersonHandles(sql, ctx.personId, {
    venmoHandle: cleanHandle(body.venmoHandle),
    cashappHandle: cleanHandle(body.cashappHandle),
    paypalHandle: cleanHandle(body.paypalHandle),
    preferredMethod: cleanPreferred(body.preferredMethod),
  });
  await sql`
    UPDATE collection_requests
    SET submitted_at = COALESCE(submitted_at, now())
    WHERE token = ${params.token}
  `;
  return NextResponse.json({ ok: true });
}
