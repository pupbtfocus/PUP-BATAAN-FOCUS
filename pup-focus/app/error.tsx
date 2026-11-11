"use client";

import { useEffect } from "react";
import { SystemErrorView } from "@/components/errors/system-error-view";

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

  return <SystemErrorView error={error} reset={reset} />;
}
