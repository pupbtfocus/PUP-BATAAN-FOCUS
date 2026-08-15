import { describe, it, expect } from "vitest";
import {
  buildInviteEmailHtml,
  buildTempPasswordEmailHtml,
} from "../../lib/email/send-invite";
import { ROLE } from "../../config/roles";

describe("Email Templates", () => {
  it("buildInviteEmailHtml renders branded invite content with first name only in greeting", () => {
    const html = buildInviteEmailHtml({
      firstName: "Jane",
      fullName: "Jane Doe",
      link: "https://pup-focus.local/accept",
      invitedRole: ROLE.FACULTY,
    });

    expect(html).toMatch(/PUP FOCUS/i);
    expect(html).toMatch(/Welcome to PUP FOCUS/i);
    expect(html).toMatch(/Hello Jane, your faculty account is almost ready\./i);
    expect(html).toMatch(/https:\/\/pup-focus\.local\/accept/i);
    expect(html).toMatch(/Faculty/i);
    expect(html).toMatch(/icons\/pup-seal\.png/i);
  });

  it("buildInviteEmailHtml supports multi-word first name in greeting", () => {
    const html = buildInviteEmailHtml({
      firstName: "Christian Jay",
      fullName: "Christian Jay Cereza",
      link: "https://pup-focus.local/accept",
      invitedRole: ROLE.FACULTY,
    });

    expect(html).toMatch(/Hello Christian Jay, your faculty account is almost ready\./i);
  });

  it("buildInviteEmailHtml falls back to first word of fullName if firstName is omitted", () => {
    const html = buildInviteEmailHtml({
      fullName: "Maria Clara Santos",
      link: "https://pup-focus.local/accept",
      invitedRole: ROLE.FACULTY,
    });

    expect(html).toMatch(/Hello Maria, your faculty account is almost ready\./i);
  });

  it("buildTempPasswordEmailHtml renders the temporary password details with first name greeting", () => {
    const html = buildTempPasswordEmailHtml({
      firstName: "Jane",
      fullName: "Jane Doe",
      tempPassword: "TempPass123!",
    });

    expect(html).toMatch(/PUP FOCUS/i);
    expect(html).toMatch(/Temporary Password/i);
    expect(html).toMatch(/Hello Jane, your account is ready\./i);
    expect(html).toMatch(/TempPass123!/i);
    expect(html).toMatch(/change your password/i);
    expect(html).toMatch(/icons\/pup-seal\.png/i);
    expect(html).toMatch(/Sign in/i);
  });
});
