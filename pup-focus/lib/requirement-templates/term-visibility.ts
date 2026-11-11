/**
 * Term-based visibility tracking for requirement templates.
 *
 * Allows requirement templates to be hidden for specific academic terms (e.g., this semester)
 * and unhidden in future terms without retroactively polluting past term history or
 * causing completed past semesters to appear incomplete.
 */

export function normalizeTermKey(academicYear?: string | null, semester?: string | null): string {
  if (!academicYear || !semester) return "";
  const cleanAy = academicYear.trim().toLowerCase().replace(/\s+/g, "");
  const cleanSem = semester.trim().toLowerCase().replace(/\s+/g, "");
  return `${cleanAy}|${cleanSem}`;
}

export function parseHiddenTerms(description?: string | null): string[] {
  if (!description) return [];
  const match = description.match(/<!--\s*hidden_terms:\s*(\[[^\]]*\])\s*-->/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1]);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function cleanDescription(description?: string | null): string {
  if (!description) return "";
  return description.replace(/<!--\s*hidden_terms:[\s\S]*?-->/g, "").trim();
}

export function formatDescriptionWithHiddenTerms(
  baseDescription: string | null | undefined,
  hiddenTerms: readonly string[]
): string {
  const clean = cleanDescription(baseDescription);
  const uniqueTerms = Array.from(new Set(hiddenTerms.filter(Boolean)));
  if (uniqueTerms.length === 0) return clean;
  return `${clean} <!-- hidden_terms: ${JSON.stringify(uniqueTerms)} -->`.trim();
}

export function isTemplateHiddenForTerm(
  template: { is_active?: boolean | null; description?: string | null },
  academicYear?: string | null,
  semester?: string | null,
  isCurrentActiveTerm: boolean = false
): boolean {
  // If evaluating current active operational term, current is_active flag is source of truth
  if (isCurrentActiveTerm) {
    return template.is_active === false;
  }

  // If no term specified, fall back to is_active flag
  if (!academicYear || !semester) {
    return template.is_active === false;
  }

  const targetKey = normalizeTermKey(academicYear, semester);
  const hiddenTerms = parseHiddenTerms(template.description);

  // Check if explicitly recorded as hidden for this term
  const isExplicitlyHidden = hiddenTerms.some((termKey) => {
    const [ay, sem] = termKey.split("|");
    return normalizeTermKey(ay, sem) === targetKey;
  });

  return isExplicitlyHidden;
}

