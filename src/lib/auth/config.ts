import "server-only";

export type CognitoConfig = {
  adminGroup: string;
  appBaseUrl: string;
  orgSubmitterGroup: string;
  superAdminGroup: string;
  clientId: string;
  clientSecret: string;
  domain: string;
  logoutUri: string;
  redirectUri: string;
  userPoolId: string;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }
  return value;
}

export function getCognitoConfig(): CognitoConfig {
  const appBaseUrl = required("APP_BASE_URL").replace(/\/$/, "");
  const domain = required("COGNITO_DOMAIN")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  return {
    adminGroup: required("COGNITO_ADMIN_GROUP"),
    appBaseUrl,
    orgSubmitterGroup:
      process.env.COGNITO_ORG_SUBMITTER_GROUP?.trim() || "org_submitter",
    superAdminGroup:
      process.env.COGNITO_SUPER_ADMIN_GROUP?.trim() || "admin",
    clientId: required("COGNITO_CLIENT_ID"),
    clientSecret: required("COGNITO_CLIENT_SECRET"),
    domain,
    logoutUri: `${appBaseUrl}/`,
    redirectUri: `${appBaseUrl}/api/auth/callback`,
    userPoolId: required("COGNITO_USER_POOL_ID"),
  };
}
