<#
Cleanup script for local development artifacts on Windows.
Run from the repository root in PowerShell:
  ./scripts/cleanup.ps1 -Confirm:$false
This will remove common build/cache folders but will NOT remove tracked source files.
#>
param(
    [switch]$WhatIfMode = $false,
    [switch]$Confirm = $true
)

$targets = @(
    "pup-focus\node_modules",
    "pup-focus\.next",
    "pup-focus\.parcel-cache",
    "pup-focus\.cache",
    "pup-focus\dist",
    "pup-focus\build",
    ".next",
    "node_modules",
    ".cache",
    "dist",
    "build",
    "tmp",
    "temp"
)

Write-Host "Targets to remove:" -ForegroundColor Cyan
$targets | ForEach-Object { Write-Host " - $_" }

if ($Confirm) {
    $answer = Read-Host "Proceed to delete the above folders? (y/N)"
    if ($answer -ne 'y' -and $answer -ne 'Y') { Write-Host 'Aborted.'; exit 0 }
}

foreach ($t in $targets) {
    $full = Join-Path -Path (Get-Location) -ChildPath $t
    if (Test-Path $full) {
        try {
            if ($WhatIfMode) { Write-Host "Would remove: $full" }
            else { Remove-Item -LiteralPath $full -Recurse -Force -ErrorAction Stop; Write-Host "Removed: $full" }
        } catch {
            Write-Warning "Failed to remove $full: $_"
        }
    }
}

Write-Host "Cleanup done." -ForegroundColor Green
