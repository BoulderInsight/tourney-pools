import { getDb } from "@/lib/db";
import { SessionPayload } from "@/lib/auth";

/**
 * Verify that a session belongs to a super admin by re-checking the database.
 * 
 * Never trust the isSuperAdmin claim in the JWT alone - tokens can be stale
 * or the admin flag may have been revoked. Always re-check the database.
 * 
 * @param session - The session from getSession()
 * @returns true if the chairman is a super admin, false otherwise
 */
export async function isSuperAdmin(session: SessionPayload | null): Promise<boolean> {
  if (!session) {
    return false;
  }

  const sql = getDb();
  const rows = await sql`
    SELECT is_super_admin 
    FROM chairmen 
    WHERE id = ${session.chairmanId}
  `;

  if (rows.length === 0) {
    return false;
  }

  return rows[0].is_super_admin === true;
}
