import { z } from "zod";

export const facultyAccountSchema = z.object({
  fullName: z.string().trim().min(3, "Full name must be at least 3 characters"),
  email: z.email("Enter a valid email address"),
});

export type FacultyAccountFormInput = z.infer<typeof facultyAccountSchema>;
