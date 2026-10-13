import React from "react";
import { SessionTimeoutProvider } from "@/components/auth/session-timeout-provider";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionTimeoutProvider>{children}</SessionTimeoutProvider>;
}
