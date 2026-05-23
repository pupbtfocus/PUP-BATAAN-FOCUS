import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ROLE, type AppRole } from "@/config/roles";
import type { AuthUser } from "@/types/global";

export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const role = (user.user_metadata.role as AppRole | undefined) ?? ROLE.FACULTY;

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: (user.user_metadata.full_name as string | undefined) ?? "Unnamed",
    role,
  };
});
