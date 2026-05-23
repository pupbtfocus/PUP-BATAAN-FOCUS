import { getPublicEnvSafe } from "@/config/env";

const publicEnv = getPublicEnvSafe();

export const APP_CONFIG = {
  name: "PUP FOCUS",
  shortName: "FOCUS",
  organization: "Polytechnic University of the Philippines - Bataan Campus",
  timezone: "Asia/Manila",
  superAdminEmail: publicEnv?.NEXT_PUBLIC_SUPER_ADMIN_EMAIL ?? "",
} as const;
