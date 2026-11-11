import { describe, it, expect } from "vitest";
import {
  escapeFilterValue,
  filterCondition,
  filterUuids,
  isUuid,
  orFilter,
} from "../../lib/supabase/filters";

describe("PostgREST filter helpers", () => {
  it("wraps values in double quotes so reserved characters stay literal", () => {
    expect(escapeFilterValue("user@example.com")).toBe('"user@example.com"');
    expect(escapeFilterValue("hebdon,john")).toBe('"hebdon,john"');
    expect(escapeFilterValue("a(b)c")).toBe('"a(b)c"');
  });

  it("escapes double quotes and backslashes inside a quoted value", () => {
    expect(escapeFilterValue('a"b')).toBe('"a\\"b"');
    expect(escapeFilterValue("a\\b")).toBe('"a\\\\b"');
  });

  it("builds quoted conditions and or-filters", () => {
    expect(filterCondition("email", "eq", "a@b.com")).toBe('email.eq."a@b.com"');
    expect(filterCondition("full_name", "ilike", "%dela Cruz%")).toBe(
      'full_name.ilike."%dela Cruz%"'
    );
    expect(orFilter(['id.eq."a"', 'user_id.eq."a"'])).toBe(
      'id.eq."a",user_id.eq."a"'
    );
  });

  it("keeps injected filter syntax inside a single quoted value", () => {
    const malicious = 'x"),id.eq.00000000-0000-0000-0000-000000000000';
    const built = filterCondition("email", "eq", malicious);

    // The payload must not close the quoted value early, so it cannot add a
    // second OR condition to the filter string.
    expect(built).toBe(
      'email.eq."x\\"),id.eq.00000000-0000-0000-0000-000000000000"'
    );
    expect(built.startsWith('email.eq."')).toBe(true);
    expect(built.endsWith('"')).toBe(true);
  });

  it("validates, filters, and de-duplicates UUIDs", () => {
    const a = "550e8400-e29b-41d4-a716-446655440000";
    const b = "550E8400-E29B-41D4-A716-446655440001";

    expect(isUuid(a)).toBe(true);
    expect(isUuid(b)).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid(42)).toBe(false);
    expect(isUuid(undefined)).toBe(false);

    expect(filterUuids([a, a, b, "bad", 42, undefined])).toEqual([a, b]);
    expect(filterUuids([])).toEqual([]);
  });
});
