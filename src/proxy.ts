import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/cookie-names";

export function proxy(request: NextRequest) {
  const hasSession =
    request.cookies.has(ACCESS_COOKIE) || request.cookies.has(REFRESH_COOKIE);

  if (hasSession) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const login = new URL("/api/auth/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/scanner",
    "/scanner/:path*",
    "/addevent",
    "/addevent/:path*",
    "/api/member",
    "/api/member/:path*",
    "/api/checkin",
    "/api/checkin/:path*",
    "/api/events",
    "/api/events/:path*",
  ],
};
