import { describe, it, expect } from "vitest";
import {
  buildInviteEmailHtml,
  buildTempPasswordEmailHtml,
  buildForgotPasswordEmailHtml,
  buildSubmissionWindowNotificationEmailHtml,
} from "../../lib/email/send-invite";
import { ROLE } from "../../config/roles";

describe("Email Templates", () => {
  it("buildInviteEmailHtml renders branded invite content with dual logos and first name greeting", () => {
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

  it("buildTempPasswordEmailHtml renders temporary credentials with email, password, dual logos, and first name greeting", () => {
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
    expect(html).toMatch(/Sign in to PUP FOCUS/i);
  });

  it("buildForgotPasswordEmailHtml renders password reset content with dual logos and first name greeting", () => {
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
  });

  it("buildSubmissionWindowNotificationEmailHtml renders first name greeting and dual logos", () => {
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
    expect(html).toMatch(/Open Faculty Dashboard/i);
  });
});

