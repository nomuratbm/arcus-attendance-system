import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { getCognitoConfig } from "@/lib/auth/config";

export type CognitoTokenSet = {
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
};

type TokenEndpointResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
  id_token?: string;
  refresh_token?: string;
};

export function createRandomValue(): string {
  return randomBytes(32).toString("base64url");
}

export function createPkce(): { challenge: string; verifier: string } {
  const verifier = createRandomValue();
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { challenge, verifier };
}

export function getAuthorizeUrl(input: {
  challenge: string;
  nonce: string;
  state: string;
}): string {
  const config = getCognitoConfig();
  const url = new URL(`https://${config.domain}/oauth2/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", "openid email");
  url.searchParams.set("code_challenge", input.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", input.state);
  url.searchParams.set("nonce", input.nonce);
  return url.toString();
}

export function getLogoutUrl(): string {
  const config = getCognitoConfig();
  const url = new URL(`https://${config.domain}/logout`);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("logout_uri", config.logoutUri);
  return url.toString();
}

export function safeReturnPath(value: string | null | undefined): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return "/scanner";
  }

  if (value === "/scanner" || value.startsWith("/scanner/")) {
    return value;
  }

  if (value === "/addevent" || value.startsWith("/addevent/")) {
    return value;
  }

  return "/scanner";
}

export async function exchangeAuthorizationCode(
  code: string,
  verifier: string,
): Promise<CognitoTokenSet> {
  return requestTokens({
    code,
    code_verifier: verifier,
    grant_type: "authorization_code",
    redirect_uri: getCognitoConfig().redirectUri,
  });
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<CognitoTokenSet> {
  const tokens = await requestTokens({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  return {
    accessToken: tokens.accessToken,
    idToken: tokens.idToken,
    refreshToken: tokens.refreshToken ?? refreshToken,
  };
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const config = getCognitoConfig();
  const response = await fetch(`https://${config.domain}/oauth2/revoke`, {
    body: new URLSearchParams({ token: refreshToken }),
    headers: tokenRequestHeaders(config.clientId, config.clientSecret),
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Cognito revoke failed with status ${response.status}`);
  }
}

async function requestTokens(
  body: Record<string, string>,
): Promise<CognitoTokenSet> {
  const config = getCognitoConfig();
  const response = await fetch(`https://${config.domain}/oauth2/token`, {
    body: new URLSearchParams(body),
    headers: tokenRequestHeaders(config.clientId, config.clientSecret),
    method: "POST",
  });

  const payload = (await response.json()) as TokenEndpointResponse;

  if (!response.ok || !payload.access_token) {
    const detail = payload.error_description || payload.error || response.status;
    throw new Error(`Cognito token request failed: ${detail}`);
  }

  return {
    accessToken: payload.access_token,
    idToken: payload.id_token,
    refreshToken: payload.refresh_token,
  };
}

function tokenRequestHeaders(
  clientId: string,
  clientSecret: string,
): HeadersInit {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  return {
    Authorization: `Basic ${basic}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
}
