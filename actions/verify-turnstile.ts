'use server';

import { headers } from 'next/headers';
import { ActionResponse } from '../lib/auth/roles';

interface TurnstileVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
}

export async function verifyTurnstileToken(
  token: string | null | undefined
): Promise<ActionResponse<{ verified: true }>> {
  if (!token || typeof token !== 'string') {
    return {
      success: false,
      error: 'Turnstile verification token is required.',
    };
  }

  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    return {
      success: false,
      error: 'Server configuration error: Missing Turnstile secret key.',
    };
  }

  try {
    const headerStore = await headers();
    const remoteIp =
      headerStore.get('cf-connecting-ip') ||
      headerStore.get('x-forwarded-for')?.split(',')[0]?.trim();

    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (remoteIp) {
      formData.append('remoteip', remoteIp);
    }

    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return {
        success: false,
        error: 'Failed to communicate with Turnstile verification service.',
      };
    }

    const result: TurnstileVerifyResponse = await response.json();

    if (!result.success) {
      return {
        success: false,
        error: 'CAPTCHA verification failed. Please try again.',
      };
    }

    return {
      success: true,
      data: { verified: true },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred during Turnstile verification.',
    };
  }
}

