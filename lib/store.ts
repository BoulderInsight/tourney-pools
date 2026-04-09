import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { PoolConfig } from "./types";

// On Vercel, only /tmp is writable. Locally, use project data/ dir.
const isVercel = !!process.env.VERCEL;
const DATA_DIR = isVercel ? "/tmp" : join(process.cwd(), "data");
const DATA_PATH = join(DATA_DIR, "pool.json");

export function readPool(): PoolConfig | null {
  try {
    if (!existsSync(DATA_PATH)) return null;
    const raw = readFileSync(DATA_PATH, "utf-8");
    return JSON.parse(raw) as PoolConfig;
  } catch {
    return null;
  }
}

export function writePool(config: PoolConfig): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  writeFileSync(DATA_PATH, JSON.stringify(config, null, 2));
}
