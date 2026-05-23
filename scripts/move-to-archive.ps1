$files = @(
    'pup-focus\\config\\app.ts',
    'pup-focus\\config\\compliance.ts',
    'pup-focus\\config\\env.ts',
    'pup-focus\\config\\roles.ts',
    'pup-focus\\config\\routes.ts',
    'pup-focus\\eslint.config.mjs',
    'pup-focus\\features\\audit-logs\\services\\audit-log.service.ts',
    'pup-focus\\features\\compliance-management\\services\\compliance-engine.service.ts',
    'pup-focus\\features\\document-review\\actions\\review-submission.action.ts',
    'pup-focus\\features\\faculty-management\\schemas\\faculty-account.schema.ts',
    'pup-focus\\features\\notifications\\services\\notification.service.ts',
    'pup-focus\\features\\submissions\\actions\\upload-document.action.ts',
    'pup-focus\\features\\submissions\\schemas\\document-upload.schema.ts',
    'pup-focus\\features\\submissions\\services\\document-version.service.ts',
    'pup-focus\\features\\submissions\\services\\submission-window.service.ts',
    'pup-focus\\features\\submissions\\types\\submission.types.ts',
    'pup-focus\\lib\\auth\\bootstrap-invited-admin.ts',
    'pup-focus\\lib\\auth\\bootstrap-invited-faculty.ts',
    'pup-focus\\lib\\auth\\permissions.ts',
    'pup-focus\\lib\\auth\\session.ts',
    'pup-focus\\lib\\email\\send-invite.ts',
    'pup-focus\\lib\\errors\\app-error.ts',
    'pup-focus\\lib\\observability\\logger.ts',
    'pup-focus\\lib\\supabase\\client.ts',
    'pup-focus\\lib\\supabase\\middleware.ts',
    'pup-focus\\lib\\supabase\\server.ts',
    'pup-focus\\lib\\supabase\\service-role.ts',
    'pup-focus\\lib\\validation\\email.ts',
    'pup-focus\\next.config.ts',
    'pup-focus\\postcss.config.mjs',
    'pup-focus\\proxy.ts',
    'pup-focus\\types\\api.ts',
    'pup-focus\\types\\global.ts',
    'pup-focus\\types\\pagination.ts',
    'pup-focus\\utils\\cn.ts'
)

Set-Location -Path (Split-Path -Parent $MyInvocation.MyCommand.Definition)
Set-Location ..

git checkout -b cleanup/archive-proposed

foreach ($f in $files) {
    if (Test-Path $f) {
        $dir = Split-Path $f -Parent
        $archiveDir = Join-Path 'archive' $dir
        if (-not (Test-Path $archiveDir)) { New-Item -ItemType Directory -Force -Path $archiveDir | Out-Null }
        git mv $f (Join-Path $archiveDir (Split-Path $f -Leaf))
        Write-Host "Moved $f -> $archiveDir"
    } else {
        Write-Host "Not found: $f"
    }
}

git add -A
git commit -m 'chore: move proposed unreferenced files to archive for review' -q
git push -u origin HEAD
Write-Host 'Branch pushed: cleanup/archive-proposed'
