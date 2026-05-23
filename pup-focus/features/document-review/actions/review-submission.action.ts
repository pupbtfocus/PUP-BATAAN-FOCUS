"use server";

import { z } from "zod";
import { logger } from "@/lib/observability/logger";

const reviewSchema = z.object({
  submissionId: z.uuid(),
  decision: z.enum(["approve", "request_revision"]),
  remarks: z.string().max(1000).optional(),
});

export async function reviewSubmissionAction(payload: unknown) {
  const input = reviewSchema.parse(payload);

  logger.info("submission_reviewed", {
    submissionId: input.submissionId,
    decision: input.decision,
  });

  return {
    ok: true,
    data: input,
  };
}
