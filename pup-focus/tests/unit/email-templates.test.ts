import { describe, it, expect } from "vitest";
import {
  buildInviteEmailHtml,
  buildTempPasswordEmailHtml,
} from "../../lib/email/send-invite";
import { ROLE } from "../../config/roles";

describe("Email Templates", () => {
  it("buildInviteEmailHtml renders branded invite content", () => {
    const html = buildInviteEmailHtml({
      fullName: "Jane Doe",
      link: "https://pup-focus.local/accept",
      invitedRole: ROLE.FACULTY,
    });

    expect(html).toMatch(/PUP FOCUS/i);
    expect(html).toMatch(/Welcome to PUP FOCUS/i);
    expect(html).toMatch(/Jane Doe/i);
    expect(html).toMatch(/https:\/\/pup-focus\.local\/accept/i);
    expect(html).toMatch(/Faculty/i);
    expect(html).toMatch(/icons\/pup-seal\.png/i);
  });

  it("buildTempPasswordEmailHtml renders the temporary password details", () => {
    const html = buildTempPasswordEmailHtml({
      fullName: "Jane Doe",
      tempPassword: "TempPass123!",
    });

    expect(html).toMatch(/PUP FOCUS/i);
    expect(html).toMatch(/Temporary Password/i);
    expect(html).toMatch(/Jane Doe/i);
    expect(html).toMatch(/TempPass123!/i);
    expect(html).toMatch(/change your password/i);
    expect(html).toMatch(/icons\/pup-seal\.png/i);
    expect(html).toMatch(/Sign in/i);
  });
});
