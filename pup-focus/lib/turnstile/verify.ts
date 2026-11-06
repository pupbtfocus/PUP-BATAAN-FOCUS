import type { NextRequest } from "next/server";
import { getTurnstileSecretKey } from "@/config/env";

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
  expectedAction: string;
  request: NextRequest;
}

export interface VerifyTurnstileResult {
  ok: boolean;
  status: number;
  error?: string;
  errorCodes?: string[];
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

function extractClientIp(request: NextRequest): string {
  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "";
}

export async function verifyTurnstileToken({
  token,
  expectedAction,
  request,
}: VerifyTurnstileOptions): Promise<VerifyTurnstileResult> {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  const secret = getTurnstileSecretKey();

  if (!siteKey) {
    return { ok: true, status: 200 };
  }

  if (!secret) {
    return {
      ok: false,
      status: 500,
      error:
        "Turnstile server secret is not configured. Set TURNSTILE_SECRET_KEY (or TURNSTILE_SECRET) in your environment.",
    };
  }

  const expectedHostnames = getExpectedHostnames();

  if (
    typeof token !== "string" ||
    token.length === 0 ||
    token.length > 2048 ||
    expectedHostnames.size === 0
  ) {
    return {
      ok: false,
      status: 403,
      error: "Security verification is required. Please complete the Turnstile challenge.",
    };
  }

  const clientIp = extractClientIp(request);
  const params = new URLSearchParams({
    secret,
    response: token,
  });
  if (clientIp) {
    params.set("remoteip", clientIp);
  }

  let result: TurnstileSiteverifyResponse;
  try {
    const r = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: AbortSignal.timeout(10_000),
        body: params,
      },
    );
    if (!r.ok) {
      throw new Error(`siteverify ${r.status}`);
    }
    result = (await r.json()) as TurnstileSiteverifyResponse;
  } catch {
    return {
      ok: false,
      status: 403,
      error: "Unable to verify security challenge. Please try again.",
    };
  }

  const errorCodes = result["error-codes"] ?? [];
  const normalizedHostname = (result.hostname ?? "").toLowerCase();
  const isTestingBypass = normalizedHostname === "example.com" && process.env.NODE_ENV !== "production";

  if (
    !result.success ||
    (result.action && result.action !== expectedAction) ||
    (!isTestingBypass && !expectedHostnames.has(normalizedHostname))
  ) {
    const isInvalidSecret = errorCodes.includes("invalid-input-secret");
    return {
      ok: false,
      status: 403,
      errorCodes,
      error: isInvalidSecret
        ? "invalid-input-secret: Cloudflare Turnstile secret key does not match this widget."
        : "Security verification failed or expired. Please try again.",
    };
  }

  return { ok: true, status: 200 };
}

