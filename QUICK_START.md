# 🚀 PUP FOCUS Deployment - Quick Start

## Current Status: ✅ Ready for Configuration

Your PUP FOCUS Next.js app is built and configured. All GitHub Actions workflows are in place at `.github/workflows/`.

### What's Configured ✅

- ✅ GitHub Actions workflows (deploy.yml, preview.yml)
- ✅ Next.js app builds successfully (26 routes)
- ✅ Vercel project linked
- ✅ Deployment scripts ready

### What You Need to Do

You need to provide 5 pieces of information to go live:

#### From Vercel:

1. **VERCEL_TOKEN** → https://vercel.com/account/tokens
2. **VERCEL_ORG_ID** → Your Vercel account settings or workspace ID

#### From Supabase:

3. **NEXT_PUBLIC_SUPABASE_URL**
4. **NEXT_PUBLIC_SUPABASE_ANON_KEY**
5. **SUPABASE_SERVICE_ROLE_KEY**

---

## ⚡ Quick Setup (3 Steps)

### Step 1: Run Setup Script

**PowerShell (Recommended for Windows):**

```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force
.\setup-deployment.ps1
```

**Bash (macOS/Linux):**

```bash
bash setup-deployment.sh
```

This script will:

- Ask for your Vercel credentials
- Automatically add them to GitHub Secrets
- Ask for your Supabase credentials
- Show you where to configure them

### Step 2: Configure Vercel Environment Variables

The script will show you the exact values to add in:
**Vercel Dashboard → Settings → Environment Variables**

### Step 3: Register Callback in Supabase

The script will show you exactly what to add in:
**Supabase → Authentication → URL Configuration**

---

## 📋 Complete Setup (Manual)

See **DEPLOYMENT_GUIDE.md** for detailed step-by-step instructions.

---

## 🔍 Verify Everything Works

After setup, run:

```bash
bash verify-deployment.sh
```

---

## 📚 Files Included

| File                            | Purpose                                 |
| ------------------------------- | --------------------------------------- |
| `.github/workflows/deploy.yml`  | Production deployment (on push to main) |
| `.github/workflows/preview.yml` | Preview deployment (on pull requests)   |
| `DEPLOYMENT_GUIDE.md`           | Complete step-by-step setup guide       |
| `DEPLOYMENT_SETUP_CHECKLIST.md` | Detailed checklist with phases          |
| `setup-deployment.ps1`          | PowerShell setup script (Windows)       |
| `setup-deployment.sh`           | Bash setup script (macOS/Linux)         |
| `setup-deployment.bat`          | Batch setup script (Windows)            |
| `verify-deployment.sh`          | Verification script                     |

---

## 🚀 Once Setup is Complete

1. Push to main branch:

   ```bash
   git push origin main
   ```

2. GitHub Actions will automatically:
   - Run tests & build
   - Deploy to Vercel production
   - Create a live app

3. Your app will be live at:
   ```
   https://pup-focus.vercel.app
   ```

---

## ❓ Need Help?

- **Setup issues?** → Check DEPLOYMENT_GUIDE.md troubleshooting section
- **GitHub Actions failing?** → Check GitHub Actions logs
- **Authentication not working?** → Verify Supabase credentials and callback URL
- **404 errors?** → Verify environment variables are set in Vercel

---

## 📞 Key Credentials Reference

Store these safely:

```
VERCEL_TOKEN: <from https://vercel.com/account/tokens>
VERCEL_ORG_ID: <from Vercel account/project settings>
VERCEL_PROJECT_ID: prj_3AKAQNKnwflVthWcJoCW7uuzcihn (already configured)

NEXT_PUBLIC_SUPABASE_URL: <from Supabase settings>
NEXT_PUBLIC_SUPABASE_ANON_KEY: <from Supabase settings>
SUPABASE_SERVICE_ROLE_KEY: <from Supabase settings>
```

---

**Ready? Start with Step 1 above! 🎯**

Last updated: April 29, 2026
