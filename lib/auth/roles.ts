export type UserRole = 'super-admin' | 'admin' | 'staff' | 'user';

export interface ActionContext {
  user: {
    id: string;
    email?: string;
    role: UserRole;
  };
}

export type ActionResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

