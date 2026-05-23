import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import SelfServeForm from "./SelfServeForm";

export const dynamic = "force-dynamic";

interface Context {
  personName: string;
  commissionerName: string;
  poolName: string;
  tournamentName: string | null;
  submitted: boolean;
}

async function loadContext(token: string): Promise<Context | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT cr.submitted_at,
           pe.name AS person_name,
           p.pool_name,
           c.name AS commissioner_name,
           t.name AS tournament_name
    FROM collection_requests cr
    JOIN people pe ON pe.id = cr.person_id
    JOIN pools p ON p.id = cr.pool_id
    JOIN chairmen c ON c.id = p.chairman_id
    LEFT JOIN tournaments t ON t.id = p.tournament_id
    WHERE cr.token = ${token}
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    personName: r.person_name as string,
    commissionerName: r.commissioner_name as string,
    poolName: r.pool_name as string,
    tournamentName: (r.tournament_name as string | null) ?? null,
    submitted: r.submitted_at !== null,
  };
}

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const ctx = await loadContext(params.token);
  if (!ctx) return { title: "TourneyPools" };
  const title = `${ctx.commissionerName} needs your payment info | TourneyPools`;
  const description = `${ctx.poolName}${ctx.tournamentName ? ` for ${ctx.tournamentName}` : ""}`;
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function CollectPage({ params }: { params: { token: string } }) {
  const ctx = await loadContext(params.token);
  if (!ctx) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4 text-center bg-tp-bg">
        <img src="/logo.png" alt="TourneyPools" className="h-10 mb-4" />
        <h1 className="font-serif text-2xl font-bold text-tp-primary mb-2">Link not found</h1>
        <p className="text-sm text-gray-500 max-w-xs">
          This link is no longer valid. Ask the person who sent it for a fresh one.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-tp-bg px-4 pt-10 pb-12">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <img src="/logo.png" alt="TourneyPools" className="h-10 mx-auto mb-4" />
          <h1 className="font-serif text-2xl font-bold text-tp-primary leading-tight">
            Hi {ctx.personName}
          </h1>
          <p className="text-sm text-gray-600 mt-2">
            <strong>{ctx.commissionerName}</strong> is running the <strong>{ctx.poolName}</strong> pool
            {ctx.tournamentName ? <> for <strong>{ctx.tournamentName}</strong></> : null} and needs
            your payment info so winners can be paid easily.
          </p>
        </div>
        <SelfServeForm token={params.token} initiallySubmitted={ctx.submitted} />
        <p className="text-[11px] text-gray-400 text-center mt-4 leading-relaxed">
          Only {ctx.commissionerName} can see what you enter here. No accounts, no payments through TourneyPools.
        </p>
      </div>
    </main>
  );
}
