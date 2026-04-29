# PUP FOCUS - Complete Vercel Deployment Guide

## Executive Summary

Your PUP FOCUS Next.js application is ready to deploy to Vercel with full CI/CD automation. This guide walks you through the final configuration steps to go live.

**Current Status**: 🟡 **Infrastructure Ready, Awaiting Credentials**

- ✅ Next.js app verified to build successfully
- ✅ GitHub Actions workflows created and positioned
- ✅ Vercel project linked
- ⏳ Awaiting: Vercel credentials + Supabase setup

---

## Prerequisites

Before starting, ensure you have:

- [ ] Access to your Vercel account (https://vercel.com)
- [ ] Access to your Supabase project (https://supabase.com)
- [ ] Access to your GitHub repository (https://github.com/cjaayy/PUP-FOCUS)
- [ ] GitHub CLI installed (`gh` command available)
- [ ] Node.js 22+ installed

---

## Part 1: Quick Setup (Automated)

### Option A: Use the Automated Setup Script (Recommended)

**Windows:**

```bash
.\setup-deployment.bat
```

**macOS/Linux:**

```bash
bash setup-deployment.sh
```

This script will:

1. ✓ Prompt you for Vercel credentials (VERCEL_TOKEN, VERCEL_ORG_ID)
2. ✓ Automatically configure GitHub Secrets using GitHub CLI
3. ✓ Guide you through Supabase and Vercel setup
4. ✓ Provide verification instructions

**Then skip to "Part 2: Manual Configuration"** for the remaining steps.

### Option B: Manual Setup

If you prefer manual configuration or the script doesn't work, follow **Part 2** below.

---

## Part 2: Manual Configuration

### Step 1: Gather Vercel Credentials

#### 1.1 Get VERCEL_TOKEN

1. Open: https://vercel.com/account/tokens
2. Click **"Create"**
3. Give it a name (e.g., "PUP FOCUS GitHub Actions")
4. Select scope: **Full Access**
5. Click **"Create Token"**
6. **Copy the token immediately** (shown only once)

```
Your VERCEL_TOKEN: <paste here>
```

#### 1.2 Get VERCEL_ORG_ID

**Method 1: From Project Settings**

1. Go to your Vercel project: https://vercel.com/dashboard/project/pup-focus
2. Click **Settings** → look for **Team ID** or check the URL
3. The ID follows the pattern: `cjaayys-projects` or similar

**Method 2: Using Vercel CLI**

```bash
cd pup-focus
npx vercel link
```

Then check `.vercel/project.json` for `"orgId"`

```
Your VERCEL_ORG_ID: <paste here>
```

#### 1.3 Confirm VERCEL_PROJECT_ID

Already provided: `prj_3AKAQNKnwflVthWcJoCW7uuzcihn`

---

### Step 2: Configure GitHub Secrets

1. Go to: https://github.com/cjaayy/PUP-FOCUS
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"** and add:

#### Secret 1: VERCEL_TOKEN

- **Name**: `VERCEL_TOKEN`
- **Value**: (from Step 1.1)
- Click **Add secret**

#### Secret 2: VERCEL_ORG_ID

- **Name**: `VERCEL_ORG_ID`
- **Value**: (from Step 1.2)
- Click **Add secret**

#### Secret 3: VERCEL_PROJECT_ID

- **Name**: `VERCEL_PROJECT_ID`
- **Value**: `prj_3AKAQNKnwflVthWcJoCW7uuzcihn`
- Click **Add secret**

✓ GitHub Secrets complete!

---

### Step 3: Gather Supabase Credentials

1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click **Settings** → **API**

Copy these values:

```
NEXT_PUBLIC_SUPABASE_URL: https://[your-project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY: [public-key-here]
SUPABASE_SERVICE_ROLE_KEY: [secret-role-key-here]
```

---

### Step 4: Configure Vercel Environment Variables

1. Go to: https://vercel.com/dashboard/project/pup-focus
2. Click **Settings** → **Environment Variables**
3. Add the following variables:

#### Variable 1: NEXT_PUBLIC_SUPABASE_URL

- **Name**: `NEXT_PUBLIC_SUPABASE_URL`
- **Value**: `https://[your-project-id].supabase.co`
- **Environments**: Check all (✓ Production, ✓ Preview, ✓ Development)
- Click **Save**

#### Variable 2: NEXT_PUBLIC_SUPABASE_ANON_KEY

- **Name**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Value**: [public-key-from-Supabase]
- **Environments**: Check all (✓ Production, ✓ Preview, ✓ Development)
- Click **Save**

#### Variable 3: SUPABASE_SERVICE_ROLE_KEY

- **Name**: `SUPABASE_SERVICE_ROLE_KEY`
- **Value**: [secret-role-key-from-Supabase]
- **Environments**: Check only (✓ Production) ← IMPORTANT
- Click **Save**

✓ Vercel Environment Variables complete!

---

### Step 5: Register Callback URL in Supabase

1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click **Authentication** → **URL Configuration**
4. Under **Redirect URLs**, add:
   ```
   https://pup-focus.vercel.app/api/auth/callback
   ```
   (Or your custom domain if using one)
5. Click **Save**

✓ Supabase Callback URL registered!

---

## Part 3: Deploy to Production

### Option A: Automatic Deployment (Recommended)

Simply push to the `main` branch:

```bash
git add .
git commit -m "Deploy to production"
git push origin main
```

GitHub Actions will automatically:

1. Run tests and build
2. Deploy to Vercel production
3. Deploy preview for any PRs

### Option B: Manual Workflow Trigger

1. Go to: https://github.com/cjaayy/PUP-FOCUS
2. Click **Actions** tab
3. Select **Production Deploy** workflow
4. Click **Run workflow** → **Run workflow**
5. Wait for deployment (2-5 minutes)

---

## Part 4: Verify Deployment

### ✓ Step 1: Check GitHub Actions

1. Go to: https://github.com/cjaayy/PUP-FOCUS/actions
2. Look for the latest **Production Deploy** workflow
3. Verify it shows: ✓ **All checks passed**

### ✓ Step 2: Check Vercel Deployment

1. Go to: https://vercel.com/dashboard/project/pup-focus
2. Verify **Production** deployment shows: **Ready ✓**
3. Copy the production URL

### ✓ Step 3: Test the Live App

1. Visit your production URL: https://pup-focus.vercel.app
2. You should see the sign-in page (not a 404)
3. Try signing in with your Supabase credentials
4. Verify role-based routing works (should redirect to appropriate dashboard)

### ✓ Step 4: Check Application Logs

In Vercel dashboard:

1. Click **Deployments** → **Production**
2. Click **Logs**
3. Verify no errors in application output

---

## Troubleshooting

### Issue: "404 NOT_FOUND" on production

**Cause**: Environment variables not configured in Vercel

**Fix**:

1. Go to Vercel project → **Settings** → **Environment Variables**
2. Verify all 3 Supabase variables are present
3. Redeploy: Go to **Deployments** → right-click Production → **Redeploy**

### Issue: "Authentication failed" when signing in

**Cause**: Callback URL not registered in Supabase or credentials mismatch

**Fix**:

1. Go to Supabase → **Authentication** → **URL Configuration**
2. Verify callback URL is: `https://pup-focus.vercel.app/api/auth/callback`
3. Verify environment variables in Vercel match Supabase project credentials

### Issue: "Deployment failed" in GitHub Actions

**Cause**: Invalid VERCEL_TOKEN or VERCEL_ORG_ID

**Fix**:

1. Go to GitHub → Repository **Settings** → **Secrets**
2. Verify VERCEL_TOKEN and VERCEL_ORG_ID are correct
3. Delete and recreate if needed
4. Redeploy by pushing to main or manually triggering workflow

### Issue: "Preview deployment failed"

**Cause**: Similar to production failures, usually environment variables

**Fix**:

1. Create a test PR to see detailed error logs
2. Check GitHub Actions logs for the specific error
3. Verify all environment variables are set in Vercel

---

## Architecture Overview

```
GitHub Repository
    ↓
    └─→ Push to main or PR
         ↓
    GitHub Actions Workflows
    ├─ deploy.yml (on push to main)
    │   ├─ Checkout code
    │   ├─ Setup Node.js 22
    │   ├─ Run: npm ci && npm run build
    │   └─ Deploy to Vercel (--prod flag)
    │
    └─ preview.yml (on pull requests)
        ├─ Checkout code
        ├─ Setup Node.js 22
        ├─ Run: npm ci && npm run build
        └─ Deploy preview to Vercel
         ↓
    Vercel Deployment
    ├─ Production: https://pup-focus.vercel.app
    └─ Preview: https://pup-focus-pr-[#].vercel.app
         ↓
    Application Startup
    ├─ Load Supabase credentials from env vars
    ├─ Initialize authentication
    └─ Serve Next.js app
```

---

## Key Files

- **.github/workflows/deploy.yml** - Production deployment workflow
- **.github/workflows/preview.yml** - Preview deployment workflow
- **pup-focus/app/page.tsx** - Sign-in page (homepage)
- **pup-focus/app/api/auth/callback/route.ts** - OAuth callback handler
- **pup-focus/config/env.ts** - Environment variable validation
- **pup-focus/next.config.ts** - Next.js configuration
- **pup-focus/package.json** - Dependencies and build scripts

---

## Environment Variables Reference

| Variable                        | Type   | Source                | Purpose                                    |
| ------------------------------- | ------ | --------------------- | ------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Public | Supabase API Settings | Supabase project URL                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase API Settings | Public authentication key                  |
| `SUPABASE_SERVICE_ROLE_KEY`     | Secret | Supabase API Settings | Server-side admin access (production only) |

---

## Post-Deployment Monitoring

### 1. GitHub Actions Monitoring

- URL: https://github.com/cjaayy/PUP-FOCUS/actions
- Check for: ✓ All workflows passing
- Alert on: ✗ Failed deployments

### 2. Vercel Monitoring

- URL: https://vercel.com/dashboard/project/pup-focus
- Check for: ✓ Production deployment "Ready"
- Alert on: ✗ Build failures or errors

### 3. Supabase Monitoring

- URL: https://supabase.com/dashboard
- Check for: ✓ Auth logs for successful logins
- Alert on: ✗ Auth failures or configuration issues

---

## Next Steps After Deployment

1. **Test all user flows**
   - Faculty sign-in and dashboard access
   - Admin features and management
   - Program head views
   - Super admin console

2. **Monitor performance**
   - Check Vercel analytics
   - Monitor Supabase usage
   - Track database queries

3. **Set up monitoring alerts**
   - Vercel: Configure deploy alerts
   - GitHub: Watch for action failures
   - Supabase: Monitor auth and database events

4. **Plan for future deployments**
   - Workflows are automatic on push to main
   - PRs automatically get preview deployments
   - Keep secrets and env vars updated

---

## Support Resources

- **Vercel Docs**: https://vercel.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **Supabase Docs**: https://supabase.com/docs
- **GitHub Actions**: https://docs.github.com/en/actions

---

## Summary Checklist

- [ ] Gathered VERCEL_TOKEN from Vercel
- [ ] Gathered VERCEL_ORG_ID from Vercel
- [ ] Added VERCEL_TOKEN to GitHub Secrets
- [ ] Added VERCEL_ORG_ID to GitHub Secrets
- [ ] Added VERCEL_PROJECT_ID to GitHub Secrets
- [ ] Added NEXT_PUBLIC_SUPABASE_URL to Vercel env vars
- [ ] Added NEXT_PUBLIC_SUPABASE_ANON_KEY to Vercel env vars
- [ ] Added SUPABASE_SERVICE_ROLE_KEY to Vercel env vars (production only)
- [ ] Registered callback URL in Supabase
- [ ] Triggered deployment (push to main or manual workflow)
- [ ] Verified deployment succeeded in GitHub Actions
- [ ] Verified production deployment in Vercel
- [ ] Tested live app at https://pup-focus.vercel.app
- [ ] Tested authentication workflow

**Once all items are checked, your PUP FOCUS app is live on Vercel! 🚀**

---

Last updated: April 29, 2026
