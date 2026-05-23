import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-me");
const COOKIE_NAME = "tp_session";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-chairman-id", payload.chairmanId as string);
    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/account/:path*",
    "/admin/:path*",
    "/pool/:slug/setup/:path*",
    "/pool/:slug/scores/:path*",
    "/pool/:slug/players/:path*",
    "/api/pools/:path*",
    "/api/admin/:path*",
    "/api/pool/:slug/setup/:path*",
    "/api/pool/:slug/scores/:path*",
    "/api/pool/:slug/sync/:path*",
    "/api/pool/:slug/people/:path*",
    "/api/pool/:slug/collection-requests/:path*",
    "/api/people/:path*",
  ],
};
