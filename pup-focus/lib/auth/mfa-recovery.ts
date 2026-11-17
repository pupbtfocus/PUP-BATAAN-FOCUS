import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/**
 * Generates single-use human-readable backup recovery codes (`XXXX-XXXX`).
 */
export function generateRecoveryCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = randomBytes(8);
    let raw = "";
    for (let j = 0; j < 8; j++) {
      raw += CODE_ALPHABET[bytes[j] % CODE_ALPHABET.length];
    }
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}`);
  }
  return codes;
}

export function normalizeRecoveryCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function hashRecoveryCode(input: string): string {
  const normalized = normalizeRecoveryCode(input);
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

export function findMatchingHashIndex(
  candidateCode: string,
  storedHashes: string[],
): number {
  const candidateHex = hashRecoveryCode(candidateCode);
  const candidateBuf = Buffer.from(candidateHex, "utf8");

  for (let i = 0; i < storedHashes.length; i++) {
    const stored = typeof storedHashes[i] === "string" ? storedHashes[i] : "";
    if (stored.length !== candidateHex.length) continue;
    try {
      if (timingSafeEqual(candidateBuf, Buffer.from(stored, "utf8"))) {
        return i;
      }
    } catch {
      // Ignore mismatched lengths
    }
  }

  return -1;
}
