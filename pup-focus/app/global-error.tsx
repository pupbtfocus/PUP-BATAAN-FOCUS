"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[PUP FOCUS GlobalError]", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 text-center text-slate-900">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Something went wrong
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            An unexpected application error occurred. Please try again.
          </p>
          {error.digest ? (
            <p className="mt-1 font-mono text-xs text-slate-400">
              Error ID: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => reset()}
            className="mt-4 rounded-lg bg-[#800000] px-4 py-2 text-sm font-semibold text-white hover:bg-[#660000]"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

