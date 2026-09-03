import { NextRequest, NextResponse } from "next/server";
import { getLogoutUrl, revokeRefreshToken } from "@/lib/auth/cognito";
import { clearAuthCookies, REFRESH_COOKIE } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

async function signOut(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (refreshToken) {
    try {
      await revokeRefreshToken(refreshToken);
    } catch (error) {
      console.error("Cognito token revocation failed:", error);
    }
  }

  // 303 converts the Sign out POST into a GET against Cognito /logout,
  // which then redirects to the registered sign-out URL (APP_BASE_URL/).
  const response = NextResponse.redirect(getLogoutUrl(), 303);
  clearAuthCookies(response.cookies);
  return response;
}

export async function GET(request: NextRequest) {
  return signOut(request);
}

export async function POST(request: NextRequest) {
  return signOut(request);
}
