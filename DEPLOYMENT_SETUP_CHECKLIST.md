# PUP FOCUS Vercel Deployment Setup Checklist

## Overview
This checklist guides you through the final steps to deploy the PUP FOCUS app to Vercel production.

**Project ID**: `prj_3AKAQNKnwflVthWcJoCW7uuzcihn`
**Deployment Type**: Automated via GitHub Actions

---

## Phase 1: Gather Vercel Credentials ✅

### Task 1.1: Get VERCEL_TOKEN
- [ ] Go to https://vercel.com/account/tokens
- [ ] Click **"Create"** button
- [ ] Select scope: **Full Access** (or higher)
- [ ] Copy the token immediately (shown only once)
- [ ] Save it securely: `VERCEL_TOKEN = <paste_here>`

### Task 1.2: Get VERCEL_ORG_ID
- [ ] Go to https://vercel.com/account/settings
- [ ] Look for **Team ID** or **Org ID** in the URL or settings
- [ ] Alternative: Check your Vercel dashboard URL (format: `https://vercel.com/<ORG_ID>/...`)
- [ ] Save it: `VERCEL_ORG_ID = <paste_here>`

---

## Phase 2: Configure GitHub Secrets ✅

### Task 2.1: Add VERCEL_TOKEN to GitHub
1. Go to your GitHub repository: https://github.com/cjaayy/PUP-FOCUS
2. Click **Settings** tab
3. Select **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. **Name**: `VERCEL_TOKEN`
6. **Value**: Paste your VERCEL_TOKEN from Phase 1.1
7. Click **Add secret**

### Task 2.2: Add VERCEL_ORG_ID to GitHub
1. In the same **Secrets and variables** → **Actions** page
2. Click **New repository secret**
3. **Name**: `VERCEL_ORG_ID`
4. **Value**: Paste your VERCEL_ORG_ID from Phase 1.2
5. Click **Add secret**

### Task 2.3: Add VERCEL_PROJECT_ID to GitHub
1. In the same **Secrets and variables** → **Actions** page
2. Click **New repository secret**
3. **Name**: `VERCEL_PROJECT_ID`
4. **Value**: `prj_3AKAQNKnwflVthWcJoCW7uuzcihn`
5. Click **Add secret**

---

## Phase 3: Configure Vercel Environment Variables ✅

### Task 3.1: Add Supabase Credentials in Vercel
1. Go to your Vercel project dashboard: https://vercel.com/dashboard/project/pup-focus (or similar)
2. Click **Settings** → **Environment Variables**
3. Add the following variables:

#### Production Environment:
- **Name**: `NEXT_PUBLIC_SUPABASE_URL`
  **Value**: `https://[YOUR_SUPABASE_PROJECT_ID].supabase.co`
  **Environments**: ✓ Production, ✓ Preview, ✓ Development

- **Name**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  **Value**: `<your_supabase_anon_key>`
  **Environments**: ✓ Production, ✓ Preview, ✓ Development

- **Name**: `SUPABASE_SERVICE_ROLE_KEY`
  **Value**: `<your_supabase_service_role_key>`
  **Environments**: ✓ Production (only), ✗ Preview, ✗ Development

4. Click **Save** for each variable

---

## Phase 4: Register Callback URL in Supabase ✅

### Task 4.1: Add Redirect URL
1. Go to your Supabase project: https://supabase.com/dashboard
2. Navigate to **Authentication** → **URL Configuration**
3. Under **Redirect URLs**, add:
   ```
   https://pup-focus.vercel.app/api/auth/callback
   ```
   (or your custom domain if using one)
4. Click **Save**

---

## Phase 5: Trigger Deployment ✅

### Task 5.1: Deploy via GitHub
Once all secrets and environment variables are configured:

**Option A: Automatic (Recommended)**
- Push a commit to the `main` branch
- GitHub Actions will automatically trigger `.github/workflows/deploy.yml`
- Deployment will start automatically

**Option B: Manual Trigger**
1. Go to your GitHub repository
2. Click **Actions** tab
3. Select **Deploy to Vercel** workflow
4. Click **Run workflow** → **Run workflow**
5. Wait for deployment to complete

---

## Phase 6: Verify Deployment ✅

### Task 6.1: Test the Live App
1. Go to https://pup-focus.vercel.app
2. You should see the sign-in page (not a 404 error)
3. Verify authentication works with Supabase

### Task 6.2: Check Vercel Deployment
1. Go to your Vercel project dashboard
2. Verify the **Production** deployment shows as "Ready"
3. Check the deployment logs for any errors

### Task 6.3: Monitor GitHub Actions
1. Go to your GitHub repository **Actions** tab
2. Verify the **Deploy to Vercel** workflow shows "✓ passed"

---

## Troubleshooting

### Issue: "404 NOT_FOUND" on production
- **Cause**: Environment variables not set in Vercel
- **Fix**: Verify all three Supabase variables are in Vercel project settings

### Issue: "Authentication failed"
- **Cause**: Callback URL not registered in Supabase
- **Fix**: Add `https://pup-focus.vercel.app/api/auth/callback` to Supabase URL Configuration

### Issue: "Deployment failed" in GitHub Actions
- **Cause**: Invalid VERCEL_TOKEN or VERCEL_ORG_ID
- **Fix**: Verify tokens are correct and have necessary permissions

---

## Summary of Credentials Needed

| Credential | Source | Where Used |
|-----------|--------|-----------|
| `VERCEL_TOKEN` | Vercel Account > Tokens | GitHub Secret |
| `VERCEL_ORG_ID` | Vercel Account Settings | GitHub Secret |
| `VERCEL_PROJECT_ID` | Already have: `prj_3AKAQNKnwflVthWcJoCW7uuzcihn` | GitHub Secret |
| Supabase URL | Supabase Project Settings | Vercel Env Var |
| Supabase Anon Key | Supabase Project Settings | Vercel Env Var |
| Supabase Service Role | Supabase Project Settings | Vercel Env Var (Production) |

---

## Current Status

✅ **Completed**:
- GitHub Actions workflows created (`.github/workflows/deploy.yml` and `preview.yml`)
- Next.js app builds successfully
- Vercel project created and linked

⏳ **Pending**:
- [ ] Gather VERCEL_TOKEN
- [ ] Gather VERCEL_ORG_ID
- [ ] Configure GitHub Secrets (3 secrets)
- [ ] Configure Vercel Environment Variables (3 variables)
- [ ] Register callback URL in Supabase
- [ ] Trigger production deployment

---

## Questions?

Refer to the deployed app structure:
- Homepage: `app/page.tsx`
- Auth Callback: `app/api/auth/callback/route.ts`
- Environment Config: `config/env.ts`
- Workflows: `.github/workflows/deploy.yml` and `preview.yml`
