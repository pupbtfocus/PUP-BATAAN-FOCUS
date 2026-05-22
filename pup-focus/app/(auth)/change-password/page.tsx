"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ROLE, type AppRole } from "@/config/roles";

const ROUTE_BY_ROLE: Record<AppRole, string> = {
  [ROLE.SUPER_ADMIN]: "/super-admin/dashboard",
  [ROLE.ADMIN]: "/admin/dashboard",
  [ROLE.FACULTY]: "/faculty/dashboard",
  [ROLE.PROGRAM_HEAD]: "/program-head/dashboard",
};

export default function ChangePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Password confirmation does not match.");
      return;
    }

    setIsSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { force_password_change: false },
    });

    if (updateError) {
      setError(updateError.message);
      setIsSaving(false);
      return;
    }

    const { data } = await supabase.auth.getUser();
    const signedInRole =
      (data.user?.user_metadata?.role as AppRole | undefined) ??
      (data.user?.app_metadata?.role as AppRole | undefined) ??
      ROLE.ADMIN;

    // After successful password change, go to the role-appropriate dashboard.
    const nextRoute = ROUTE_BY_ROLE[signedInRole];
    setSuccess("Password updated successfully. Redirecting now...");
    setIsSaving(false);
    window.setTimeout(() => {
      window.location.assign(nextRoute);
    }, 2000);
  }

  return (
    <main className="min-h-screen grid place-items-center px-6 text-[#fff8e7]">
      <section className="w-full max-w-md rounded-3xl border border-[rgba(255,215,0,0.18)] bg-[#4d0000]/80 p-8 shadow-2xl shadow-black/20 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.28em] text-[#ffd700]">
          PUP FOCUS
        </p>
        <h1 className="mt-3 text-2xl font-bold">Set a new password</h1>
        <p className="mt-3 text-sm text-[#f3d9b3]">
          Create a new password to secure your account.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="block text-sm font-medium text-[#fff8e7]">
              New password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="mt-2 w-full rounded-xl border border-[rgba(255,215,0,0.18)] bg-transparent px-4 py-3 text-sm text-white outline-none focus:ring"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#fff8e7]">
              Confirm password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              className="mt-2 w-full rounded-xl border border-[rgba(255,215,0,0.18)] bg-transparent px-4 py-3 text-sm text-white outline-none focus:ring"
            />
          </div>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          {success ? (
            <p className="text-sm text-emerald-300">{success}</p>
          ) : null}

          <Button type="submit" className="w-full" disabled={isSaving}>
            {isSaving ? "Saving..." : "Set new password"}
          </Button>
        </form>
      </section>
    </main>
  );
}
