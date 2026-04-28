"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

type CreateAdminResult = {
  success?: boolean;
  error?: string;
  user?: {
    id: string;
    email: string;
    fullName: string;
  };
};

export function SuperAdminDashboard() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/super-admin/admin/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fullName, email, password }),
      });

      const data = (await response.json()) as CreateAdminResult;

      if (!response.ok) {
        setError(data.error ?? "Failed to create admin account");
        setIsSubmitting(false);
        return;
      }

      setSuccess(`Admin account created for ${data.user?.email ?? email}.`);
      setFullName("");
      setEmail("");
      setPassword("");
      setIsSubmitting(false);
    } catch {
      setError("Unexpected error while creating admin account");
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[rgba(255,215,0,0.18)] bg-[#4d0000]/75 p-6 shadow-lg shadow-black/20 backdrop-blur">
      <h2 className="text-2xl font-semibold text-[#fff8e7]">
        Create Admin Account
      </h2>
      <p className="mt-2 text-sm text-[#f3d9b3]">
        Super Admin can provision Admin users who will manage faculty
        assignments and curriculum compliance operations.
      </p>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div>
          <label
            className="block text-sm font-medium text-[#fff8e7]"
            htmlFor="fullName"
          >
            Full Name
          </label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
            placeholder="Juan Dela Cruz"
            className="mt-2 w-full rounded-xl border border-[rgba(255,215,0,0.18)] bg-[#3b0000] px-4 py-3 text-sm text-[#fff8e7] outline-none ring-[#ffd700]/40 placeholder:text-[#d8b882] focus:ring"
          />
        </div>

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
            placeholder="admin@pup-focus.local"
            className="mt-2 w-full rounded-xl border border-[rgba(255,215,0,0.18)] bg-[#3b0000] px-4 py-3 text-sm text-[#fff8e7] outline-none ring-[#ffd700]/40 placeholder:text-[#d8b882] focus:ring"
          />
        </div>

        <div>
          <label
            className="block text-sm font-medium text-[#fff8e7]"
            htmlFor="password"
          >
            Temporary Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            placeholder="Minimum 8 characters"
            className="mt-2 w-full rounded-xl border border-[rgba(255,215,0,0.18)] bg-[#3b0000] px-4 py-3 text-sm text-[#fff8e7] outline-none ring-[#ffd700]/40 placeholder:text-[#d8b882] focus:ring"
          />
        </div>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {success ? <p className="text-sm text-[#ffd700]">{success}</p> : null}

        <Button className="w-full" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating Admin..." : "Create Admin Account"}
        </Button>
      </form>
    </section>
  );
}
