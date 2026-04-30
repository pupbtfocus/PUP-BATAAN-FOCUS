@echo off
setlocal

REM shortpath.bat - create a short drive mapping to the pup-focus folder,
REM run the existing run-pup-focus.bat, then remove the mapping.

set "REPO_ROOT=%~dp0"
set "TARGET=%REPO_ROOT%"
set "DRIVE=X:"

echo [INFO] Mapping X: to:
echo        %TARGET%

subst %DRIVE% /D >nul 2>&1
subst %DRIVE% "%TARGET%"
if errorlevel 1 (
  echo [ERROR] Failed to create drive mapping X: to %TARGET%
  pause
  endlocal
  exit /b 1
)

REM Call the existing launcher through the mapped drive so it inherits the short path.
call "%DRIVE%\run-pup-focus.bat"

echo [INFO] Removing mapping X:
subst %DRIVE% /D >nul

endlocal

exit /b 0
