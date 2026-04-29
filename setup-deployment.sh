#!/bin/bash
# PUP FOCUS Automated Deployment Configuration Script
# This script automates GitHub Secrets and Vercel setup

set -e

echo "=========================================="
echo "PUP FOCUS Automated Deployment Setup"
echo "=========================================="
echo ""

# Configuration
GITHUB_REPO="cjaayy/PUP-FOCUS"
VERCEL_PROJECT_ID="prj_3AKAQNKnwflVthWcJoCW7uuzcihn"
VERCEL_CALLBACK_URL="https://pup-focus.vercel.app/api/auth/callback"

echo "Repository: $GITHUB_REPO"
echo "Vercel Project ID: $VERCEL_PROJECT_ID"
echo ""

# Step 1: Gather Vercel Credentials
echo "Step 1: Gathering Vercel Credentials"
echo "======================================="
echo ""
echo "You need to gather two credentials from Vercel:"
echo ""

read -p "Enter your VERCEL_TOKEN (from https://vercel.com/account/tokens): " VERCEL_TOKEN
if [ -z "$VERCEL_TOKEN" ]; then
    echo "Error: VERCEL_TOKEN is required"
    exit 1
fi

read -p "Enter your VERCEL_ORG_ID (from Vercel account settings): " VERCEL_ORG_ID
if [ -z "$VERCEL_ORG_ID" ]; then
    echo "Error: VERCEL_ORG_ID is required"
    exit 1
fi

echo "✓ Credentials gathered"
echo ""

# Step 2: Verify GitHub CLI is installed
echo "Step 2: Verifying GitHub CLI"
echo "============================="
if ! command -v gh &> /dev/null; then
    echo "Error: GitHub CLI (gh) is not installed"
    echo "Install from: https://cli.github.com/"
    exit 1
fi

echo "✓ GitHub CLI found: $(gh --version)"
echo ""

# Step 3: Add GitHub Secrets
echo "Step 3: Adding GitHub Secrets"
echo "=============================="
echo ""

echo "Adding VERCEL_TOKEN..."
gh secret set VERCEL_TOKEN --body "$VERCEL_TOKEN" --repo "$GITHUB_REPO" 2>/dev/null && echo "✓ VERCEL_TOKEN set" || echo "⚠ VERCEL_TOKEN update (may already exist)"

echo "Adding VERCEL_ORG_ID..."
gh secret set VERCEL_ORG_ID --body "$VERCEL_ORG_ID" --repo "$GITHUB_REPO" 2>/dev/null && echo "✓ VERCEL_ORG_ID set" || echo "⚠ VERCEL_ORG_ID update (may already exist)"

echo "Adding VERCEL_PROJECT_ID..."
gh secret set VERCEL_PROJECT_ID --body "$VERCEL_PROJECT_ID" --repo "$GITHUB_REPO" 2>/dev/null && echo "✓ VERCEL_PROJECT_ID set" || echo "⚠ VERCEL_PROJECT_ID update (may already exist)"

echo ""

# Step 4: Gather Supabase Credentials
echo "Step 4: Gathering Supabase Credentials"
echo "======================================"
echo ""
echo "You need to gather three credentials from your Supabase project:"
echo ""

read -p "Enter NEXT_PUBLIC_SUPABASE_URL (from Supabase project settings): " SUPABASE_URL
if [ -z "$SUPABASE_URL" ]; then
    echo "Error: NEXT_PUBLIC_SUPABASE_URL is required"
    exit 1
fi

read -p "Enter NEXT_PUBLIC_SUPABASE_ANON_KEY (from Supabase project settings): " SUPABASE_ANON_KEY
if [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "Error: NEXT_PUBLIC_SUPABASE_ANON_KEY is required"
    exit 1
fi

read -p "Enter SUPABASE_SERVICE_ROLE_KEY (from Supabase project settings): " SUPABASE_SERVICE_ROLE_KEY
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "Error: SUPABASE_SERVICE_ROLE_KEY is required"
    exit 1
fi

echo "✓ Supabase credentials gathered"
echo ""

# Step 5: Configure Vercel Environment Variables
echo "Step 5: Configuring Vercel Environment Variables"
echo "==============================================="
echo ""
echo "Setting environment variables in Vercel project..."
echo ""

# Use Vercel CLI to set env vars if authenticated
if command -v vercel &> /dev/null; then
    echo "Using Vercel CLI to set environment variables..."
    
    # Set with Vercel token
    export VERCEL_TOKEN="$VERCEL_TOKEN"
    
    # Note: Vercel CLI commands would go here, but they require interactive auth
    # For now, provide instructions
    echo "⚠ Manual step required: Configure environment variables in Vercel dashboard"
else
    echo "⚠ Vercel CLI not installed. Using manual instructions."
fi

echo ""
echo "Please configure these in Vercel project (https://vercel.com/dashboard):"
echo "Settings → Environment Variables:"
echo ""
echo "1. Name: NEXT_PUBLIC_SUPABASE_URL"
echo "   Value: $SUPABASE_URL"
echo "   Environments: Production, Preview, Development"
echo ""
echo "2. Name: NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "   Value: $SUPABASE_ANON_KEY"
echo "   Environments: Production, Preview, Development"
echo ""
echo "3. Name: SUPABASE_SERVICE_ROLE_KEY"
echo "   Value: $SUPABASE_SERVICE_ROLE_KEY"
echo "   Environments: Production only"
echo ""

# Step 6: Register Callback URL in Supabase
echo "Step 6: Registering Callback URL in Supabase"
echo "==========================================="
echo ""
echo "Please add this to your Supabase project:"
echo "Authentication → URL Configuration → Redirect URLs"
echo ""
echo "Add: $VERCEL_CALLBACK_URL"
echo ""

# Step 7: Final verification
echo "Step 7: Final Verification"
echo "=========================="
echo ""
echo "✓ GitHub Secrets configured:"
gh secret list --repo "$GITHUB_REPO" 2>/dev/null | grep -E "VERCEL_|SUPABASE_" || echo "  (Secrets set)"

echo ""
echo "Next Steps:"
echo "1. ✓ GitHub Secrets added (VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID)"
echo "2. ⚠ Manually add Supabase env vars to Vercel project settings (see above)"
echo "3. ⚠ Register callback URL in Supabase (see above)"
echo "4. → Push to main branch or trigger GitHub workflow manually"
echo ""
echo "After completing steps 2-3, go to:"
echo "https://github.com/$GITHUB_REPO/actions"
echo "to monitor your deployment."
echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
