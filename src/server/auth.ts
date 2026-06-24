import { createHash, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

const SITE_PASSWORD = "1234vg";

const AUTH_TOKEN = createHash("sha256")
  .update(`vgn-auth:${SITE_PASSWORD}`)
  .digest("hex");

export function createAuthToken(): string {
  return AUTH_TOKEN;
}

export function isValidPassword(password: string): boolean {
  if (password.length !== SITE_PASSWORD.length) {
    return false;
  }

  try {
    return timingSafeEqual(Buffer.from(password), Buffer.from(SITE_PASSWORD));
  } catch {
    return false;
  }
}

export function isValidAuthToken(token: string | undefined): boolean {
  if (!token) {
    return false;
  }

  if (token.length !== AUTH_TOKEN.length) {
    return false;
  }

  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(AUTH_TOKEN));
  } catch {
    return false;
  }
}

export function getBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization?.startsWith("Bearer ")) {
    return undefined;
  }

  return authorization.slice(7);
}

export const requireAuth: RequestHandler = (request, response, next) => {
  const token = getBearerToken(request.headers.authorization);

  if (isValidAuthToken(token)) {
    next();
    return;
  }

  response.status(401).json({ error: "Unauthorized." });
};
