import { describe, it, expect } from "vitest";
import {
  buildInviteEmailHtml,
  buildTempPasswordEmailHtml,
  buildForgotPasswordEmailHtml,
  buildSubmissionWindowNotificationEmailHtml,
} from "../../lib/email/send-invite";
import { ROLE } from "../../config/roles";

describe("Email Templates", () => {
  it("buildInviteEmailHtml renders branded invite content with single PUP logo and first name greeting", () => {
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
    expect((html.match(/pup-seal\.png/g) || []).length).toBe(1);
    expect(html).toMatch(/Accept Invitation &amp; Sign In/i);
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

  it("buildTempPasswordEmailHtml renders temporary credentials with email, password, single PUP logo, and first name greeting", () => {
    const html = buildTempPasswordEmailHtml({
      firstName: "Jane",
      fullName: "Jane Doe",
      email: "jane.doe@pup.edu.ph",
      tempPassword: "TempPass123!",
    });

    expect(html).toMatch(/PUP FOCUS/i);
    expect(html).toMatch(/Temporary Credentials/i);
    expect(html).toMatch(/Temporary Password/i);
    expect(html).toMatch(/Hello Jane, your account is ready\./i);
    expect(html).toMatch(/jane\.doe@pup\.edu\.ph/i);
    expect(html).toMatch(/TempPass123!/i);
    expect(html).toMatch(/change your password/i);
    expect(html).toMatch(/icons\/pup-seal\.png/i);
    expect((html.match(/pup-seal\.png/g) || []).length).toBe(1);
    expect(html).toMatch(/Sign in to PUP FOCUS/i);
    expect(html).toMatch(/Copy Email/i);
    expect(html).toMatch(/Copy Password/i);
    expect(html).toMatch(/Copy Both/i);
  });

  it("buildForgotPasswordEmailHtml renders password reset content with single PUP logo and first name greeting", () => {
    const html = buildForgotPasswordEmailHtml({
      firstName: "Jane",
      fullName: "Jane Doe",
      email: "jane.doe@pup.edu.ph",
      resetLink: "https://pup-focus.local/auth/change-password?token=xyz123",
    });

    expect(html).toMatch(/Reset Your Password/i);
    expect(html).toMatch(/Hello Jane, we received a request to reset your PUP FOCUS password\./i);
    expect(html).toMatch(/jane\.doe@pup\.edu\.ph/i);
    expect(html).toMatch(/https:\/\/pup-focus\.local\/auth\/change-password\?token=xyz123/i);
    expect(html).toMatch(/Reset Password/i);
    expect(html).toMatch(/icons\/pup-seal\.png/i);
    expect((html.match(/pup-seal\.png/g) || []).length).toBe(1);
  });

  it("buildSubmissionWindowNotificationEmailHtml renders first name greeting and single PUP logo", () => {
    const html = buildSubmissionWindowNotificationEmailHtml({
      fullName: "Jane Doe",
      firstName: "Jane",
      startDate: "October 1, 2026",
      endDate: "October 15, 2026",
      startTimeLabel: "8:00 AM",
      endTimeLabel: "11:59 PM",
      actionHref: "https://pup-focus.local/dashboard",
    });

    expect(html).toMatch(/Hello Jane, the faculty submission window has been scheduled\./i);
    expect(html).toMatch(/icons\/pup-seal\.png/i);
    expect((html.match(/pup-seal\.png/g) || []).length).toBe(1);
    expect(html).toMatch(/Open Faculty Dashboard/i);
  });

  it("parseCombinedCredentials parses combined temporary credentials clipboard output", async () => {
    const { parseCombinedCredentials } = await import("../../components/auth/login-form");

    // Standard Copy Both format from buildTempPasswordEmailHtml
    const tempPassFormat = "Institutional Email: faculty@pup.edu.ph\nTemporary Password: TempPass123!";
    expect(parseCombinedCredentials(tempPassFormat)).toEqual({
      email: "faculty@pup.edu.ph",
      password: "TempPass123!",
    });

    // Copy Both format from buildEmailUpdateTempPasswordEmailHtml
    const updatePassFormat = "Email: updated@pup.edu.ph\nTemporary Password: NewTempPass456#";
    expect(parseCombinedCredentials(updatePassFormat)).toEqual({
      email: "updated@pup.edu.ph",
      password: "NewTempPass456#",
    });

    // Raw 2-line paste
    const rawTwoLines = "preview@pupfocus.dev\nPupFocus_TempPass_9823#";
    expect(parseCombinedCredentials(rawTwoLines)).toEqual({
      email: "preview@pupfocus.dev",
      password: "PupFocus_TempPass_9823#",
    });

    // Delimited single line
    const delimited = "faculty@pup.edu.ph:MyPassword99#";
    expect(parseCombinedCredentials(delimited)).toEqual({
      email: "faculty@pup.edu.ph",
      password: "MyPassword99#",
    });

    // Single-line bullet format (from footer or single-line copy)
    const bulletFormat = "Temporary Password: TempPass123! • Account: faculty@pup.edu.ph";
    expect(parseCombinedCredentials(bulletFormat)).toEqual({
      email: "faculty@pup.edu.ph",
      password: "TempPass123!",
    });

    // Multiline email table copy format
    const tableCopyFormat = "Temporary Credentials\nInstitutional Email\nfaculty@pup.edu.ph\nCopy Email\nTemporary Password\nTempPass123!\nCopy Password\nCopy Both";
    expect(parseCombinedCredentials(tableCopyFormat)).toEqual({
      email: "faculty@pup.edu.ph",
      password: "TempPass123!",
    });

    // HTML entities decoding format
    const entityFormat = "Institutional Email: faculty@pup.edu.ph\nTemporary Password: Pass&amp;123&#39;!";
    expect(parseCombinedCredentials(entityFormat)).toEqual({
      email: "faculty@pup.edu.ph",
      password: "Pass&123'!",
    });

    // Empty string or invalid
    expect(parseCombinedCredentials("")).toBeNull();
  });
});

