import { NextRequest, NextResponse } from "next/server";
import {
  exchangeAuthorizationCode,
  safeReturnPath,
} from "@/lib/auth/cognito";
import {
  applyTokenCookies,
  clearOauthCookies,
  OAUTH_NEXT_COOKIE,
  OAUTH_NONCE_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  verifyAccessToken,
  verifyIdToken,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get("error");
  if (error) {
    console.error(
      "Cognito authorize error:",
      error,
      request.nextUrl.searchParams.get("error_description"),
    );
    return NextResponse.redirect(new URL("/", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  const returnedState = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  const verifier = request.cookies.get(OAUTH_VERIFIER_COOKIE)?.value;
  const nonce = request.cookies.get(OAUTH_NONCE_COOKIE)?.value;
  const nextPath = safeReturnPath(request.cookies.get(OAUTH_NEXT_COOKIE)?.value);

  if (!code || !returnedState || !expectedState || returnedState !== expectedState) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!verifier || !nonce) {
    return NextResponse.redirect(new URL("/api/auth/login", request.url));
  }

  try {
    const tokens = await exchangeAuthorizationCode(code, verifier);

    if (!tokens.idToken) {
      throw new Error("Cognito token response did not include an ID token");
    }

    await verifyIdToken(tokens.idToken, nonce);
    const access = await verifyAccessToken(tokens.accessToken);

    if (access.status === "forbidden") {
      const forbidden = NextResponse.redirect(new URL("/forbidden", request.url));
      clearOauthCookies(forbidden.cookies);
      return forbidden;
    }

    if (access.status !== "ok") {
      throw new Error(`Access token verification failed: ${access.status}`);
    }

    const response = NextResponse.redirect(new URL(nextPath, request.url));
    clearOauthCookies(response.cookies);
    applyTokenCookies(response.cookies, tokens);
    return response;
  } catch (authError) {
    console.error("Cognito callback failed:", authError);
    return NextResponse.redirect(new URL("/", request.url));
  }
}
