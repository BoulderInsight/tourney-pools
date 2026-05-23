import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import SelfServeForm from "./SelfServeForm";

export const dynamic = "force-dynamic";

interface Context {
  personName: string;
  commissionerName: string;
  /** Null when the link was minted from the Groups view (no pool context). */
  poolName: string | null;
  tournamentName: string | null;
  submitted: boolean;
}

async function loadContext(token: string): Promise<Context | null> {
  const sql = getDb();
  // LEFT JOIN pools/chairmen/tournaments so a null pool_id still resolves the person
  // and the commissioner (via people.chairman_id).
  const rows = await sql`
    SELECT cr.submitted_at,
           pe.name AS person_name,
           p.pool_name,
           COALESCE(c_pool.name, c_person.name) AS commissioner_name,
           t.name AS tournament_name
    FROM collection_requests cr
    JOIN people pe ON pe.id = cr.person_id
    JOIN chairmen c_person ON c_person.id = pe.chairman_id
    LEFT JOIN pools p ON p.id = cr.pool_id
    LEFT JOIN chairmen c_pool ON c_pool.id = p.chairman_id
    LEFT JOIN tournaments t ON t.id = p.tournament_id
    WHERE cr.token = ${token}
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    personName: r.person_name as string,
    commissionerName: r.commissioner_name as string,
    poolName: (r.pool_name as string | null) ?? null,
    tournamentName: (r.tournament_name as string | null) ?? null,
    submitted: r.submitted_at !== null,
  };
}

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const ctx = await loadContext(params.token);
  if (!ctx) return { title: "TourneyPools" };
  const title = `Enter payment info for ${ctx.commissionerName} | TourneyPools`;
  const descriptionParts: string[] = [];
  if (ctx.poolName) descriptionParts.push(ctx.poolName);
  if (ctx.tournamentName) descriptionParts.push(`for ${ctx.tournamentName}`);
  const description = descriptionParts.length > 0 ? descriptionParts.join(" ") : "Add your payment info so the winners can be paid.";
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
            {ctx.poolName ? (
              <>
                <strong>{ctx.commissionerName}</strong> is running the <strong>{ctx.poolName}</strong> pool
                {ctx.tournamentName ? <> for <strong>{ctx.tournamentName}</strong></> : null} and needs
                your payment info so winners can be paid easily.
              </>
            ) : (
              <>
                <strong>{ctx.commissionerName}</strong> needs your payment info so winners can be paid
                easily in future pools.
              </>
            )}
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
