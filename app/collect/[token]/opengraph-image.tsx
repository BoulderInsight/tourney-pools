import { ImageResponse } from "next/og";
import { getDb } from "@/lib/db";
import { readFile } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";
export const alt = "Enter your payment info on TourneyPools";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function getImageDataUri(filename: string): Promise<string | null> {
  try {
    const filePath = join(process.cwd(), "public", filename);
    const buffer = await readFile(filePath);
    const ext = filename.endsWith(".png") ? "png" : "jpeg";
    return `data:image/${ext};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function OGImage({ params }: { params: { token: string } }) {
  const sql = getDb();
  // LEFT JOIN pools/chairmen/tournaments so a null pool_id (group-context links)
  // still resolves the commissioner via people.chairman_id.
  const rows = await sql`
    SELECT COALESCE(c_pool.name, c_person.name) AS commissioner_name,
           p.pool_name,
           t.name AS tournament_name
    FROM collection_requests cr
    JOIN people pe ON pe.id = cr.person_id
    JOIN chairmen c_person ON c_person.id = pe.chairman_id
    LEFT JOIN pools p ON p.id = cr.pool_id
    LEFT JOIN chairmen c_pool ON c_pool.id = p.chairman_id
    LEFT JOIN tournaments t ON t.id = p.tournament_id
    WHERE cr.token = ${params.token}
  `;

  const logoSrc = await getImageDataUri("logo.png");

  if (rows.length === 0) {
    return new ImageResponse(
      (
        <div style={{ display: "flex", width: "100%", height: "100%", background: "#f7f5f2", alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 700, color: "#1a365d", fontFamily: "serif" }}>
            TourneyPools
          </div>
        </div>
      ),
      { ...size }
    );
  }

  const r = rows[0];
  const commissionerName = r.commissioner_name as string;
  const poolName = (r.pool_name as string | null) ?? null;
  const tournamentName = (r.tournament_name as string | null) ?? null;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          background: "#f7f5f2",
          padding: "72px 86px",
          boxSizing: "border-box",
        }}
      >
        {/* Logo */}
        {logoSrc ? (
          <img src={logoSrc} alt="" style={{ height: 78, width: "auto" }} />
        ) : (
          <div style={{ display: "flex", fontSize: 36, fontWeight: 700, color: "#1a365d", fontFamily: "serif" }}>
            TourneyPools
          </div>
        )}

        {/* Headline + meta */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 96,
              fontWeight: 800,
              color: "#1a365d",
              lineHeight: 1.0,
              fontFamily: "serif",
              maxWidth: "100%",
            }}
          >
            Enter Payment Info
          </div>
          <div style={{ display: "flex", width: 96, height: 6, background: "#d4a843", marginTop: 28, marginBottom: 22 }} />
          <div style={{ display: "flex", fontSize: 32, color: "#5a5a5a" }}>for {commissionerName}</div>
          {poolName && (
            <div style={{ display: "flex", fontSize: 32, color: "#5a5a5a", marginTop: 4 }}>{poolName}</div>
          )}
          {tournamentName && (
            <div style={{ display: "flex", fontSize: 32, color: "#5a5a5a", marginTop: 4 }}>{tournamentName}</div>
          )}
        </div>

        {/* Domain */}
        <div style={{ display: "flex", fontSize: 22, color: "#a8a8a8", letterSpacing: "0.06em" }}>
          tourneypools.com
        </div>
      </div>
    ),
    { ...size }
  );
}
