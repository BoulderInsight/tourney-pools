import { ImageResponse } from "next/og";
import { getDb } from "@/lib/db";
import { readFile } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";
export const alt = "Pool leaderboard on TourneyPools";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function formatDateRange(startDate: string | null, endDate: string | null): string {
  if (!startDate) return "";
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" };
  const startStr = start.toLocaleDateString("en-US", opts);
  if (!end) return startStr;
  const startMonth = start.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const endMonth = end.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const endDay = end.toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" });
  if (startMonth === endMonth) {
    const startDay = start.toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" });
    return `${startMonth} ${startDay}–${endDay}`;
  }
  const endStr = end.toLocaleDateString("en-US", opts);
  return `${startStr} – ${endStr}`;
}

async function getLogoDataUri(): Promise<string | null> {
  try {
    const logoPath = join(process.cwd(), "public", "logo.png");
    const buffer = await readFile(logoPath);
    return `data:image/png;base64,${buffer.toString("base64")}`;
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

  const logoSrc = await getLogoDataUri();

  if (poolRows.length === 0) {
    return new ImageResponse(
      (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: "100%", height: "100%", background: "#1a365d",
          color: "white", fontSize: 72, fontWeight: 700,
        }}>
          TourneyPools
        </div>
      ),
      { ...size }
    );
  }

  const pool = poolRows[0];
  const playerCount = Number(pool.player_count);

  let tournamentName: string | null = null;
  let courseAndLocation: string | null = null;
  let dateRange: string | null = null;

  if (pool.tournament_id) {
    const tournRows = await sql`
      SELECT name, course_name, location, start_date, end_date
      FROM tournaments WHERE id = ${pool.tournament_id}
    `;
    if (tournRows.length > 0) {
      const t = tournRows[0];
      tournamentName = t.name;
      courseAndLocation = [t.course_name, t.location].filter(Boolean).join(" · ");
      dateRange = formatDateRange(t.start_date, t.end_date);
    }
  }

  let statusText = "";
  if (!pool.setup_complete) {
    statusText = "Setting up";
  } else if (!pool.draft_complete) {
    statusText = "Draft in progress";
  } else {
    statusText = "Live";
  }

  const infoParts = [
    `${playerCount} player${playerCount !== 1 ? "s" : ""}`,
    `$${pool.buy_in} buy-in`,
    statusText,
  ];

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#1a365d",
          padding: "60px 72px",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex" }}>
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt="" height={64} />
          ) : (
            <div style={{ display: "flex", fontSize: 36, fontWeight: 700, color: "white" }}>
              TourneyPools
            </div>
          )}
        </div>

        {/* Pool name — big and bold */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 800, color: "white", lineHeight: 1.05, letterSpacing: "-2px" }}>
            {pool.pool_name}
          </div>

          {tournamentName && (
            <div style={{ display: "flex", flexDirection: "column", marginTop: "24px" }}>
              <div style={{ display: "flex", fontSize: 36, fontWeight: 600, color: "#d4a843" }}>
                {tournamentName}
              </div>
              {(courseAndLocation || dateRange) && (
                <div style={{ display: "flex", fontSize: 26, color: "rgba(255,255,255,0.5)", marginTop: "8px" }}>
                  {[courseAndLocation, dateRange].filter(Boolean).join(" · ")}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              background: "rgba(255,255,255,0.12)",
              borderRadius: "999px",
              padding: "14px 28px",
              fontSize: 24,
              color: "rgba(255,255,255,0.8)",
              fontWeight: 600,
            }}
          >
            {statusText === "Live" && (
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#4ade80", display: "flex" }} />
            )}
            <span>{infoParts.join("  ·  ")}</span>
          </div>

          {pool.chairman_name && (
            <div style={{ display: "flex", fontSize: 22, color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>
              Chairman: {pool.chairman_name}
            </div>
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}
