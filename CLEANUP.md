## Repository cleanup guide

What this repo-level cleanup includes:

- Adds a root `.gitignore` and updates `pup-focus/.gitignore` to ignore common Node/Next build artifacts and caches.
- Provides `scripts/cleanup.ps1` to remove local build artifacts and caches on Windows.

How to use the cleanup script (Windows PowerShell):

```powershell
# preview (no deletion)
./scripts/cleanup.ps1 -WhatIfMode

# run with confirmation prompt
./scripts/cleanup.ps1

# run without prompt
./scripts/cleanup.ps1 -Confirm:$false
```

Notes and recommendations:

- The script only removes untracked build/cache directories and will not delete tracked source files.
- I pushed these changes to branch `cleanup/gitignore-ignores`. Create a PR from that branch to `main` to share with collaborators.
- If you want, I can run a static analysis to propose specific source-file removals (unused files or exports). Reply "run analysis" to proceed.

Environment variables
- Copy `pup-focus/.env.local.example` to `pup-focus/.env.local` and fill in your Supabase values for local development.
- Do NOT commit `.env.local`. Production secrets (like `SUPABASE_SERVICE_ROLE_KEY`) should be set in your hosting provider's environment settings (Vercel, etc.).
