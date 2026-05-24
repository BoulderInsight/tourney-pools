import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Per-pool Web App Manifest. Served at
 * /pool/{slug}/manifest.webmanifest so each pool gets its own name + start_url
 * even though the icons and theme are shared site-wide.
 *
 * When the chairman (or any visitor) installs this pool to their home screen,
 * the OS reads:
 *   name / short_name -> label shown under the icon
 *   icons             -> the visual mark itself (TourneyPools logo on white)
 *   start_url         -> the URL that opens when the icon is tapped
 *   display: standalone -> opens chrome-less, like a native app
 *
 * iOS Safari ignores the manifest's name and uses the page's
 * `apple-mobile-web-app-title` meta tag instead, so we also set that in the
 * pool page layout. iOS reads the manifest icons too but prefers
 * apple-touch-icon when present; we provide both.
 */
export async function GET(
  _req: Request,
  { params }: { params: { slug: string } },
) {
  const sql = getDb();
  const rows = await sql`SELECT pool_name FROM pools WHERE slug = ${params.slug}`;
  const poolName = (rows[0]?.pool_name as string | undefined) ?? "TourneyPools";

  // Keep both name fields the pool name so the icon's label exactly matches
  // what the chairman called the pool. If the OS needs to truncate, it'll
  // use short_name first.
  const manifest = {
    name: poolName,
    short_name: poolName,
    description: `${poolName} on TourneyPools`,
    start_url: `/pool/${params.slug}`,
    scope: `/pool/${params.slug}`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f5f2",
    theme_color: "#1a365d",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // Maskable icon has extra padding so the safe area survives Android's
      // adaptive icon mask (circle / squircle / rounded square).
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      // Light cache; the only field that changes per pool is the name, so an
      // hour is plenty even if the chairman renames the pool.
      "Cache-Control": "public, max-age=3600",
    },
  });
}
