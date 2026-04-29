# PUP FOCUS Automated Deployment Configuration Script (PowerShell)
# This script automates GitHub Secrets configuration for Vercel deployment

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=========================================="
Write-Host "PUP FOCUS Automated Deployment Setup"
Write-Host "=========================================="
Write-Host ""

# Configuration
$GITHUB_REPO = "cjaayy/PUP-FOCUS"
$VERCEL_PROJECT_ID = "prj_3AKAQNKnwflVthWcJoCW7uuzcihn"
$VERCEL_CALLBACK_URL = "https://pup-focus.vercel.app/api/auth/callback"

Write-Host "Repository: $GITHUB_REPO"
Write-Host "Vercel Project ID: $VERCEL_PROJECT_ID"
Write-Host ""

# Step 1: Gather Vercel Credentials
Write-Host "Step 1: Gathering Vercel Credentials"
Write-Host "======================================="
Write-Host ""
Write-Host "You need to gather two credentials from Vercel:"
Write-Host ""

$VERCEL_TOKEN = Read-Host "Enter your VERCEL_TOKEN (from https://vercel.com/account/tokens)"
if ([string]::IsNullOrWhiteSpace($VERCEL_TOKEN)) {
    Write-Host "Error: VERCEL_TOKEN is required"
    exit 1
}

$VERCEL_ORG_ID = Read-Host "Enter your VERCEL_ORG_ID (from Vercel account settings)"
if ([string]::IsNullOrWhiteSpace($VERCEL_ORG_ID)) {
    Write-Host "Error: VERCEL_ORG_ID is required"
    exit 1
}

Write-Host "✓ Credentials gathered"
Write-Host ""

# Step 2: Verify GitHub CLI is installed
Write-Host "Step 2: Verifying GitHub CLI"
Write-Host "============================="

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "Error: GitHub CLI (gh) is not installed"
    Write-Host "Install from: https://cli.github.com/"
    exit 1
}

$gh_version = gh --version
Write-Host "✓ GitHub CLI found: $gh_version"

Write-Host ""

# Step 3: Add GitHub Secrets
Write-Host "Step 3: Adding GitHub Secrets"
Write-Host "=============================="
Write-Host ""

Write-Host "Adding VERCEL_TOKEN..."
gh secret set VERCEL_TOKEN --body "$VERCEL_TOKEN" --repo "$GITHUB_REPO"
Write-Host "✓ VERCEL_TOKEN set"

Write-Host "Adding VERCEL_ORG_ID..."
gh secret set VERCEL_ORG_ID --body "$VERCEL_ORG_ID" --repo "$GITHUB_REPO"
Write-Host "✓ VERCEL_ORG_ID set"

Write-Host "Adding VERCEL_PROJECT_ID..."
gh secret set VERCEL_PROJECT_ID --body "$VERCEL_PROJECT_ID" --repo "$GITHUB_REPO"
Write-Host "✓ VERCEL_PROJECT_ID set"

Write-Host ""

# Step 4: Gather Supabase Credentials
Write-Host "Step 4: Gathering Supabase Credentials"
Write-Host "========================================"
Write-Host ""
Write-Host "You need to gather three credentials from your Supabase project:"
Write-Host ""

$SUPABASE_URL = Read-Host "Enter NEXT_PUBLIC_SUPABASE_URL (from Supabase project settings)"
if ([string]::IsNullOrWhiteSpace($SUPABASE_URL)) {
    Write-Host "Error: NEXT_PUBLIC_SUPABASE_URL is required"
    exit 1
}

$SUPABASE_ANON_KEY = Read-Host "Enter NEXT_PUBLIC_SUPABASE_ANON_KEY (from Supabase project settings)"
if ([string]::IsNullOrWhiteSpace($SUPABASE_ANON_KEY)) {
    Write-Host "Error: NEXT_PUBLIC_SUPABASE_ANON_KEY is required"
    exit 1
}

$SUPABASE_SERVICE_ROLE_KEY = Read-Host "Enter SUPABASE_SERVICE_ROLE_KEY (from Supabase project settings)"
if ([string]::IsNullOrWhiteSpace($SUPABASE_SERVICE_ROLE_KEY)) {
    Write-Host "Error: SUPABASE_SERVICE_ROLE_KEY is required"
    exit 1
}

Write-Host "✓ Supabase credentials gathered"
Write-Host ""

# Step 5: Display Vercel Configuration Instructions
Write-Host "Step 5: Configuring Vercel Environment Variables"
Write-Host "================================================="
Write-Host ""
Write-Host "Please configure these in Vercel project dashboard:"
Write-Host "https://vercel.com/dashboard/project/pup-focus"
Write-Host ""
Write-Host "Settings > Environment Variables:"
Write-Host ""
Write-Host "1. Name: NEXT_PUBLIC_SUPABASE_URL"
Write-Host "   Value: $SUPABASE_URL"
Write-Host "   Environments: Production, Preview, Development"
Write-Host ""
Write-Host "2. Name: NEXT_PUBLIC_SUPABASE_ANON_KEY"
Write-Host "   Value: $SUPABASE_ANON_KEY"
Write-Host "   Environments: Production, Preview, Development"
Write-Host ""
Write-Host "3. Name: SUPABASE_SERVICE_ROLE_KEY"
Write-Host "   Value: $SUPABASE_SERVICE_ROLE_KEY"
Write-Host "   Environments: Production only"
Write-Host ""

# Step 6: Register Callback URL in Supabase
Write-Host "Step 6: Registering Callback URL in Supabase"
Write-Host "==========================================="
Write-Host ""
Write-Host "Please add this to your Supabase project:"
Write-Host "Authentication > URL Configuration > Redirect URLs"
Write-Host ""
Write-Host "Add: $VERCEL_CALLBACK_URL"
Write-Host ""

# Step 7: Final verification
Write-Host "Step 7: Final Verification"
Write-Host "=========================="
Write-Host ""
Write-Host "✓ GitHub Secrets configured:"
gh secret list --repo "$GITHUB_REPO" | Select-String "VERCEL_"

Write-Host ""
Write-Host "Next Steps:"
Write-Host "1. ✓ GitHub Secrets added (VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID)"
Write-Host "2. ⚠ Manually add Supabase env vars to Vercel project settings (see above)"
Write-Host "3. ⚠ Register callback URL in Supabase (see above)"
Write-Host "4. → Push to main branch or trigger GitHub workflow manually"
Write-Host ""
Write-Host "After completing steps 2-3, go to:"
Write-Host "https://github.com/$GITHUB_REPO/actions"
Write-Host "to monitor your deployment."
Write-Host ""
Write-Host "=========================================="
Write-Host "Setup Complete!"
Write-Host "=========================================="
Write-Host ""

Read-Host "Press Enter to exit"
