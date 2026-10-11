# Proposed removals — review before deleting

This file lists files the scanner found as likely unreferenced in `pup-focus/`.
Please review each item before removal; some files may be used dynamically or by tooling.

Scanner: `scripts/find-unreferenced.js`

Likely unreferenced source files:

```
pup-focus\config\app.ts
pup-focus\config\compliance.ts
pup-focus\config\env.ts
pup-focus\config\roles.ts
pup-focus\config\routes.ts
pup-focus\eslint.config.mjs
pup-focus\features\audit-logs\services\audit-log.service.ts
pup-focus\features\compliance-management\services\compliance-engine.service.ts
pup-focus\features\document-review\actions\review-submission.action.ts
pup-focus\features\faculty-management\schemas\faculty-account.schema.ts
pup-focus\features\notifications\services\notification.service.ts
pup-focus\features\submissions\actions\upload-document.action.ts
pup-focus\features\submissions\schemas\document-upload.schema.ts
pup-focus\features\submissions\services\document-version.service.ts
pup-focus\features\submissions\services\submission-window.service.ts
pup-focus\features\submissions\types\submission.types.ts
pup-focus\lib\auth\bootstrap-invited-admin.ts
pup-focus\lib\auth\bootstrap-invited-faculty.ts
pup-focus\lib\auth\permissions.ts
pup-focus\lib\auth\session.ts
pup-focus\lib\email\send-invite.ts
pup-focus\lib\errors\app-error.ts
pup-focus\lib\observability\logger.ts
pup-focus\lib\supabase\client.ts
pup-focus\lib\supabase\middleware.ts
pup-focus\lib\supabase\server.ts
pup-focus\lib\supabase\service-role.ts
pup-focus\lib\validation\email.ts
pup-focus\next.config.ts
pup-focus\postcss.config.mjs
pup-focus\proxy.ts
pup-focus\types\api.ts
pup-focus\types\global.ts
pup-focus\types\pagination.ts
pup-focus\utils\cn.ts
```

Suggested next steps:

- Review the list and reply with files you approve for removal. I will move approved files to `archive/` on a branch so deletion is reversible.
- Or reply `remove all` to move all candidates to `archive/` and make a PR (I will not rewrite history).
- Or request a deeper analysis (I can run a dependency tracer or try a build to check runtime references).

Notes:

- The scanner is conservative but not perfect — it only resolves static relative imports. Dynamic references, tooling-only usage, and files imported via computed paths can be missed.
- Do not merge removal PR without testing the app in staging.
