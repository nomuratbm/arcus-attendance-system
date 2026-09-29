import "server-only";

import { CognitoJwtVerifier } from "aws-jwt-verify";
import { JwtExpiredError } from "aws-jwt-verify/error";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { refreshAccessToken, type CognitoTokenSet } from "@/lib/auth/cognito";
import { getCognitoConfig } from "@/lib/auth/config";
import {
  ACCESS_COOKIE,
  ID_COOKIE,
  ID_REFRESH_ATTEMPTED_COOKIE,
  OAUTH_NEXT_COOKIE,
  OAUTH_NONCE_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  REFRESH_COOKIE,
} from "@/lib/auth/cookie-names";

export {
  ACCESS_COOKIE,
  ID_COOKIE,
  ID_REFRESH_ATTEMPTED_COOKIE,
  OAUTH_NEXT_COOKIE,
  OAUTH_NONCE_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  REFRESH_COOKIE,
} from "@/lib/auth/cookie-names";

const OAUTH_COOKIE_MAX_AGE = 60 * 10;
const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const ORGANIZATION_ATTRIBUTE = "custom:reporganization-uuid";

type CookieWriter = {
  delete: (name: string) => void;
  set: (
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      maxAge: number;
      path: string;
      sameSite: "lax";
      secure: boolean;
    },
  ) => void;
};

export type SessionUser = {
  groups: string[];
  isAdmin: boolean;
  isSuperAdmin: boolean;
  organizationId: string | null;
  sub: string;
};

export type AccessVerification =
  | { status: "expired" }
  | { status: "invalid" }
  | { status: "missing" }
  | { needsIdToken: boolean; status: "ok"; user: SessionUser };

type AccessVerifier = ReturnType<
  typeof CognitoJwtVerifier.create<{
    clientId: string;
    tokenUse: "access";
    userPoolId: string;
  }>
>;

type IdVerifier = ReturnType<
  typeof CognitoJwtVerifier.create<{
    clientId: string;
    tokenUse: "id";
    userPoolId: string;
  }>
>;

let accessVerifier: AccessVerifier | undefined;
let idVerifier: IdVerifier | undefined;

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

function getAccessVerifier(): AccessVerifier {
  if (!accessVerifier) {
    const config = getCognitoConfig();
    accessVerifier = CognitoJwtVerifier.create({
      clientId: config.clientId,
      tokenUse: "access",
      userPoolId: config.userPoolId,
    });
  }

  return accessVerifier;
}

function getIdVerifier(): IdVerifier {
  if (!idVerifier) {
    const config = getCognitoConfig();
    idVerifier = CognitoJwtVerifier.create({
      clientId: config.clientId,
      tokenUse: "id",
      userPoolId: config.userPoolId,
    });
  }

  return idVerifier;
}

export function applyTokenCookies(
  store: CookieWriter,
  tokens: CognitoTokenSet,
): void {
  store.set(ACCESS_COOKIE, tokens.accessToken, cookieOptions(REFRESH_COOKIE_MAX_AGE));

  if (tokens.idToken) {
    store.set(ID_COOKIE, tokens.idToken, cookieOptions(REFRESH_COOKIE_MAX_AGE));
  }

  if (tokens.refreshToken) {
    store.set(
      REFRESH_COOKIE,
      tokens.refreshToken,
      cookieOptions(REFRESH_COOKIE_MAX_AGE),
    );
  }
}

export function clearAuthCookies(store: CookieWriter): void {
  store.delete(ACCESS_COOKIE);
  store.delete(ID_COOKIE);
  store.delete(ID_REFRESH_ATTEMPTED_COOKIE);
  store.delete(REFRESH_COOKIE);
  store.delete(OAUTH_STATE_COOKIE);
  store.delete(OAUTH_VERIFIER_COOKIE);
  store.delete(OAUTH_NONCE_COOKIE);
  store.delete(OAUTH_NEXT_COOKIE);
}

export function applyOauthCookies(
  store: CookieWriter,
  values: {
    nextPath: string;
    nonce: string;
    state: string;
    verifier: string;
  },
): void {
  const options = cookieOptions(OAUTH_COOKIE_MAX_AGE);
  store.set(OAUTH_STATE_COOKIE, values.state, options);
  store.set(OAUTH_VERIFIER_COOKIE, values.verifier, options);
  store.set(OAUTH_NONCE_COOKIE, values.nonce, options);
  store.set(OAUTH_NEXT_COOKIE, values.nextPath, options);
}

export function clearOauthCookies(store: CookieWriter): void {
  store.delete(OAUTH_STATE_COOKIE);
  store.delete(OAUTH_VERIFIER_COOKIE);
  store.delete(OAUTH_NONCE_COOKIE);
  store.delete(OAUTH_NEXT_COOKIE);
}

function sessionUserFromPayload(payload: {
  "cognito:groups"?: string[];
  sub?: string;
}): SessionUser | null {
  if (!payload.sub) {
    return null;
  }

  const groups = Array.isArray(payload["cognito:groups"])
    ? payload["cognito:groups"].filter((group) => typeof group === "string")
    : [];
  const { adminGroup, superAdminGroup } = getCognitoConfig();
  const isSuperAdmin = groups.includes(superAdminGroup);

  return {
    groups,
    isAdmin: isSuperAdmin || groups.includes(adminGroup),
    isSuperAdmin,
    organizationId: null,
    sub: payload.sub,
  };
}

function organizationIdFromIdPayload(payload: object): string | null {
  const value = (payload as Record<string, unknown>)[ORGANIZATION_ATTRIBUTE];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

type IdTokenSession =
  | { organizationId: string | null; status: "ok"; sub: string }
  | { status: "expired" }
  | { status: "invalid" }
  | { status: "missing" };

async function verifyIdTokenSession(
  token: string | undefined,
): Promise<IdTokenSession> {
  if (!token) {
    return { status: "missing" };
  }

  try {
    const payload = await getIdVerifier().verify(token);
    if (!payload.sub) {
      return { status: "invalid" };
    }

    return {
      organizationId: organizationIdFromIdPayload(payload),
      status: "ok",
      sub: payload.sub,
    };
  } catch (error) {
    if (error instanceof JwtExpiredError) {
      return { status: "expired" };
    }

    return { status: "invalid" };
  }
}

export async function verifyAccessToken(
  token: string | undefined,
): Promise<AccessVerification> {
  if (!token) {
    return { status: "missing" };
  }

  try {
    const payload = await getAccessVerifier().verify(token);
    const user = sessionUserFromPayload(payload);

    if (!user) {
      return { status: "invalid" };
    }

    return { needsIdToken: false, status: "ok", user };
  } catch (error) {
    if (error instanceof JwtExpiredError) {
      return { status: "expired" };
    }

    return { status: "invalid" };
  }
}

export async function verifyIdToken(
  token: string,
  nonce: string,
): Promise<void> {
  await getIdVerifier().verify(token, {
    customJwtCheck: ({ payload }) => {
      if (payload.nonce !== nonce) {
        throw new Error("ID token nonce mismatch");
      }
    },
  });
}

export async function verifyAccessCookie(): Promise<AccessVerification> {
  const cookieStore = await cookies();
  const access = await verifyAccessToken(cookieStore.get(ACCESS_COOKIE)?.value);
  if (access.status !== "ok") {
    return access;
  }

  const idToken = await verifyIdTokenSession(cookieStore.get(ID_COOKIE)?.value);
  if (idToken.status === "invalid") {
    return { status: "invalid" };
  }

  if (idToken.status !== "ok") {
    return { needsIdToken: true, status: "ok", user: access.user };
  }

  if (idToken.sub !== access.user.sub) {
    return { status: "invalid" };
  }

  return {
    needsIdToken: false,
    status: "ok",
    user: { ...access.user, organizationId: idToken.organizationId },
  };
}

export function applyIdRefreshAttempt(
  store: CookieWriter,
  hasIdToken: boolean,
): void {
  if (hasIdToken) {
    store.delete(ID_REFRESH_ATTEMPTED_COOKIE);
    return;
  }

  store.set(ID_REFRESH_ATTEMPTED_COOKIE, "1", cookieOptions(60));
}

async function userFromTokenSet(
  tokens: CognitoTokenSet,
): Promise<AccessVerification> {
  const access = await verifyAccessToken(tokens.accessToken);
  if (access.status !== "ok") {
    return access;
  }

  if (!tokens.idToken) {
    return { needsIdToken: true, status: "ok", user: access.user };
  }

  const idToken = await verifyIdTokenSession(tokens.idToken);
  if (idToken.status !== "ok" || idToken.sub !== access.user.sub) {
    return { needsIdToken: true, status: "ok", user: access.user };
  }

  return {
    needsIdToken: false,
    status: "ok",
    user: { ...access.user, organizationId: idToken.organizationId },
  };
}

export async function persistRefreshedSession(): Promise<AccessVerification> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (!refreshToken) {
    return { status: "missing" };
  }

  try {
    const tokens = await refreshAccessToken(refreshToken);
    const verified = await userFromTokenSet(tokens);

    if (verified.status !== "ok") {
      return verified;
    }

    applyTokenCookies(cookieStore, tokens);
    applyIdRefreshAttempt(cookieStore, !verified.needsIdToken);
    return verified;
  } catch (error) {
    console.error("Failed to refresh Cognito session:", error);
    return { status: "invalid" };
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const verified = await verifyAccessCookie();
  return verified.status === "ok" ? verified.user : null;
}

export async function requireUserPage(returnPath: string): Promise<SessionUser> {
  const verified = await verifyAccessCookie();

  if (verified.status === "ok") {
    if (verified.needsIdToken) {
      const cookieStore = await cookies();
      const canRefreshId =
        Boolean(cookieStore.get(REFRESH_COOKIE)?.value) &&
        !cookieStore.get(ID_REFRESH_ATTEMPTED_COOKIE)?.value;

      if (canRefreshId) {
        redirect(`/api/auth/refresh?next=${encodeURIComponent(returnPath)}`);
      }
    }

    return verified.user;
  }

  const cookieStore = await cookies();
  const canRefresh =
    Boolean(cookieStore.get(REFRESH_COOKIE)?.value) &&
    (verified.status === "expired" || verified.status === "missing");

  if (canRefresh) {
    redirect(`/api/auth/refresh?next=${encodeURIComponent(returnPath)}`);
  }

  redirect(`/api/auth/login?next=${encodeURIComponent(returnPath)}`);
}

export async function requireAdminPage(returnPath: string): Promise<SessionUser> {
  const user = await requireUserPage(returnPath);

  if (!user.isAdmin) {
    redirect("/forbidden");
  }

  return user;
}

export async function requireSuperAdminPage(
  returnPath: string,
): Promise<SessionUser> {
  const user = await requireAdminPage(returnPath);

  if (!user.isSuperAdmin) {
    redirect("/forbidden");
  }

  return user;
}

export async function requireUserApi(): Promise<NextResponse | SessionUser> {
  let verified = await verifyAccessCookie();

  if (verified.status === "expired" || verified.status === "missing") {
    verified = await persistRefreshedSession();
  } else if (verified.status === "ok" && verified.needsIdToken) {
    const refreshed = await persistRefreshedSession();
    if (refreshed.status === "ok") {
      verified = refreshed;
    }
  }

  if (verified.status === "ok") {
    return verified.user;
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function requireAdminUser(): Promise<NextResponse | SessionUser> {
  const user = await requireUserApi();

  if (user instanceof NextResponse) {
    return user;
  }

  if (!user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return user;
}

export async function requireSuperAdminUser(): Promise<
  NextResponse | SessionUser
> {
  const user = await requireAdminUser();

  if (user instanceof NextResponse) {
    return user;
  }

  if (!user.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return user;
}

export async function requireAdminApi(): Promise<NextResponse | null> {
  const user = await requireAdminUser();
  return user instanceof NextResponse ? user : null;
}
