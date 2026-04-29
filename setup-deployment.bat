@echo off
REM PUP FOCUS Automated Deployment Configuration Script (Windows)
REM This script automates GitHub Secrets configuration

setlocal enabledelayedexpansion

echo.
echo ==========================================
echo PUP FOCUS Automated Deployment Setup
echo ==========================================
echo.

REM Configuration
set GITHUB_REPO=cjaayy/PUP-FOCUS
set VERCEL_PROJECT_ID=prj_3AKAQNKnwflVthWcJoCW7uuzcihn
set VERCEL_CALLBACK_URL=https://pup-focus.vercel.app/api/auth/callback

echo Repository: %GITHUB_REPO%
echo Vercel Project ID: %VERCEL_PROJECT_ID%
echo.

REM Step 1: Gather Vercel Credentials
echo Step 1: Gathering Vercel Credentials
echo =======================================
echo.
echo You need to gather two credentials from Vercel:
echo.

set "VERCEL_TOKEN=%VERCEL_TOKEN%"
if not defined VERCEL_TOKEN set /p VERCEL_TOKEN="Enter your VERCEL_TOKEN (from https://vercel.com/account/tokens): "
if "!VERCEL_TOKEN!"=="" (
    echo Error: VERCEL_TOKEN is required
    exit /b 1
)

set "VERCEL_ORG_ID=%VERCEL_ORG_ID%"
if not defined VERCEL_ORG_ID set /p VERCEL_ORG_ID="Enter your VERCEL_ORG_ID (from Vercel account settings): "
if "!VERCEL_ORG_ID!"=="" (
    echo Error: VERCEL_ORG_ID is required
    exit /b 1
)

echo ^✓ Credentials gathered
echo.

REM Step 2: Verify GitHub CLI is installed
echo Step 2: Verifying GitHub CLI
echo =============================
where gh >nul 2>nul
if errorlevel 1 goto gh_missing
echo ^✓ GitHub CLI found
set GITHUB_CLI_AVAILABLE=1
echo.
goto gh_ready

:gh_missing
echo Error: GitHub CLI (gh) is not installed
echo Install from: https://cli.github.com/
echo Continuing with manual GitHub secret setup instructions.
set GITHUB_CLI_AVAILABLE=0
echo.

:gh_ready

REM Step 3: Add GitHub Secrets
echo Step 3: Adding GitHub Secrets
echo ==============================
echo.

if "%GITHUB_CLI_AVAILABLE%"=="1" (
    echo Adding VERCEL_TOKEN...
    gh secret set VERCEL_TOKEN --body "%VERCEL_TOKEN%" --repo "%GITHUB_REPO%"
    echo ^✓ VERCEL_TOKEN set

    echo Adding VERCEL_ORG_ID...
    gh secret set VERCEL_ORG_ID --body "%VERCEL_ORG_ID%" --repo "%GITHUB_REPO%"
    echo ^✓ VERCEL_ORG_ID set

    echo Adding VERCEL_PROJECT_ID...
    gh secret set VERCEL_PROJECT_ID --body "%VERCEL_PROJECT_ID%" --repo "%GITHUB_REPO%"
    echo ^✓ VERCEL_PROJECT_ID set
    echo.
) else (
    echo Manual GitHub secret setup required:
    echo 1. VERCEL_TOKEN = %VERCEL_TOKEN%
    echo 2. VERCEL_ORG_ID = %VERCEL_ORG_ID%
    echo 3. VERCEL_PROJECT_ID = %VERCEL_PROJECT_ID%
    echo.
)

REM Step 4: Gather Supabase Credentials
echo Step 4: Gathering Supabase Credentials
echo ======================================
echo.
echo You need to gather three credentials from your Supabase project:
echo.

set "SUPABASE_URL=%NEXT_PUBLIC_SUPABASE_URL%"
if not defined SUPABASE_URL set /p SUPABASE_URL="Enter NEXT_PUBLIC_SUPABASE_URL (from Supabase project settings): "
if "!SUPABASE_URL!"=="" (
    echo Error: NEXT_PUBLIC_SUPABASE_URL is required
    exit /b 1
)

set "SUPABASE_ANON_KEY=%NEXT_PUBLIC_SUPABASE_ANON_KEY%"
if not defined SUPABASE_ANON_KEY set /p SUPABASE_ANON_KEY="Enter NEXT_PUBLIC_SUPABASE_ANON_KEY (from Supabase project settings): "
if "!SUPABASE_ANON_KEY!"=="" (
    echo Error: NEXT_PUBLIC_SUPABASE_ANON_KEY is required
    exit /b 1
)

set "SUPABASE_SERVICE_ROLE_KEY=%SUPABASE_SERVICE_ROLE_KEY%"
if not defined SUPABASE_SERVICE_ROLE_KEY set /p SUPABASE_SERVICE_ROLE_KEY="Enter SUPABASE_SERVICE_ROLE_KEY (from Supabase project settings): "
if "!SUPABASE_SERVICE_ROLE_KEY!"=="" (
    echo Error: SUPABASE_SERVICE_ROLE_KEY is required
    exit /b 1
)

echo ^✓ Supabase credentials gathered
echo.

REM Step 5: Display Vercel Configuration Instructions
echo Step 5: Configuring Vercel Environment Variables
echo ================================================
echo.
echo Please configure these in Vercel project dashboard:
echo https://vercel.com/dashboard/project/pup-focus
echo.
echo Settings ^> Environment Variables:
echo.
echo 1. Name: NEXT_PUBLIC_SUPABASE_URL
echo    Value: %SUPABASE_URL%
echo    Environments: Production, Preview, Development
echo.
echo 2. Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
echo    Value: %SUPABASE_ANON_KEY%
echo    Environments: Production, Preview, Development
echo.
echo 3. Name: SUPABASE_SERVICE_ROLE_KEY
echo    Value: %SUPABASE_SERVICE_ROLE_KEY%
echo    Environments: Production only
echo.

REM Step 6: Register Callback URL in Supabase
echo Step 6: Registering Callback URL in Supabase
echo ===========================================
echo.
echo Please add this to your Supabase project:
echo Authentication ^> URL Configuration ^> Redirect URLs
echo.
echo Add: %VERCEL_CALLBACK_URL%
echo.

REM Step 7: Final verification
echo Step 7: Final Verification
echo ==========================
echo.
if "%GITHUB_CLI_AVAILABLE%"=="1" (
    echo ^✓ GitHub Secrets configured:
    gh secret list --repo "%GITHUB_REPO%"
) else (
    echo GitHub Secrets were not set automatically because gh is not installed.
    echo Add these secrets manually in GitHub repository settings:
    echo 1. VERCEL_TOKEN
    echo 2. VERCEL_ORG_ID
    echo 3. VERCEL_PROJECT_ID
)

echo.
echo Next Steps:
echo 1. ^✓ GitHub Secrets added (VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID)
echo 2. ⚠ Manually add Supabase env vars to Vercel project settings (see above)
echo 3. ⚠ Register callback URL in Supabase (see above)
echo 4. ^→ Push to main branch or trigger GitHub workflow manually
echo.
echo After completing steps 2-3, go to:
echo https://github.com/%GITHUB_REPO%/actions
echo to monitor your deployment.
echo.
echo ==========================================
echo Setup Complete!
echo ==========================================
echo.

pause
