"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <h2 className="text-2xl font-bold text-slate-800">Something went wrong!</h2>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-4 rounded-lg bg-[#800000] px-4 py-2 text-sm font-semibold text-white hover:bg-[#660000]"
      >
        Try again
      </button>
    </div>
  );
}
