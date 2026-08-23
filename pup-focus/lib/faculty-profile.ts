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

  if (parts.length === 3) {
    // When 3 words exist (e.g. ["Aienne", "Ramos", "Facun"])
    return {
      firstName: parts[0],
      middleName: parts[1],
      lastName: parts[2],
    };
  }

  if (parts.length === 4) {
    // When 4 words exist (e.g. ["Aienne", "Joy", "Ramos", "Facun"])
    // first_name = "Aienne Joy", middle_name = "Ramos", last_name = "Facun"
    return {
      firstName: `${parts[0]} ${parts[1]}`,
      middleName: parts[2],
      lastName: parts[3],
    };
  }

  // 5 or more words (e.g. ["Maria", "Clara", "De", "Ramos", "Facun"])
  const lastName = parts[parts.length - 1];
  const middleName = parts[parts.length - 2];
  const firstName = parts.slice(0, -2).join(" ");
  return { firstName, middleName, lastName };
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

