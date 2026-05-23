import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";
export const alt = "Drop your Venmo, for when, not if. (TourneyPools)";
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
 * Branded share card for the tokenized self-serve collect link. Matches the photo-
 * backgrounded look of the pool OG image, with a witty pitch instead of pool stats:
 * "Drop your Venmo, / for when, not if."
 *
 * Doesn't need to read the token: the image is the same for every collect link, which
 * also avoids leaking who the link is for in a publicly cached preview thumbnail.
 */
export default async function OGImage() {
  const bgSrc = await getImageDataUri("OGImage.jpeg");

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

        {/* Dark gradient overlay: heavier on the right where text goes */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "linear-gradient(to right, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 35%, rgba(0,0,0,0.78) 100%)",
          }}
        />

        {/* Text content: right-aligned, matching the pool OG rhythm */}
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
          {/* Headline: white serif */}
          <div
            style={{
              display: "flex",
              fontSize: 92,
              fontWeight: 800,
              color: "white",
              lineHeight: 1.0,
              letterSpacing: "-2px",
              textShadow: "0 4px 20px rgba(0,0,0,0.5)",
              maxWidth: "850px",
              textAlign: "right",
              justifyContent: "flex-end",
            }}
          >
            Drop your Venmo,
          </div>

          {/* Punchline: gold */}
          <div
            style={{
              display: "flex",
              fontSize: 60,
              fontWeight: 700,
              color: "#d4a843",
              marginTop: "18px",
              textShadow: "0 3px 16px rgba(0,0,0,0.6)",
            }}
          >
            for when, not if.
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
