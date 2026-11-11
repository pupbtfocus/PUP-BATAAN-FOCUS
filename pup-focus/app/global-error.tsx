"use client";

import { useEffect } from "react";
import { SystemErrorView } from "@/components/errors/system-error-view";

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
      <body className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <SystemErrorView error={error} reset={reset} />
      </body>
    </html>
  );
}

