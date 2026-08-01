@echo off
setlocal enabledelayedexpansion

:: Get current folder path
set "TARGET_DIR=%~dp0pup-focus"

:: Force drive letter to Uppercase C:\ to fix Webpack Casing Bug
if "!TARGET_DIR:~0,1!"=="c" (
    set "TARGET_DIR=C!TARGET_DIR:~1!"
)

cd /d "!TARGET_DIR!"

echo =========================================
echo   Starting PUP FOCUS Development Server
echo =========================================
echo [INFO] Working Directory: !TARGET_DIR!
echo.

echo [INFO] Clearing Next.js build and cache...
if exist .next rmdir /s /q .next
if exist node_modules\.cache rmdir /s /q node_modules\.cache

echo [INFO] Opening http://localhost:3000 in browser...
start http://localhost:3000

echo.
npm run dev

endlocal