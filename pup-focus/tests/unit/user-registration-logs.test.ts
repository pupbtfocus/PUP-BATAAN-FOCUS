import { describe, it, expect } from "vitest";

interface MockAuthUser {
  id: string;
  email: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
  last_sign_in_at?: string | null;
  invited_at?: string | null;
  created_at: string;
}

function resolveRegistrationStatus(user: MockAuthUser, profileStatus?: string | null): "Accepted" | "Pending" {
  const isAccepted = Boolean(
    user.email_confirmed_at ||
    user.confirmed_at ||
    user.last_sign_in_at ||
    profileStatus === "active"
  );
  return isAccepted ? "Accepted" : "Pending";
}

function resolveUserRole(user: MockAuthUser, profileRole?: string | null): "Faculty" | "Admin" | "Super Admin" {
  const rawRole = (
    user.user_metadata?.role ||
    user.app_metadata?.role ||
    profileRole ||
    ""
  ).toLowerCase();

  if (rawRole.includes("super")) return "Super Admin";
  if (rawRole.includes("admin")) return "Admin";
  return "Faculty";
}

function canCancelInvite(user: MockAuthUser): boolean {
  const isAccepted = Boolean(
    user.email_confirmed_at ||
    user.confirmed_at ||
    user.last_sign_in_at
  );
  return !isAccepted;
}

function shouldExcludeFromActiveDirectory(user: MockAuthUser): boolean {
  const isPendingInvite =
    !user.email_confirmed_at && !user.confirmed_at && !user.last_sign_in_at;
  return isPendingInvite;
}

describe("User Registration Logs Logic", () => {
  it("marks a user as Pending when email is not confirmed and has not logged in", () => {
    const pendingUser: MockAuthUser = {
      id: "u-1",
      email: "pending.faculty@pupfocus.dev",
      created_at: "2026-09-27T10:00:00Z",
      invited_at: "2026-09-27T10:00:00Z",
      email_confirmed_at: null,
      confirmed_at: null,
      last_sign_in_at: null,
    };

    expect(resolveRegistrationStatus(pendingUser)).toBe("Pending");
    expect(canCancelInvite(pendingUser)).toBe(true);
    expect(shouldExcludeFromActiveDirectory(pendingUser)).toBe(true);
  });

  it("marks a user as Accepted when email_confirmed_at is present", () => {
    const acceptedUser: MockAuthUser = {
      id: "u-2",
      email: "confirmed.faculty@pupfocus.dev",
      created_at: "2026-09-27T10:00:00Z",
      invited_at: "2026-09-27T10:00:00Z",
      email_confirmed_at: "2026-09-27T11:00:00Z",
    };

    expect(resolveRegistrationStatus(acceptedUser)).toBe("Accepted");
    expect(canCancelInvite(acceptedUser)).toBe(false);
    expect(shouldExcludeFromActiveDirectory(acceptedUser)).toBe(false);
  });

  it("marks a user as Accepted when last_sign_in_at is present even if email_confirmed_at is null", () => {
    const loggedInUser: MockAuthUser = {
      id: "u-3",
      email: "active.admin@pupfocus.dev",
      created_at: "2026-09-27T10:00:00Z",
      last_sign_in_at: "2026-09-27T12:00:00Z",
    };

    expect(resolveRegistrationStatus(loggedInUser)).toBe("Accepted");
    expect(canCancelInvite(loggedInUser)).toBe(false);
    expect(shouldExcludeFromActiveDirectory(loggedInUser)).toBe(false);
  });

  it("correctly identifies Faculty, Admin, and Super Admin roles", () => {
    const facultyUser: MockAuthUser = {
      id: "u-4",
      email: "fac@pupfocus.dev",
      created_at: "2026-09-27T10:00:00Z",
      user_metadata: { role: "faculty" },
    };
    const adminUser: MockAuthUser = {
      id: "u-5",
      email: "adm@pupfocus.dev",
      created_at: "2026-09-27T10:00:00Z",
      user_metadata: { role: "admin" },
    };
    const superAdminUser: MockAuthUser = {
      id: "u-6",
      email: "super@pupfocus.dev",
      created_at: "2026-09-27T10:00:00Z",
      user_metadata: { role: "super_admin" },
    };

    expect(resolveUserRole(facultyUser)).toBe("Faculty");
    expect(resolveUserRole(adminUser)).toBe("Admin");
    expect(resolveUserRole(superAdminUser)).toBe("Super Admin");
  });
});
