export const FACULTY_PROFILE_IMAGE_BUCKET = "compliance-private";

export function buildFacultyFullName(input: {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
}) {
  return [input.firstName, input.middleName, input.lastName]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
}

export function buildFacultyInitials(fullName: string) {
  const initials = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return initials.slice(0, 3) || "F";
}

/**
 * Fallback parser for single full_name strings on legacy records where separate
 * first_name, middle_name, and last_name database columns are not populated.
 * Handles multi-word first names (e.g. "Christian Jay Cereza") without incorrectly
 * pushing parts of the first name into the middle name field.
 */
export function parseFullNameFallback(fullName?: string | null): {
  firstName: string;
  middleName: string;
  lastName: string;
} {
  if (!fullName) {
    return { firstName: "", middleName: "", lastName: "" };
  }

  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return { firstName: "", middleName: "", lastName: "" };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], middleName: "", lastName: "" };
  }

  if (parts.length === 2) {
    return { firstName: parts[0], middleName: "", lastName: parts[1] };
  }

  // 3 or more words (e.g., "Christian Jay Cereza" or "Mary Ann S. Dela Cruz")
  const lastName = parts[parts.length - 1];
  const penultimate = parts[parts.length - 2];

  // If penultimate part is an explicit middle initial (e.g. "S.", "A", "C."):
  if (parts.length >= 3 && (penultimate.length === 1 || penultimate.endsWith("."))) {
    const firstName = parts.slice(0, -2).join(" ");
    const middleName = penultimate.replace(/\.$/, "");
    return { firstName, middleName, lastName };
  }

  // 4 or more words (e.g., "Christian Jay Cereza Mandani"):
  // First Name: "Christian Jay", Middle Name: "Cereza", Last Name: "Mandani"
  if (parts.length >= 4) {
    const firstName = parts.slice(0, -2).join(" ");
    const middleName = penultimate;
    return { firstName, middleName, lastName };
  }

  // 3 words without middle initial (e.g., "Christian Jay Cereza"):
  const firstName = parts.slice(0, -1).join(" ");
  return { firstName, middleName: "", lastName };
}

/**
 * Extracts the first name from a user's full name (or returns fallback).
 * Handles multi-word first names cleanly (e.g. "Christian Jay Cereza Mandani" -> "Christian Jay" or "Christian").
 */
export function extractFirstName(fullName?: string | null, fallback: string = "Faculty"): string {
  if (!fullName || !fullName.trim()) return fallback;
  const parsed = parseFullNameFallback(fullName);
  return parsed.firstName || fullName.trim().split(/\s+/)[0] || fallback;
}

