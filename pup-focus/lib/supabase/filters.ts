// PostgREST filter helpers.
//
// PostgREST parses the argument of `.or()` / `.and()` / `.filter()` as filter
// *grammar*, not as a bound value, and supabase-js appends it verbatim
// (`or(filters)` -> `searchParams.append("or", \`(${filters})\`)`). Any value
// that comes from a request must therefore be quoted before it is
// interpolated, or it can add new filter conditions.
//
// The column methods (`.eq()`, `.neq()`, `.in()`, `.ilike(column, value)`) bind
// their value and are safe on their own. Prefer them whenever only one column
// is involved, and use the helpers below to build multi-column `.or()` strings.

/** UUID v1-v5 shape used across the PUP FOCUS schema. */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

/**
 * Keep only valid UUIDs, preserving order and removing duplicates.
 * Use to validate a list of ids arriving from a query string or request body.
 */
export function filterUuids(values: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (isUuid(value) && !seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }
  return out;
}

/**
 * Quote a value for safe interpolation into a PostgREST filter string.
 *
 * PostgREST reserved characters (`, . : ( )`) must be wrapped in double
 * quotes; inside a quoted string `"` is escaped as `\"` and `\` as `\\`.
 * Quoting unconditionally is safe and keeps call sites simple.
 */
export function escapeFilterValue(value: unknown): string {
  const str = typeof value === "string" ? value : String(value ?? "");
  return `"${str.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Build a single PostgREST condition with a quoted value, e.g.
 * `email.eq."user@example.com"` or `full_name.ilike."%dela Cruz%"`.
 * Column names and operators must be app-controlled constants, never request
 * input.
 */
export function filterCondition(
  column: string,
  operator: string,
  value: unknown
): string {
  return `${column}.${operator}.${escapeFilterValue(value)}`;
}

/** Join conditions into the comma-separated body of an `.or()` filter. */
export function orFilter(conditions: readonly string[]): string {
  return conditions.join(",");
}
