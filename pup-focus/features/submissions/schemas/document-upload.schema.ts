import { z } from "zod";
import { DEFAULT_REQUIREMENTS } from "@/config/compliance";

export const documentUploadSchema = z.object({
  submissionId: z.uuid(),
  requirementCode: z.enum(DEFAULT_REQUIREMENTS),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(3),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(25 * 1024 * 1024),
  checksumSha256: z.string().length(64),
});

export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;
