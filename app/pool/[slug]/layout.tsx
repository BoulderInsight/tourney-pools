import { Metadata } from "next";
import { getDb } from "@/lib/db";
import PoolShell from "./pool-shell";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const sql = getDb();

  const poolRows = await sql`
    SELECT p.pool_name, p.buy_in, p.tournament_id,
           (SELECT COUNT(*) FROM players WHERE pool_id = p.id) as player_count
    FROM pools p
    WHERE p.slug = ${params.slug}
  `;

  if (poolRows.length === 0) {
    return { title: "Pool Not Found | TourneyPools" };
  }

  const pool = poolRows[0];
  const playerCount = Number(pool.player_count);
  const totalPurse = playerCount * pool.buy_in;

  let tournamentName: string | null = null;
  if (pool.tournament_id) {
    const tournRows = await sql`SELECT name FROM tournaments WHERE id = ${pool.tournament_id}`;
    if (tournRows.length > 0) tournamentName = tournRows[0].name;
  }

  const titleParts = [pool.pool_name];
  if (tournamentName) titleParts.push(tournamentName);
  if (totalPurse > 0) titleParts.push(`$${totalPurse} Purse`);

  const title = titleParts.join(" | ");
  const description = `Join ${pool.pool_name}${tournamentName ? ` for the ${tournamentName}` : ""}. ${playerCount} player${playerCount !== 1 ? "s" : ""}, $${pool.buy_in} buy-in.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    // PWA install metadata. Lets the OS treat this pool as its own home
    // screen app: dynamic per-pool manifest provides icon + start_url, the
    // iOS-specific meta tags give Safari what it needs since iOS ignores
    // most of the manifest in favor of these.
    manifest: `/pool/${params.slug}/manifest.webmanifest`,
    appleWebApp: {
      capable: true,
      // iOS reads this for the saved icon label, NOT the page <title>. So
      // setting it to the bare pool name (without ' | TourneyPools') keeps
      // the home-screen label short and recognizable.
      title: pool.pool_name as string,
      statusBarStyle: "black-translucent",
    },
    icons: {
      // Re-declare the favicon explicitly: Next.js metadata merging replaces
      // the parent layout's `icons` object wholesale rather than merging
      // fields, so omitting `icon` here would strip the favicon from pool
      // pages.
      icon: "/favicon.png",
      apple: "/apple-touch-icon.png",
    },
  };
}

export default function PoolLayout({ children }: { children: React.ReactNode }) {
  return <PoolShell>{children}</PoolShell>;
}
