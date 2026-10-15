@echo off
setlocal enabledelayedexpansion

:: Resolve pup-focus folder (one level up from bat-scripts\)
for %%I in ("%~dp0..\pup-focus") do set "TARGET_DIR=%%~fI"

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
echo Select development mode:
echo   [1] Single Localhost (Port 3001)
echo   [2] Dual Localhost   (Port 3000 in Chrome + Port 3001)
echo.
choice /c 12 /n /m "Enter choice [1 or 2]: "
set "MODE=!errorlevel!"
echo.

if "!MODE!"=="2" (
    echo [INFO] Mode: Dual Localhost (Ports 3000 and 3001)
    echo [INFO] Freeing ports 3000 and 3001 if in use...
    for %%P in (3000 3001) do (
        for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%%P" ^| findstr "LISTENING"') do (
            taskkill /f /pid %%a >nul 2>&1
        )
    )

    echo [INFO] Clearing Next.js build and cache...
    if exist .next rmdir /s /q .next
    if exist .next-3000 rmdir /s /q .next-3000
    if exist node_modules\.cache rmdir /s /q node_modules\.cache

    echo [INFO] Opening http://localhost:3000 in Chrome...
    start chrome http://localhost:3000 || start http://localhost:3000
    echo [INFO] Opening http://localhost:3001 in browser...
    start http://localhost:3001
    echo [INFO] Opening https://pupfocus.cjaayy.dev in browser...
    start https://pupfocus.cjaayy.dev

    echo.
    echo [INFO] Starting instance on port 3000 in separate window...
    start "PUP Focus - Port 3000" cmd /k "set NEXT_DIST_DIR=.next-3000&& npm run dev -- -p 3000"

    echo [INFO] Starting instance on port 3001 in current window...
    set "NEXT_DIST_DIR=.next"
    npm run dev -- -p 3001
) else (
    echo [INFO] Mode: Single Localhost (Port 3001)
    echo [INFO] Freeing port 3001 if in use...
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001" ^| findstr "LISTENING"') do (
        taskkill /f /pid %%a >nul 2>&1
    )

    echo [INFO] Clearing Next.js build and cache...
    if exist .next rmdir /s /q .next
    if exist node_modules\.cache rmdir /s /q node_modules\.cache

    echo [INFO] Opening http://localhost:3001 in browser...
    start http://localhost:3001
    echo [INFO] Opening https://pupfocus.cjaayy.dev in browser...
    start https://pupfocus.cjaayy.dev

    echo.
    set "NEXT_DIST_DIR=.next"
    npm run dev -- -p 3001
)

endlocal