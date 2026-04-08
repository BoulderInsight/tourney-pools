import { NextRequest, NextResponse } from "next/server";
import { writePool } from "@/lib/store";
import { draftGolfers } from "@/lib/pool";
import { Golfer, PoolConfig } from "@/lib/types";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "masters2026";

export async function POST(req: NextRequest) {
  const adminPw = req.headers.get("x-admin-password");
  if (adminPw !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { poolName, players, golferNames, buyIn, settings } = body;

  const golfers: Golfer[] = golferNames.map((name: string, i: number) => ({
    id: `g${i}`,
    name,
    r1: null,
    r2: null,
    r3: null,
    r4: null,
    madeCut: null,
  }));

  const assignments = draftGolfers(players, golfers, settings.draftType);

  const config: PoolConfig = {
    poolName,
    players,
    golfers,
    buyIn,
    settings,
    setupComplete: true,
    assignments,
  };

  writePool(config);
  return NextResponse.json({ ok: true });
}
