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
    // Same PWA install metadata as the leaderboard layout so an invitee who
    // taps Save to Home Screen from /join gets the pool-named icon and the
    // app-style standalone launch. Reuses the per-pool manifest at
    // /pool/[slug]/manifest.webmanifest (start_url points at the leaderboard
    // so post-install taps go straight to live scores, regardless of where
    // the icon was originally saved from).
    manifest: `/pool/${params.slug}/manifest.webmanifest`,
    appleWebApp: {
      capable: true,
      title: poolName,
      statusBarStyle: "black-translucent",
    },
    icons: {
      icon: "/favicon.png",
      apple: "/apple-touch-icon.png",
    },
  };
}

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
