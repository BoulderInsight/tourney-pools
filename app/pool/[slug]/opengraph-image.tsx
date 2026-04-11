import { ImageResponse } from "next/og";
import { getDb } from "@/lib/db";
import { readFile } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";
export const alt = "Pool leaderboard on TourneyPools";
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

export default async function OGImage({ params }: { params: { slug: string } }) {
  const sql = getDb();

  const poolRows = await sql`
    SELECT p.pool_name, p.setup_complete, p.draft_complete, p.tournament_id, p.buy_in,
           c.name as chairman_name,
           (SELECT COUNT(*) FROM players WHERE pool_id = p.id) as player_count
    FROM pools p
    JOIN chairmen c ON c.id = p.chairman_id
    WHERE p.slug = ${params.slug}
  `;

  const bgSrc = await getImageDataUri("OGImage.jpeg");

  if (poolRows.length === 0) {
    return new ImageResponse(
      (
        <div style={{ display: "flex", width: "100%", height: "100%", background: "#1a365d", alignItems: "center", justifyContent: "center" }}>
          {bgSrc && <img src={bgSrc} alt="" style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover" }} />}
          <div style={{ display: "flex", fontSize: 72, fontWeight: 800, color: "white", textShadow: "0 4px 24px rgba(0,0,0,0.6)" }}>
            TourneyPools
          </div>
        </div>
      ),
      { ...size }
    );
  }

  const pool = poolRows[0];
  const playerCount = Number(pool.player_count);
  const totalPurse = playerCount * pool.buy_in;

  let tournamentName: string | null = null;

  if (pool.tournament_id) {
    const tournRows = await sql`
      SELECT name FROM tournaments WHERE id = ${pool.tournament_id}
    `;
    if (tournRows.length > 0) {
      tournamentName = tournRows[0].name;
    }
  }

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", position: "relative" }}>
        {/* Background image */}
        {bgSrc && (
          <img
            src={bgSrc}
            alt=""
            style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}

        {/* Dark gradient overlay — heavier on the right where text goes */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "linear-gradient(to right, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 35%, rgba(0,0,0,0.75) 100%)",
          }}
        />

        {/* Text content — right-aligned */}
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
          {/* Pool name */}
          <div
            style={{
              display: "flex",
              fontSize: 80,
              fontWeight: 800,
              color: "white",
              lineHeight: 1.05,
              letterSpacing: "-2px",
              textShadow: "0 4px 20px rgba(0,0,0,0.5)",
              maxWidth: "700px",
              textAlign: "right",
              justifyContent: "flex-end",
            }}
          >
            {pool.pool_name}
          </div>

          {/* Tournament name */}
          {tournamentName && (
            <div
              style={{
                display: "flex",
                fontSize: 48,
                fontWeight: 700,
                color: "#d4a843",
                marginTop: "16px",
                textShadow: "0 3px 16px rgba(0,0,0,0.6)",
              }}
            >
              {tournamentName}
            </div>
          )}

          {/* Total purse */}
          {totalPurse > 0 && (
            <div
              style={{
                display: "flex",
                fontSize: 44,
                fontWeight: 700,
                color: "white",
                marginTop: "12px",
                textShadow: "0 3px 16px rgba(0,0,0,0.6)",
              }}
            >
              ${totalPurse} Purse
            </div>
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}
