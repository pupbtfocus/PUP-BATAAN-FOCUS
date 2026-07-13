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
