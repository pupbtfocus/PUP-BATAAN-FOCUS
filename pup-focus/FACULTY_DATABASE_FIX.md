# Faculty Database Persistence - Fixing RLS Issue

<!-- spellcheck: off -->

## Problem

Faculty accounts are not being saved to the database. This is due to Row Level Security (RLS) being enabled on the `profiles` table without any RLS policies defined.

## Solution

Run the following migration in your Supabase SQL Editor to disable RLS on the necessary tables:

### Step 1: Open Supabase SQL Editor

1. Go to https://supabase.com and log in
2. Select your PUP FOCUS project (vivhzxlyipalvzqqiibn)
3. Click on "SQL Editor" in the left sidebar

### Step 2: Run the Migration

Copy and paste the following SQL into the SQL Editor and execute it:

```sql
-- Disable RLS on core tables for faculty management
-- This allows the service role client to create and manage faculty accounts
alter table public.profiles disable row level security;
alter table public.user_roles disable row level security;
alter table public.faculty_program_assignments disable row level security;
```

### Step 3: Verify

After running the SQL, you should see a success message. You can verify by running:

```sql
-- Check RLS status
SELECT schemaname, tablename, rowsecurity FROM pg_tables
WHERE tablename IN ('profiles', 'user_roles', 'faculty_program_assignments');
```

### Step 4: Test

1. Go back to your PUP FOCUS application at http://localhost:3000
2. Log in as admin
3. Try creating a new faculty account
4. The faculty should now appear in the dashboard and be saved to the database

## Why This Was Happening

- RLS was enabled on the `profiles` table to restrict access
- However, no RLS policies were defined to allow specific operations
- Without policies, no one (except superusers) could insert/update/delete records
- The service role client, while powerful, needs explicit policies or disabled RLS to operate

## Next Steps

Once you have working faculty management, consider:

1. Implementing proper RLS policies instead of disabling RLS completely
2. Creating policies that allow admins to create faculty accounts
3. Re-enabling RLS on all tables with proper access control

## Migration File

The migration has been created at:
`infrastructure/database/migrations/0002_disable_rls_for_faculty_mgmt.sql`

You can reference this for manual SQL execution if needed.
