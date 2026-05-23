import type { NeonQueryFunction } from "@neondatabase/serverless";
import type { Group, GroupSummary, GroupWithMembers, PaymentMethod, Person } from "@/lib/types";

type Sql = NeonQueryFunction<false, false>;

function rowToGroup(row: Record<string, unknown>): Group {
  return {
    id: row.id as string,
    chairmanId: row.chairman_id as string,
    name: row.name as string,
    createdAt: (row.created_at as { toISOString?: () => string } | string)?.toString() ?? "",
  };
}

function rowToPerson(row: Record<string, unknown>): Person {
  return {
    id: row.id as string,
    chairmanId: row.chairman_id as string,
    name: row.name as string,
    venmoHandle: (row.venmo_handle as string | null) ?? null,
    cashappHandle: (row.cashapp_handle as string | null) ?? null,
    paypalHandle: (row.paypal_handle as string | null) ?? null,
    preferredMethod: (row.preferred_method as PaymentMethod | null) ?? null,
  };
}

/** List all groups owned by the chairman with a count of members in each. */
export async function listGroupsForChairman(sql: Sql, chairmanId: string): Promise<GroupSummary[]> {
  const rows = await sql`
    SELECT g.id, g.chairman_id, g.name, g.created_at,
           (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS member_count
    FROM groups g
    WHERE g.chairman_id = ${chairmanId}
    ORDER BY g.created_at DESC
  `;
  return rows.map((r) => ({
    ...rowToGroup(r),
    memberCount: Number(r.member_count),
  }));
}

/** Return a group with its members, scoped to the given chairman. Null if missing or not owned. */
export async function getGroupForChairman(
  sql: Sql,
  groupId: string,
  chairmanId: string,
): Promise<GroupWithMembers | null> {
  const groupRows = await sql`
    SELECT id, chairman_id, name, created_at
    FROM groups WHERE id = ${groupId} AND chairman_id = ${chairmanId}
  `;
  if (groupRows.length === 0) return null;
  const memberRows = await sql`
    SELECT pe.id, pe.chairman_id, pe.name, pe.venmo_handle, pe.cashapp_handle, pe.paypal_handle, pe.preferred_method
    FROM group_members gm
    JOIN people pe ON pe.id = gm.person_id
    WHERE gm.group_id = ${groupId}
    ORDER BY pe.name
  `;
  return {
    ...rowToGroup(groupRows[0]),
    members: memberRows.map(rowToPerson),
  };
}

/** Create a group. Optionally add an initial set of members (must be Person ids owned by the chairman). */
export async function createGroup(
  sql: Sql,
  chairmanId: string,
  name: string,
  initialMemberPersonIds: string[] = [],
): Promise<Group> {
  const groupRows = await sql`
    INSERT INTO groups (chairman_id, name)
    VALUES (${chairmanId}, ${name})
    RETURNING id, chairman_id, name, created_at
  `;
  const group = rowToGroup(groupRows[0]);
  for (const personId of initialMemberPersonIds) {
    // group_members is composite-PK on (group_id, person_id) so the same person inserted twice
    // would error; ON CONFLICT DO NOTHING keeps the call idempotent.
    await sql`
      INSERT INTO group_members (group_id, person_id)
      VALUES (${group.id}, ${personId})
      ON CONFLICT DO NOTHING
    `;
  }
  return group;
}

/** Rename a group. Throws if the group does not exist or is not owned by the chairman. */
export async function renameGroup(
  sql: Sql,
  groupId: string,
  chairmanId: string,
  newName: string,
): Promise<Group> {
  const rows = await sql`
    UPDATE groups SET name = ${newName}
    WHERE id = ${groupId} AND chairman_id = ${chairmanId}
    RETURNING id, chairman_id, name, created_at
  `;
  if (rows.length === 0) {
    throw new Error(`renameGroup: group ${groupId} not found for chairman ${chairmanId}`);
  }
  return rowToGroup(rows[0]);
}

/** Delete a group. The group_members rows cascade. People themselves are untouched. */
export async function deleteGroup(sql: Sql, groupId: string, chairmanId: string): Promise<boolean> {
  const rows = await sql`
    DELETE FROM groups
    WHERE id = ${groupId} AND chairman_id = ${chairmanId}
    RETURNING id
  `;
  return rows.length > 0;
}

/** Add an existing Person to a group. Idempotent via ON CONFLICT. */
export async function addMemberToGroup(
  sql: Sql,
  groupId: string,
  personId: string,
): Promise<void> {
  await sql`
    INSERT INTO group_members (group_id, person_id)
    VALUES (${groupId}, ${personId})
    ON CONFLICT DO NOTHING
  `;
}

/** Remove a member from a group. Returns true if a row was deleted. */
export async function removeMemberFromGroup(
  sql: Sql,
  groupId: string,
  personId: string,
): Promise<boolean> {
  const rows = await sql`
    DELETE FROM group_members
    WHERE group_id = ${groupId} AND person_id = ${personId}
    RETURNING group_id
  `;
  return rows.length > 0;
}

/** Quick ownership check used by API routes that need to verify access to a group. */
export async function groupExistsForChairman(
  sql: Sql,
  groupId: string,
  chairmanId: string,
): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM groups WHERE id = ${groupId} AND chairman_id = ${chairmanId} LIMIT 1
  `;
  return rows.length > 0;
}
