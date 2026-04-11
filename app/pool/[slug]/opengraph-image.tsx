import { ImageResponse } from "next/og";
import { getDb } from "@/lib/db";

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

  if (poolRows.length === 0) {
    return new ImageResponse(
      (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: "100%", height: "100%", background: "#1a365d",
          color: "white", fontSize: 48, fontWeight: 700,
          fontFamily: "Georgia, serif",
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
  let courseName: string | null = null;
  let dateRange: string | null = null;

  if (pool.tournament_id) {
    const tournRows = await sql`
      SELECT name, course_name, location, start_date, end_date
      FROM tournaments WHERE id = ${pool.tournament_id}
    `;
    if (tournRows.length > 0) {
      const t = tournRows[0];
      tournamentName = t.name;
      courseName = [t.course_name, t.location].filter(Boolean).join(" · ");
      dateRange = formatDateRange(t.start_date, t.end_date);
    }
  }

  // Status line
  let statusText = "";
  if (!pool.setup_complete) {
    statusText = "Setting up";
  } else if (!pool.draft_complete) {
    statusText = "Draft in progress";
  } else {
    statusText = "Live";
  }

  const statusLine = `${playerCount} player${playerCount !== 1 ? "s" : ""} · $${pool.buy_in} buy-in · ${statusText}`;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#1a365d",
          padding: "48px 56px",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle radial glow */}
        <div
          style={{
            position: "absolute",
            top: "-200px",
            right: "-200px",
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(212,168,67,0.12) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Top bar: TourneyPools text logo */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "white", fontFamily: "Georgia, serif", letterSpacing: "-0.5px" }}>
            TourneyPools
          </div>
        </div>

        {/* Center content */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", marginTop: "-16px" }}>
          {/* Pool name */}
          <div
            style={{
              fontSize: 64,
              fontWeight: 800,
              color: "white",
              lineHeight: 1.1,
              letterSpacing: "-1px",
              maxWidth: "900px",
            }}
          >
            {pool.pool_name}
          </div>

          {/* Tournament info */}
          {tournamentName && (
            <div style={{ display: "flex", flexDirection: "column", marginTop: "20px", gap: "4px" }}>
              <div style={{ fontSize: 28, fontWeight: 600, color: "#d4a843" }}>
                {tournamentName}
              </div>
              {(courseName || dateRange) && (
                <div style={{ fontSize: 20, color: "rgba(255,255,255,0.5)", display: "flex", gap: "12px" }}>
                  {courseName && <span>{courseName}</span>}
                  {courseName && dateRange && <span style={{ color: "rgba(255,255,255,0.25)" }}>·</span>}
                  {dateRange && <span>{dateRange}</span>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* Status pill */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "rgba(255,255,255,0.1)",
                borderRadius: "999px",
                padding: "10px 20px",
                fontSize: 18,
                color: "rgba(255,255,255,0.7)",
                fontWeight: 500,
              }}
            >
              {statusText === "Live" && (
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#4ade80", display: "flex" }} />
              )}
              {statusLine}
            </div>
          </div>

          {/* Chairman */}
          {pool.chairman_name && (
            <div style={{ fontSize: 16, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>
              Chairman: {pool.chairman_name}
            </div>
          )}
        </div>

        {/* Gold accent line at bottom */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "linear-gradient(90deg, transparent, #d4a843, transparent)",
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
