"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const TABLES = [
  "submissions",
  "submission_windows",
  "submission_window_terms",
  "extension_requests",
  "review_decisions",
  "requirement_templates",
  "academic_terms",
  "faculty_program_assignments",
  "profiles",
  "notifications",
  "audit_logs",
];

export const REALTIME_EVENT = "pupfocus:realtime-change";

export function RealtimeRefresher() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const onChange = (table: string) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent(REALTIME_EVENT, { detail: { table } }),
        );
        router.refresh();
      }, 400);
    };

    let channel = supabase.channel("pupfocus-realtime");
    for (const table of TABLES) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => onChange(table),
      );
    }
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
