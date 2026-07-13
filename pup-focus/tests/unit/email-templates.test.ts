import test from "node:test";
import assert from "node:assert/strict";
import {
  buildInviteEmailHtml,
  buildTempPasswordEmailHtml,
} from "../../lib/email/send-invite";
import { ROLE } from "../../config/roles";

test("buildInviteEmailHtml renders branded invite content", () => {
  const html = buildInviteEmailHtml({
    fullName: "Jane Doe",
    link: "https://pup-focus.local/accept",
    invitedRole: ROLE.FACULTY,
  });

  assert.match(html, /PUP FOCUS/i);
  assert.match(html, /Welcome to PUP FOCUS/i);
  assert.match(html, /Jane Doe/i);
  assert.match(html, /https:\/\/pup-focus\.local\/accept/i);
  assert.match(html, /Faculty/i);
  assert.match(html, /icons\/pup-seal\.png/i);
});

test("buildTempPasswordEmailHtml renders the temporary password details", () => {
  const html = buildTempPasswordEmailHtml({
    fullName: "Jane Doe",
    tempPassword: "TempPass123!",
  });

  assert.match(html, /PUP FOCUS/i);
  assert.match(html, /Temporary Password/i);
  assert.match(html, /Jane Doe/i);
  assert.match(html, /TempPass123!/i);
  assert.match(html, /change your password/i);
  assert.match(html, /icons\/pup-seal\.png/i);
  assert.match(html, /Sign in/i);
});
