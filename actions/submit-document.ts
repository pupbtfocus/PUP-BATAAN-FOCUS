'use server';

import { withAuth, createClient } from '@/lib/auth/with-auth';
import { verifyTurnstileToken } from '@/actions/verify-turnstile';
import {
  documentSubmissionSchema,
  DocumentSubmissionInput,
} from '@/lib/validations/document-submission';

export const submitDocumentAction = withAuth<
  DocumentSubmissionInput,
  { submissionId: string }
>(
  ['user', 'staff', 'admin', 'super-admin'],
  async (rawInput, { user }) => {
    const parsed = documentSubmissionSchema.safeParse(rawInput);

    if (!parsed.success) {
      const errorMessage =
        parsed.error.issues[0]?.message || 'Invalid submission data.';
      throw new Error(errorMessage);
    }

    const { document_title, document_type, file_path, turnstile_token } =
      parsed.data;

    const turnstileResult = await verifyTurnstileToken(turnstile_token);
    if (!turnstileResult.success) {
      throw new Error(turnstileResult.error);
    }

    if (!file_path.startsWith(`${user.id}/`)) {
      throw new Error('Forbidden: Invalid storage path for current user.');
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('document_submissions')
      .insert({
        user_id: user.id,
        document_title,
        document_type,
        file_path,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Failed to save document submission.');
    }

    return { submissionId: data.id };
  }
);

