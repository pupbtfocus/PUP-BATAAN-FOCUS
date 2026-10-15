import { z } from "zod";

const nameRegex = /^[a-zA-Z\sñÑ]+$/;

const requiredNameSchema = z
  .string()
  .trim()
  .min(1, "This field is required")
  .max(80, "Use 80 characters or less")
  .regex(nameRegex, "Name can only contain letters (no numbers or special characters)");

const optionalNameSchema = z
  .string()
  .trim()
  .max(80, "Use 80 characters or less")
  .refine((val) => !val || nameRegex.test(val), {
    message: "Name can only contain letters (no numbers or special characters)",
  });

export const facultyAccountSchema = z.object({
  firstName: requiredNameSchema,
  middleName: optionalNameSchema,
  lastName: requiredNameSchema,
  email: z.email("Enter a valid email address"),
  programId: z.string().trim().min(1, "Please select a department or program"),
});

export type FacultyAccountFormInput = z.infer<typeof facultyAccountSchema>;
