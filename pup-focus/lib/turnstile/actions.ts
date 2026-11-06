"use server";

import {
  extractTurnstileToken,
  verifyTurnstileToken,
  type VerifyTurnstileResult,
} from "@/lib/turnstile/verify";

export async function verifyTurnstileServerAction(
  payload: FormData | Record<string, unknown> | string | null | undefined,
  expectedAction?: string,
): Promise<VerifyTurnstileResult> {
  const token =
    typeof payload === "string" ? payload : extractTurnstileToken(payload);

  return verifyTurnstileToken({
    token,
    expectedAction,
    secretKey: process.env.TURNSTILE_SECRET_KEY,
  });
}

