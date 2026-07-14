import type { NextFunction, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

import type { OAuthTokenVerifier } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

export const OAUTH_SCOPES = ["openid", "email"] as const;

type PreviewAuthConfig = {
  mode: "preview";
};

type SupabaseAuthConfig = {
  mode: "supabase";
  supabaseUrl: URL;
  issuer: string;
  audience: string;
  resource: URL;
  resourceMetadataUrl: URL;
  allowedEmail?: string;
  allowedUserId?: string;
};

export type AuthConfig = PreviewAuthConfig | SupabaseAuthConfig;

function requiredUrl(name: string): URL {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required when BLACKHAWK_AUTH_MODE=supabase.`);
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`${name} must be an HTTPS URL.`);
  return url;
}

export function loadAuthConfig(): AuthConfig {
  const mode = process.env.BLACKHAWK_AUTH_MODE ?? "preview";
  if (mode === "preview") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("BLACKHAWK_AUTH_MODE=preview is forbidden when NODE_ENV=production.");
    }
    return { mode };
  }
  if (mode !== "supabase") {
    throw new Error("BLACKHAWK_AUTH_MODE must be either preview or supabase.");
  }

  const supabaseUrl = requiredUrl("SUPABASE_URL");
  const resource = requiredUrl("BLACKHAWK_MCP_RESOURCE_URL");
  const allowedEmail = process.env.BLACKHAWK_ALLOWED_EMAIL?.trim().toLowerCase();
  const allowedUserId = process.env.BLACKHAWK_ALLOWED_USER_ID?.trim();
  if (!allowedEmail && !allowedUserId) {
    throw new Error("Set BLACKHAWK_ALLOWED_USER_ID or BLACKHAWK_ALLOWED_EMAIL to enforce Will-only access.");
  }

  return {
    mode,
    supabaseUrl,
    issuer: new URL("/auth/v1", supabaseUrl).toString().replace(/\/$/, ""),
    audience: process.env.BLACKHAWK_TOKEN_AUDIENCE ?? resource.toString(),
    resource,
    resourceMetadataUrl: new URL("/.well-known/oauth-protected-resource", resource),
    allowedEmail,
    allowedUserId
  };
}

function stringClaim(payload: JWTPayload, name: string): string | undefined {
  const value = payload[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function tokenScopes(payload: JWTPayload): string[] {
  const scope = stringClaim(payload, "scope");
  if (scope) return scope.split(/\s+/).filter(Boolean);
  const scp = payload.scp;
  return Array.isArray(scp) ? scp.filter((value): value is string => typeof value === "string") : [];
}

export function createSupabaseTokenVerifier(config: SupabaseAuthConfig): OAuthTokenVerifier {
  const jwks = createRemoteJWKSet(new URL(".well-known/jwks.json", `${config.issuer}/`));

  return {
    async verifyAccessToken(token: string): Promise<AuthInfo> {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: config.issuer,
        audience: config.audience
      });

      const userId = payload.sub;
      const email = stringClaim(payload, "email")?.toLowerCase();
      const clientId = stringClaim(payload, "client_id") ?? stringClaim(payload, "azp");
      if (!userId || !clientId || typeof payload.exp !== "number") {
        throw new Error("Access token is missing sub, client_id, or exp.");
      }
      if (config.allowedUserId && userId !== config.allowedUserId) {
        throw new Error("The authenticated user is not authorized for Blackhawk.");
      }
      if (config.allowedEmail && email !== config.allowedEmail) {
        throw new Error("The authenticated email is not authorized for Blackhawk.");
      }

      const scopes = tokenScopes(payload);
      if (!OAUTH_SCOPES.every((scope) => scopes.includes(scope))) {
        throw new Error("Access token does not contain the required Blackhawk scopes.");
      }

      return {
        token,
        clientId,
        scopes,
        expiresAt: payload.exp,
        resource: config.resource,
        extra: { userId, email }
      };
    }
  };
}

export function optionalBearerAuth(config: AuthConfig) {
  if (config.mode === "preview") {
    return (_request: Request, _response: Response, next: NextFunction) => next();
  }

  const verifier = createSupabaseTokenVerifier(config);
  return async (request: Request, response: Response, next: NextFunction) => {
    const authorization = request.headers.authorization;
    if (!authorization) return next();

    const [scheme, token, ...rest] = authorization.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token || rest.length > 0) {
      return unauthorized(response, config, "invalid_token", "Expected a Bearer access token.");
    }

    try {
      (request as Request & { auth?: AuthInfo }).auth = await verifier.verifyAccessToken(token);
      return next();
    } catch {
      return unauthorized(response, config, "invalid_token", "The access token is invalid or unauthorized.");
    }
  };
}

export function protectedResourceMetadata(config: SupabaseAuthConfig) {
  return {
    resource: config.resource.toString(),
    authorization_servers: [config.issuer],
    scopes_supported: [...OAUTH_SCOPES],
    bearer_methods_supported: ["header"]
  };
}

export function authChallenge(
  config: SupabaseAuthConfig,
  error = "invalid_token",
  description = "Connect your authorized Blackhawk account to continue."
) {
  return `Bearer resource_metadata="${config.resourceMetadataUrl}", error="${error}", error_description="${description}"`;
}

function unauthorized(response: Response, config: SupabaseAuthConfig, error: string, description: string) {
  response.setHeader("WWW-Authenticate", authChallenge(config, error, description));
  return response.status(401).json({ error, error_description: description });
}
