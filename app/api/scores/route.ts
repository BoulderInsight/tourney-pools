import { NextRequest, NextResponse } from "next/server";
import { readPool, writePool } from "@/lib/store";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "masters2026";

export async function POST(req: NextRequest) {
  const adminPw = req.headers.get("x-admin-password");
  if (adminPw !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pool = readPool();
  if (!pool) {
    return NextResponse.json({ error: "No pool configured" }, { status: 404 });
  }

  const { golferId, field, value } = await req.json();

  const golfer = pool.golfers.find((g) => g.id === golferId);
  if (!golfer) {
    return NextResponse.json({ error: "Golfer not found" }, { status: 404 });
  }

  if (field === "madeCut") {
    golfer.madeCut = value;
  } else if (["r1", "r2", "r3", "r4"].includes(field)) {
    (golfer as Record<string, unknown>)[field] = value === "" || value === null ? null : Number(value);
  }

  writePool(pool);
  return NextResponse.json({ ok: true });
}
