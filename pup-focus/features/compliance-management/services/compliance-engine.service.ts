import {
  DEFAULT_REQUIREMENTS,
  type RequirementCode,
} from "@/config/compliance";
import type { RequirementStatus } from "@/features/submissions/types/submission.types";

export type RequirementState = {
  requirementCode: RequirementCode;
  status: RequirementStatus;
};

export function calculateComplianceProgress(requirements: RequirementState[]) {
  const total = DEFAULT_REQUIREMENTS.length;
  const compliantCount = requirements.filter(
    (item) => item.status === "compliant",
  ).length;

  return {
    total,
    compliantCount,
    percentage: total === 0 ? 0 : Math.round((compliantCount / total) * 100),
  };
}
