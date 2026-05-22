@echo off
setlocal

REM Resolve paths relative to this script location.
set "ROOT_DIR=%~dp0"
set "APP_DIR=%ROOT_DIR%pup-focus"

if not exist "%APP_DIR%\package.json" (
  echo [ERROR] package.json not found in:
  echo         "%APP_DIR%"
  echo.
  echo Make sure this script is in the parent folder of "pup-focus".
  pause
  exit /b 1
)

cd /d "%APP_DIR%"

echo [INFO] Starting PUP FOCUS dev server from:
echo        %CD%
echo.
echo [INFO] Opening http://localhost:3000 in your default browser...
start "" "http://localhost:3000"
echo.

where npm >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  npm run dev
) else (
  if exist "C:\Program Files\nodejs\npm.cmd" (
    "C:\Program Files\nodejs\npm.cmd" run dev
  ) else (
    echo [ERROR] npm was not found in PATH and fallback npm.cmd does not exist.
    echo Install Node.js or add npm to PATH.
    pause
    exit /b 1
  )
)

endlocal
