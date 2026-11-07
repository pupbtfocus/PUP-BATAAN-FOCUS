'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { ActionContext, ActionResponse, UserRole } from './roles';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignored when called from a Server Component
          }
        },
      },
    }
  );
}

export function withAuth<TInput, TOutput>(
  allowedRoles: UserRole[],
  handler: (input: TInput, context: ActionContext) => Promise<TOutput>
) {
  return async (input: TInput): Promise<ActionResponse<TOutput>> => {
    try {
      const supabase = await createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return { success: false, error: 'Unauthorized: Authentication required.' };
      }

      const role = (user.app_metadata?.role ||
        user.user_metadata?.role ||
        'user') as UserRole;

      if (!allowedRoles.includes(role)) {
        return {
          success: false,
          error: 'Forbidden: Insufficient permissions.',
        };
      }

      const data = await handler(input, {
        user: {
          id: user.id,
          email: user.email,
          role,
        },
      });

      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred.',
      };
    }
  };
}

