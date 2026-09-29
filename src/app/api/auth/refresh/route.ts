import { NextRequest, NextResponse } from "next/server";
import {
  refreshAccessToken,
  safeReturnPath,
  sessionReturnPath,
} from "@/lib/auth/cognito";
import {
  applyIdRefreshAttempt,
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

    if (verified.status !== "ok") {
      throw new Error(`Refreshed access token was ${verified.status}`);
    }

    const destination = sessionReturnPath(nextPath, verified.user);
    const response = NextResponse.redirect(new URL(destination, request.url));
    applyTokenCookies(response.cookies, tokens);
    applyIdRefreshAttempt(response.cookies, Boolean(tokens.idToken));
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
