import {
  apiErrorSchema,
  authRequestSchema,
  authResponseSchema,
  roastRequestSchema,
  roastResponseSchema,
  type AuthResponse,
  type RoastResponse,
} from "../shared/schemas";
import { clearAuthToken, getAuthToken } from "./auth";

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

export async function authenticate(password: string): Promise<AuthResponse> {
  const payload = authRequestSchema.parse({ password });
  const response = await fetch("/api/auth", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data: unknown = await response.json();

  if (!response.ok) {
    const parsedError = apiErrorSchema.safeParse(data);
    throw new Error(parsedError.success ? parsedError.data.error : "Access denied.");
  }

  return authResponseSchema.parse(data);
}

export async function requestRoast(
  claim: string,
  sessionId: string,
): Promise<RoastResponse> {
  const payload = roastRequestSchema.parse({ claim, sessionId });
  const response = await fetch("/api/roast", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data: unknown = await response.json();

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthToken();
      window.location.reload();
    }

    const parsedError = apiErrorSchema.safeParse(data);
    throw new Error(parsedError.success ? parsedError.data.error : "Agent misfired.");
  }

  return roastResponseSchema.parse(data);
}
