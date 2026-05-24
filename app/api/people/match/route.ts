import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { findPeopleByName } from "@/lib/people";

export const dynamic = "force-dynamic";

/**
 * Chairman-only collision check used by add-player forms. Given a name, returns
 * any existing People for this chairman that share the name AND already have
 * meaningful data (phone or any payment handle).
 *
 * People with no data are intentionally omitted from the response: linking a
 * new player to an empty Person silently and matching it later are equivalent,
 * so there's no UX value in surfacing the choice.
 *
 * GET /api/people/match?name=Christi
 *   -> { matches: [{ id, name, phone, venmoHandle, cashappHandle, paypalHandle, preferredMethod }] }
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const name = (req.nextUrl.searchParams.get("name") ?? "").trim();
  if (name.length === 0) {
    return NextResponse.json({ matches: [] });
  }

  const sql = getDb();
  const candidates = await findPeopleByName(sql, session.chairmanId, name);
  const matches = candidates
    .filter(
      (p) =>
        p.phone || p.venmoHandle || p.cashappHandle || p.paypalHandle,
    )
    .map((p) => ({
      id: p.id,
      name: p.name,
      phone: p.phone,
      venmoHandle: p.venmoHandle,
      cashappHandle: p.cashappHandle,
      paypalHandle: p.paypalHandle,
      preferredMethod: p.preferredMethod,
    }));

  return NextResponse.json({ matches });
}
