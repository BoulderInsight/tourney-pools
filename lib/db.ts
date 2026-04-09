import { neon } from "@neondatabase/serverless";

export function getDb() {
  const sql = neon(process.env.DATABASE_URL!, {
    fetchOptions: { cache: "no-store" },
  });
  return sql;
}
