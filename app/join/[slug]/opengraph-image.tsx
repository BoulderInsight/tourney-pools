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
 * Slack sees the chairman's name front and center, so the unfurl answers the
 * "what is this?" question at a glance.
 *
 * Four big stacked lines on a photo-backgrounded card:
 *   {Chairman}
 *   has invited you
 *   to join a
 *   TourneyPool
 */
export default async function OGImage({ params }: { params: { slug: string } }) {
  const sql = getDb();
  const bgSrc = await getImageDataUri("OGImage.jpeg");

  const poolRows = await sql`
    SELECT c.name AS chairman_name
    FROM pools p
    JOIN chairmen c ON c.id = p.chairman_id
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

  const chairman = (poolRows[0].chairman_name as string) || "A friend";

  // Tuned for the 640px right column. Names up to ~12 characters fit on one
  // line at 80pt; longer names will wrap, which we accept.
  const NAME_SIZE = 80;
  const CONNECTOR_SIZE = 52;
  const BRAND_SIZE = 80;

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

        {/* Heavy gradient on the right so any background photo stays legible behind text */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "linear-gradient(to right, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 35%, rgba(0,0,0,0.78) 100%)",
          }}
        />

        {/* Right column, hard-capped width so even long names stay clear of
            the TOURNEYPOOLS logo on the background photo's left side. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-end",
            textAlign: "right",
            width: "640px",
            height: "100%",
            position: "absolute",
            top: 0,
            right: 60,
          }}
        >
          {/* Line 1: Chairman name */}
          <div
            style={{
              display: "flex",
              fontSize: NAME_SIZE,
              fontWeight: 800,
              color: "#d4a843",
              lineHeight: 1.0,
              letterSpacing: "-2px",
              textShadow: "0 4px 20px rgba(0,0,0,0.6)",
              justifyContent: "flex-end",
            }}
          >
            {chairman}
          </div>

          {/* Line 2 */}
          <div
            style={{
              display: "flex",
              fontSize: CONNECTOR_SIZE,
              fontWeight: 600,
              color: "white",
              lineHeight: 1.05,
              marginTop: 18,
              textShadow: "0 3px 16px rgba(0,0,0,0.65)",
              justifyContent: "flex-end",
            }}
          >
            has invited you
          </div>

          {/* Line 3 */}
          <div
            style={{
              display: "flex",
              fontSize: CONNECTOR_SIZE,
              fontWeight: 600,
              color: "white",
              lineHeight: 1.05,
              marginTop: 6,
              textShadow: "0 3px 16px rgba(0,0,0,0.65)",
              justifyContent: "flex-end",
            }}
          >
            to join a
          </div>

          {/* Line 4: brand */}
          <div
            style={{
              display: "flex",
              fontSize: BRAND_SIZE,
              fontWeight: 800,
              color: "#d4a843",
              lineHeight: 1.0,
              letterSpacing: "-1.5px",
              marginTop: 18,
              textShadow: "0 4px 20px rgba(0,0,0,0.6)",
              justifyContent: "flex-end",
            }}
          >
            TourneyPool
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
