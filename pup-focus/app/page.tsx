"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/shared/brand-mark";
import { createClient } from "@/lib/supabase/client";
import { ROUTE_BY_ROLE } from "@/config/routes";
import { ROLE, type AppRole } from "@/config/roles";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setIsSubmitting(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const signedInRole =
      (userData.user?.user_metadata?.role as AppRole | undefined) ??
      (userData.user?.app_metadata?.role as AppRole | undefined) ??
      ROLE.FACULTY;
    const nextTarget = ROUTE_BY_ROLE[signedInRole];

    setSuccess(
      `Signed in successfully as ${signedInRole === ROLE.ADMIN ? "Admin" : "Faculty"}.`,
    );
    setIsSubmitting(false);
    window.location.assign(nextTarget);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-10 text-[#fff8e7]">
      <div className="w-full max-w-md">
        {/* Combined Card */}
        <section className="rounded-3xl border border-[rgba(255,215,0,0.18)] bg-[#4d0000]/80 p-8 shadow-2xl shadow-black/20 backdrop-blur">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="flex justify-center">
              <BrandMark
                size={56}
                className="rounded-full ring-4 ring-[#ffd700]/35 shadow-lg shadow-black/20"
              />
            </div>
            <p className="mt-4 text-sm uppercase tracking-[0.28em] text-[#ffd700]">
              Polytechnic University of the Philippines - Bataan Campus
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              PUP FOCUS
            </h1>
          </div>

          {/* Sign In Form */}
          <h2 className="text-xl font-semibold">Sign In</h2>
          <p className="mt-1 text-sm text-[#f3d9b3]">
            Enter your institutional email and password to sign in.
          </p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label
                className="block text-sm font-medium text-[#fff8e7]"
                htmlFor="email"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                placeholder="faculty@pup.edu.ph"
                className="mt-2 w-full rounded-xl border border-[rgba(255,215,0,0.18)] bg-[#3b0000] px-4 py-3 text-sm outline-none ring-[#ffd700]/40 placeholder:text-[#d8b882] focus:ring"
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-[#fff8e7]"
                htmlFor="password"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                placeholder="Your password"
                className="mt-2 w-full rounded-xl border border-[rgba(255,215,0,0.18)] bg-[#3b0000] px-4 py-3 text-sm outline-none ring-[#ffd700]/40 placeholder:text-[#d8b882] focus:ring"
              />
            </div>

            {error ? <p className="text-sm text-red-300">{error}</p> : null}
            {success ? (
              <p className="text-sm text-[#ffd700]">{success}</p>
            ) : null}

            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Continue"}
            </Button>

            <p className="text-xs text-[#f3d9b3]">
              Enter your credentials to access the system. Your role will be
              determined by your account permissions.
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}
