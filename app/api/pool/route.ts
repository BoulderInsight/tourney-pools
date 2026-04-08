import { NextResponse } from "next/server";
import { readPool } from "@/lib/store";

export async function GET() {
  const pool = readPool();
  if (!pool) {
    return NextResponse.json(null);
  }
  return NextResponse.json(pool);
}
