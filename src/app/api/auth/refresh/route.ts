import { NextRequest, NextResponse } from "next/server";
import { refreshAccessToken, safeReturnPath } from "@/lib/auth/cognito";
import {
  applyTokenCookies,
  clearAuthCookies,
  REFRESH_COOKIE,
  verifyAccessToken,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const nextPath = safeReturnPath(request.nextUrl.searchParams.get("next"));
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (!refreshToken) {
    const login = new URL("/api/auth/login", request.url);
    login.searchParams.set("next", nextPath);
    return NextResponse.redirect(login);
  }

  try {
    const tokens = await refreshAccessToken(refreshToken);
    const verified = await verifyAccessToken(tokens.accessToken);

    if (verified.status === "forbidden") {
      const forbidden = NextResponse.redirect(new URL("/forbidden", request.url));
      clearAuthCookies(forbidden.cookies);
      return forbidden;
    }

    if (verified.status !== "ok") {
      throw new Error(`Refreshed access token was ${verified.status}`);
    }

    const response = NextResponse.redirect(new URL(nextPath, request.url));
    applyTokenCookies(response.cookies, tokens);
    return response;
  } catch (error) {
    console.error("Cognito refresh failed:", error);
    const login = new URL("/api/auth/login", request.url);
    login.searchParams.set("next", nextPath);
    const response = NextResponse.redirect(login);
    clearAuthCookies(response.cookies);
    return response;
  }
}
