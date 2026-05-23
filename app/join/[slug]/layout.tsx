import { Metadata } from "next";
import { getDb } from "@/lib/db";

/**
 * Server-side metadata so the iMessage / Slack unfurl card carries the chairman
 * and pool/tournament context, not just the generic site title. Pairs with
 * opengraph-image.tsx which renders the matching visual.
 */
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const sql = getDb();
  const rows = await sql`
    SELECT p.pool_name, c.name AS chairman_name, t.name AS tournament_name
    FROM pools p
    JOIN chairmen c ON c.id = p.chairman_id
    LEFT JOIN tournaments t ON t.id = p.tournament_id
    WHERE p.slug = ${params.slug}
  `;

  if (rows.length === 0) {
    return { title: "Pool Invitation | TourneyPools" };
  }

  const pool = rows[0];
  const chairman = (pool.chairman_name as string) || "A friend";
  const poolName = (pool.pool_name as string) || "Golf Pool";
  const tournamentName = pool.tournament_name as string | null;

  const title = `${chairman} invited you to ${poolName} | TourneyPools`;
  const description = tournamentName
    ? `${chairman} is inviting you to a ${tournamentName} pool. Tap to RSVP.`
    : `${chairman} is inviting you to a golf pool. Tap to RSVP.`;

  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
