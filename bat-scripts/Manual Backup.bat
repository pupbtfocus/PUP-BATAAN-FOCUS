@echo off
title Manual System Backup
echo ====================================================
echo      Starting System Backup...
echo ====================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\system_backups\backup.ps1"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ====================================================
    echo   SUCCESS: Backup completed and uploaded to Drive!
    echo ====================================================
) else (
    echo.
    echo ====================================================
    echo   ERROR: Backup process failed.
    echo ====================================================
)

echo.
pause
