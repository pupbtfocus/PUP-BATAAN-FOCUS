import { z } from "zod";

const requiredNameSchema = z
  .string()
  .trim()
  .min(1, "This field is required")
  .max(80, "Use 80 characters or less");

const optionalNameSchema = z
  .string()
  .trim()
  .max(80, "Use 80 characters or less");

export const facultyAccountSchema = z.object({
  firstName: requiredNameSchema,
  middleName: optionalNameSchema,
  lastName: requiredNameSchema,
  email: z.email("Enter a valid email address"),
  programId: z.string().trim().min(1, "Please select a department or program"),
});

export type FacultyAccountFormInput = z.infer<typeof facultyAccountSchema>;
