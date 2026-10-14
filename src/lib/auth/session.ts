import "server-only";

import { CognitoJwtVerifier } from "aws-jwt-verify";
import { JwtExpiredError } from "aws-jwt-verify/error";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { refreshAccessToken, type CognitoTokenSet } from "@/lib/auth/cognito";
import { getCognitoConfig } from "@/lib/auth/config";
import {
  isScannerOperator,
  landingPath,
} from "@/lib/auth/roles";
import {
  ACCESS_COOKIE,
  OAUTH_NEXT_COOKIE,
  OAUTH_NONCE_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  REFRESH_COOKIE,
} from "@/lib/auth/cookie-names";

export {
  ACCESS_COOKIE,
  OAUTH_NEXT_COOKIE,
  OAUTH_NONCE_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  REFRESH_COOKIE,
} from "@/lib/auth/cookie-names";

const OAUTH_COOKIE_MAX_AGE = 60 * 10;
const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

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

export type AccessVerification =
  | { status: "expired" }
  | { status: "forbidden" }
  | { status: "invalid" }
  | { status: "missing" }
  | { status: "ok"; groups?: string[]; organizationId?: string };

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
      // No group requirement here: every signed-in user verifies `ok`, and the
      // guards layer role checks (organization claim or operator group) on
      // top. Enforcing groups at the verifier would reject scanees outright.
      tokenUse: "access",
      userPoolId: config.userPoolId,
    });
  }

  return accessVerifier;
}

/** Group names that grant scanner-operator access without an organization claim. */
function operatorGroups(): string[] {
  const config = getCognitoConfig();
  return [config.superAdminGroup, config.orgSubmitterGroup, config.adminGroup];
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

export async function verifyAccessToken(
  token: string | undefined,
): Promise<AccessVerification> {
  if (!token) {
    return { status: "missing" };
  }

  try {
    const payload = await getAccessVerifier().verify(token);
    const rawGroups = (payload as { "cognito:groups"?: unknown })["cognito:groups"];
    const groups = Array.isArray(rawGroups)
      ? rawGroups.filter((group): group is string => typeof group === "string")
      : [];
    const rawOrganizationId = (
      payload as { "custom:organization_id"?: unknown }
    )["custom:organization_id"];
    const organizationId =
      typeof rawOrganizationId === "string" && rawOrganizationId.trim()
        ? rawOrganizationId.trim()
        : undefined;
    return { status: "ok", groups, organizationId };
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
  return verifyAccessToken(cookieStore.get(ACCESS_COOKIE)?.value);
}

export async function persistRefreshedSession(): Promise<AccessVerification> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (!refreshToken) {
    return { status: "missing" };
  }

  try {
    const tokens = await refreshAccessToken(refreshToken);
    const verified = await verifyAccessToken(tokens.accessToken);

    if (verified.status !== "ok") {
      return verified;
    }

    applyTokenCookies(cookieStore, tokens);
    return {
      status: "ok",
      groups: verified.groups,
      organizationId: verified.organizationId,
    };
  } catch (error) {
    console.error("Failed to refresh Cognito session:", error);
    return { status: "invalid" };
  }
}

export async function requireAdminPage(returnPath: string): Promise<void> {
  const verified = await verifyAccessCookie();

  if (verified.status === "ok") {
    if (!isScannerOperator(verified, operatorGroups())) {
      redirect("/forbidden");
    }
    return;
  }

  if (verified.status === "forbidden") {
    redirect("/forbidden");
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

export async function requireSuperAdminPage(returnPath: string): Promise<void> {
  const verified = await verifyAccessCookie();

  if (verified.status === "ok") {
    const { superAdminGroup } = getCognitoConfig();
    if (verified.groups?.includes(superAdminGroup)) {
      return;
    }
    redirect("/forbidden");
  }

  if (verified.status === "forbidden") {
    redirect("/forbidden");
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

export async function requireAdminApi(): Promise<NextResponse | null> {
  let verified = await verifyAccessCookie();

  if (verified.status === "expired" || verified.status === "missing") {
    verified = await persistRefreshedSession();
  }

  if (verified.status === "ok") {
    if (!isScannerOperator(verified, operatorGroups())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return null;
  }

  if (verified.status === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export type SessionIdentity = {
  organizationId: string | null;
  groups: string[];
};

/**
 * Verified identity for the current request, or null when no usable session
 * exists (missing, invalid, or an un-refreshable expiry). Never redirects —
 * safe to call from a server component deciding where to route a user.
 */
export async function getSessionIdentity(): Promise<SessionIdentity | null> {
  let verified = await verifyAccessCookie();

  if (verified.status === "expired" || verified.status === "missing") {
    verified = await persistRefreshedSession();
  }

  if (verified.status !== "ok") {
    return null;
  }

  return {
    organizationId: verified.organizationId ?? null,
    groups: verified.groups ?? [],
  };
}

/** Where a signed-in visitor should land: "/scanner" for operators, "/" otherwise. */
export async function getLandingPath(): Promise<"/" | "/scanner"> {
  const identity = await getSessionIdentity();
  if (!identity) {
    return "/";
  }
  return landingPath(identity, operatorGroups());
}

/** "operator" can reach /scanner; "scanee" registers and shows their own QR. */
export async function currentAudience(): Promise<"operator" | "scanee"> {
  const identity = await getSessionIdentity();
  if (!identity) {
    return "scanee";
  }
  return isScannerOperator(identity, operatorGroups()) ? "operator" : "scanee";
}

export type AdminApiIdentity = {
  unauthorized: NextResponse | null;
  organizationId: string | null;
  groups: string[];
};

/**
 * Like requireAdminApi(), but also returns the caller's organization scope and
 * groups so server routes can trust the token (not a client-supplied param)
 * when calling the mapua-apex backend. `organizationId` is null for admins who
 * have no custom:organization_id claim — they are allowed to see every org.
 */
export async function requireAdminApiWithIdentity(): Promise<AdminApiIdentity> {
  let verified = await verifyAccessCookie();

  if (verified.status === "expired" || verified.status === "missing") {
    verified = await persistRefreshedSession();
  }

  if (verified.status === "ok") {
    if (!isScannerOperator(verified, operatorGroups())) {
      return {
        unauthorized: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
        organizationId: null,
        groups: [],
      };
    }
    return {
      unauthorized: null,
      organizationId: verified.organizationId ?? null,
      groups: verified.groups ?? [],
    };
  }

  if (verified.status === "forbidden") {
    return {
      unauthorized: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      organizationId: null,
      groups: [],
    };
  }

  return {
    unauthorized: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    organizationId: null,
    groups: [],
  };
}
