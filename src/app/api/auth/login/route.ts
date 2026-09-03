import { NextRequest, NextResponse } from "next/server";
import {
  createPkce,
  createRandomValue,
  getAuthorizeUrl,
  safeReturnPath,
} from "@/lib/auth/cognito";
import {
  applyOauthCookies,
  clearAuthCookies,
  verifyAccessCookie,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const nextPath = safeReturnPath(request.nextUrl.searchParams.get("next"));
  const verified = await verifyAccessCookie();

  if (verified.status === "ok") {
    return NextResponse.redirect(new URL(nextPath, request.url));
  }

  if (verified.status === "forbidden") {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  const { challenge, verifier } = createPkce();
  const state = createRandomValue();
  const nonce = createRandomValue();
  const response = NextResponse.redirect(getAuthorizeUrl({ challenge, nonce, state }));

  clearAuthCookies(response.cookies);
  applyOauthCookies(response.cookies, {
    nextPath,
    nonce,
    state,
    verifier,
  });

  return response;
}
