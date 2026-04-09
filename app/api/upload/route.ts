import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File;
  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Generate unique filename
  const ext = file.name.split(".").pop() || "png";
  const filename = `ad-${session.chairmanId}-${Date.now()}.${ext}`;

  // Write to /tmp on Vercel, public/ locally
  const isVercel = !!process.env.VERCEL;
  if (isVercel) {
    // On Vercel, we can't write to public/. Use a base64 data URL instead.
    const base64 = buffer.toString("base64");
    const mimeType = file.type || "image/png";
    const dataUrl = `data:${mimeType};base64,${base64}`;
    return NextResponse.json({ url: dataUrl });
  }

  // Local: write to public/uploads/
  const uploadDir = join(process.cwd(), "public", "uploads");
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }
  writeFileSync(join(uploadDir, filename), buffer);
  return NextResponse.json({ url: `/uploads/${filename}` });
}
