import { ImageResponse } from "next/og";
import { getDb } from "@/lib/db";
import { readFile } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";
export const alt = "Pool invitation on TourneyPools";
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

/**
 * Dynamic share card for /join/[slug]. Whoever pastes the link into iMessage or
 * Slack sees the chairman's name and the pool/tournament they're inviting to,
 * which is the friendly "what is this?" answer the unfurl needs to provide.
 *
 * Same photo-backgrounded design language as the collect link's OG, with a dark
 * right-side gradient under right-aligned text.
 */
export default async function OGImage({ params }: { params: { slug: string } }) {
  const sql = getDb();
  const bgSrc = await getImageDataUri("OGImage.jpeg");

  const poolRows = await sql`
    SELECT p.pool_name, c.name AS chairman_name, t.name AS tournament_name
    FROM pools p
    JOIN chairmen c ON c.id = p.chairman_id
    LEFT JOIN tournaments t ON t.id = p.tournament_id
    WHERE p.slug = ${params.slug}
  `;

  // Fallback: same generic TourneyPools card the other OG routes use.
  if (poolRows.length === 0) {
    return new ImageResponse(
      (
        <div style={{ display: "flex", width: "100%", height: "100%", background: "#1a365d", alignItems: "center", justifyContent: "center", position: "relative" }}>
          {bgSrc && <img src={bgSrc} alt="" style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover" }} />}
          <div style={{ display: "flex", fontSize: 72, fontWeight: 800, color: "white", textShadow: "0 4px 24px rgba(0,0,0,0.6)" }}>
            TourneyPools
          </div>
        </div>
      ),
      { ...size },
    );
  }

  const pool = poolRows[0];
  const chairman = (pool.chairman_name as string) || "A friend";
  const poolName = (pool.pool_name as string) || "Golf Pool";
  const tournamentName = pool.tournament_name as string | null;

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", position: "relative" }}>
        {bgSrc && (
          <img
            src={bgSrc}
            alt=""
            style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}

        {/* Heavy gradient on the right where text lives so any background photo stays legible */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "linear-gradient(to right, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 35%, rgba(0,0,0,0.78) 100%)",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-end",
            textAlign: "right",
            width: "100%",
            height: "100%",
            padding: "60px 72px",
            position: "relative",
          }}
        >
          {/* Kicker */}
          <div
            style={{
              display: "flex",
              fontSize: 28,
              fontWeight: 600,
              color: "#d4a843",
              letterSpacing: "4px",
              textTransform: "uppercase",
              marginBottom: 14,
              textShadow: "0 2px 12px rgba(0,0,0,0.6)",
            }}
          >
            You&apos;re invited
          </div>

          {/* Headline: chairman name */}
          <div
            style={{
              display: "flex",
              fontSize: 72,
              fontWeight: 800,
              color: "white",
              lineHeight: 1.0,
              letterSpacing: "-1.5px",
              textShadow: "0 4px 20px rgba(0,0,0,0.5)",
              maxWidth: "950px",
              textAlign: "right",
              justifyContent: "flex-end",
            }}
          >
            {chairman}
          </div>

          {/* Sub */}
          <div
            style={{
              display: "flex",
              fontSize: 40,
              fontWeight: 500,
              color: "white",
              marginTop: 12,
              opacity: 0.92,
              textShadow: "0 3px 16px rgba(0,0,0,0.6)",
              maxWidth: "950px",
              textAlign: "right",
              justifyContent: "flex-end",
            }}
          >
            is inviting you to{tournamentName ? ` a ${tournamentName} pool` : " a golf pool"}
          </div>

          {/* Pool name */}
          <div
            style={{
              display: "flex",
              fontSize: 34,
              fontWeight: 700,
              color: "#d4a843",
              marginTop: 18,
              textShadow: "0 2px 12px rgba(0,0,0,0.6)",
            }}
          >
            {poolName}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
