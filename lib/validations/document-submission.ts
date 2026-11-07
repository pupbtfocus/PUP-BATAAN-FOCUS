import { z } from 'zod';

export const DOCUMENT_TYPES = [
  'syllabus',
  'grade-sheet',
  'accomplishment-report',
  'ipcr',
] as const;

export const documentSubmissionSchema = z
  .object({
    document_title: z
      .string()
      .min(5, 'Document title must be at least 5 characters.')
      .max(150, 'Document title must not exceed 150 characters.')
      .regex(
        /^[\w\s\-.,()]+$/,
        'Document title contains invalid characters.'
      ),
    document_type: z.enum(DOCUMENT_TYPES),
    file_path: z
      .string()
      .min(1, 'File path is required.')
      .refine(
        (val) => !val.includes('..') && !val.startsWith('/'),
        'Invalid file path.'
      ),
    turnstile_token: z.string().min(1, 'Turnstile token is required.'),
  })
  .strict();

export type DocumentSubmissionInput = z.infer<typeof documentSubmissionSchema>;

