@echo off
cd /d "%~dp0pup-focus"

echo =========================================
echo   Building & Starting Production Server
echo =========================================
echo.

echo [INFO] Building Next.js production bundle...
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [INFO] Starting Production Server on http://localhost:3000...
start http://localhost:3000
call npm run start