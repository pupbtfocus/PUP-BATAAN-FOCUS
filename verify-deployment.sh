#!/bin/bash
# PUP FOCUS Deployment Verification Script
# Run this after all credentials are configured to verify the deployment setup

echo "=========================================="
echo "PUP FOCUS Deployment Verification"
echo "=========================================="
echo ""

# Check 1: Verify Node.js version
echo "✓ Checking Node.js version..."
node --version
echo ""

# Check 2: Verify npm packages are installed
echo "✓ Checking npm packages in pup-focus..."
if [ -d "./pup-focus/node_modules" ]; then
    echo "  ✓ node_modules found"
else
    echo "  ⚠ node_modules not found. Run: cd pup-focus && npm ci"
fi
echo ""

# Check 3: Verify build configuration
echo "✓ Checking Next.js configuration..."
if [ -f "./pup-focus/next.config.ts" ]; then
    echo "  ✓ next.config.ts exists"
else
    echo "  ✗ next.config.ts not found"
fi
echo ""

# Check 4: Verify GitHub Actions workflows
echo "✓ Checking GitHub Actions workflows..."
if [ -f "./.github/workflows/deploy.yml" ]; then
    echo "  ✓ deploy.yml exists"
else
    echo "  ✗ deploy.yml not found"
fi

if [ -f "./.github/workflows/preview.yml" ]; then
    echo "  ✓ preview.yml exists"
else
    echo "  ✗ preview.yml not found"
fi
echo ""

# Check 5: Verify Vercel project.json (created after npx vercel link)
echo "✓ Checking Vercel configuration..."
if [ -f "./.vercel/project.json" ]; then
    echo "  ✓ .vercel/project.json exists"
    cat ./.vercel/project.json | jq '.'
else
    echo "  ⚠ .vercel/project.json not found (run: npx vercel link)"
fi
echo ""

# Check 6: Test local build
echo "✓ Testing local build..."
cd ./pup-focus
npm run build 2>&1 | tail -5
cd ..
echo ""

echo "=========================================="
echo "Verification Complete!"
echo "=========================================="
echo ""
echo "Next Steps:"
echo "1. Ensure VERCEL_TOKEN is set in GitHub Secrets"
echo "2. Ensure VERCEL_ORG_ID is set in GitHub Secrets"
echo "3. Ensure VERCEL_PROJECT_ID is set in GitHub Secrets"
echo "4. Add Supabase env vars to Vercel project settings"
echo "5. Push to main branch or trigger workflow manually"
echo ""
