import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { getTurnstileSecretKey } from "@/config/env";

const TURNSTILE_VERIFY_ENDPOINT =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileSiteverifyResponse {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
}

export interface VerifyTurnstileOptions {
  token: unknown;
  secretKey?: string;
  expectedAction?: string;
  request?: NextRequest | Request;
  remoteIp?: string;
}

export interface VerifyTurnstileResult {
  ok: boolean;
  status: number;
  code?: string;
  error?: string;
  errorCodes?: string[];
  hostname?: string;
  action?: string;
}

export function extractTurnstileToken(
  payload: FormData | Record<string, unknown> | null | undefined,
): string | null {
  if (!payload) return null;

  if (typeof FormData !== "undefined" && payload instanceof FormData) {
    const raw =
      payload.get("cf-turnstile-response") ??
      payload.get("captchaToken") ??
      payload.get("turnstileToken");
    return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
  }

  const record = payload as Record<string, unknown>;
  const raw =
    record["cf-turnstile-response"] ??
    record.captchaToken ??
    record.turnstileToken;
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

function getExpectedHostnames(): Set<string> {
  const configured = (process.env.TURNSTILE_HOSTNAMES ?? "")
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);

  if (configured.length > 0) {
    if (process.env.NODE_ENV === "production") {
      return new Set(
        configured.filter((h) => h !== "localhost" && h !== "127.0.0.1"),
      );
    }
    return new Set(configured);
  }

  const fallback = new Set<string>();
  const appUrls = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
  ];

  for (const rawUrl of appUrls) {
    if (!rawUrl) continue;
    try {
      const parsed = new URL(rawUrl);
      if (parsed.hostname) {
        fallback.add(parsed.hostname.toLowerCase());
      }
    } catch {
      // Ignore malformed URLs
    }
  }

  if (process.env.NODE_ENV !== "production") {
    fallback.add("localhost");
    fallback.add("127.0.0.1");
  }

  return fallback;
}

async function resolveClientIp(
  request?: NextRequest | Request,
  explicitIp?: string,
): Promise<string> {
  if (explicitIp?.trim()) return explicitIp.trim();

  let headerSource: Pick<Headers, "get"> | null = request?.headers ?? null;
  if (!headerSource) {
    try {
      headerSource = await headers();
    } catch {
      headerSource = null;
    }
  }

  if (!headerSource) return "";

  const cfIp = headerSource.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  const forwardedFor = headerSource.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const realIp = headerSource.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "";
}

function mapTurnstileErrorMessage(errorCodes: string[]): {
  code: string;
  message: string;
} {
  if (errorCodes.includes("invalid-input-secret")) {
    return {
      code: "invalid-input-secret",
      message:
        "invalid-input-secret: Cloudflare Turnstile secret key does not match this widget.",
    };
  }
  if (errorCodes.includes("missing-input-secret")) {
    return {
      code: "missing-input-secret",
      message: "Turnstile server secret key is missing.",
    };
  }
  if (errorCodes.includes("timeout-or-duplicate")) {
    return {
      code: "timeout-or-duplicate",
      message:
        "Security verification token has expired or has already been used. Please complete the challenge again.",
    };
  }
  if (errorCodes.includes("invalid-input-response")) {
    return {
      code: "invalid-input-response",
      message:
        "Invalid security verification token. Please complete the Turnstile challenge and try again.",
    };
  }
  if (errorCodes.includes("missing-input-response")) {
    return {
      code: "missing-input-response",
      message:
        "Security verification token is missing. Please complete the Turnstile challenge.",
    };
  }
  if (errorCodes.includes("bad-request")) {
    return {
      code: "bad-request",
      message: "Malformed security verification request. Please try again.",
    };
  }
  if (errorCodes.includes("internal-error")) {
    return {
      code: "internal-error",
      message:
        "Cloudflare Turnstile encountered a temporary error. Please try again.",
    };
  }
  return {
    code: errorCodes[0] ?? "verification-failed",
    message: "Security verification failed or expired. Please try again.",
  };
}

export async function verifyTurnstileToken(
  optionsOrToken: VerifyTurnstileOptions | unknown,
  secretKeyArg?: string,
  extraOptions?: Omit<VerifyTurnstileOptions, "token" | "secretKey">,
): Promise<VerifyTurnstileResult> {
  const options: VerifyTurnstileOptions =
    typeof optionsOrToken === "object" &&
    optionsOrToken !== null &&
    "token" in optionsOrToken
      ? (optionsOrToken as VerifyTurnstileOptions)
      : {
          token: optionsOrToken,
          secretKey: secretKeyArg,
          ...extraOptions,
        };

  const { token, expectedAction, request, remoteIp } = options;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  const secret =
    options.secretKey?.trim() ||
    process.env.TURNSTILE_SECRET_KEY?.trim() ||
    getTurnstileSecretKey();

  if (!siteKey && !secret) {
    return { ok: true, status: 200 };
  }

  if (!secret) {
    return {
      ok: false,
      status: 500,
      code: "missing-input-secret",
      error:
        "Turnstile server secret is not configured. Set TURNSTILE_SECRET_KEY in your environment.",
    };
  }

  if (typeof token !== "string" || token.trim().length === 0) {
    return {
      ok: false,
      status: 400,
      code: "missing-input-response",
      error:
        "Security verification is required. Please complete the Turnstile challenge.",
    };
  }

  const trimmedToken = token.trim();
  if (trimmedToken.length > 2048) {
    return {
      ok: false,
      status: 400,
      code: "invalid-input-response",
      error:
        "Invalid security verification token format. Please refresh and try again.",
    };
  }

  const clientIp = await resolveClientIp(request, remoteIp);
  const params = new URLSearchParams({
    secret,
    response: trimmedToken,
  });
  if (clientIp) {
    params.set("remoteip", clientIp);
  }

  let result: TurnstileSiteverifyResponse;
  try {
    const response = await fetch(TURNSTILE_VERIFY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10_000),
      body: params.toString(),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`siteverify HTTP ${response.status}`);
    }
    result = (await response.json()) as TurnstileSiteverifyResponse;
  } catch {
    return {
      ok: false,
      status: 502,
      code: "network-error",
      error:
        "Unable to reach Cloudflare security verification service. Please try again.",
    };
  }

  const errorCodes = result["error-codes"] ?? [];

  if (!result.success) {
    const mapped = mapTurnstileErrorMessage(errorCodes);
    return {
      ok: false,
      status: 403,
      code: mapped.code,
      errorCodes,
      error: mapped.message,
    };
  }

  if (expectedAction && result.action && result.action !== expectedAction) {
    return {
      ok: false,
      status: 403,
      code: "action-mismatch",
      errorCodes,
      error: "Security verification challenge action mismatch. Please refresh and try again.",
    };
  }

  const expectedHostnames = getExpectedHostnames();
  const normalizedHostname = (result.hostname ?? "").toLowerCase();
  const isTestingBypass =
    normalizedHostname === "example.com" &&
    process.env.NODE_ENV !== "production";

  if (
    expectedHostnames.size > 0 &&
    normalizedHostname &&
    !isTestingBypass &&
    !expectedHostnames.has(normalizedHostname)
  ) {
    return {
      ok: false,
      status: 403,
      code: "hostname-mismatch",
      errorCodes,
      error: `Security verification failed: unauthorized hostname (${normalizedHostname}).`,
    };
  }

  return {
    ok: true,
    status: 200,
    hostname: result.hostname,
    action: result.action,
  };
}

