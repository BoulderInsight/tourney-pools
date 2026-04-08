import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { PoolConfig } from "./types";

const DATA_PATH = join(process.cwd(), "data", "pool.json");

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
  const { mkdirSync } = require("fs");
  const dir = join(process.cwd(), "data");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(DATA_PATH, JSON.stringify(config, null, 2));
}
