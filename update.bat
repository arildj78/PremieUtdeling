@echo off
setlocal

REM Usage:
REM   update.bat <RepoUrl> [Branch] [InstallDir]
REM Example:
REM   update.bat https://github.com/user/repo.git main "%USERPROFILE%\Premieutdeling"

set "REPO_URL=%~1"
set "BRANCH=%~2"
set "INSTALL_DIR=%~3"

if "%REPO_URL%"=="" (
  set /p REPO_URL=GitHub repo URL (for example https://github.com/user/repo.git): 
)

if "%BRANCH%"=="" set "BRANCH=main"
if "%INSTALL_DIR%"=="" set "INSTALL_DIR=%USERPROFILE%\Premieutdeling"

set "SCRIPT_PATH=%~dp0scripts\install-from-github.ps1"

if not exist "%SCRIPT_PATH%" (
  echo.
  echo ERROR: Could not find "%SCRIPT_PATH%"
  echo Make sure this batch file is in the project root.
  exit /b 1
)

if not exist "%INSTALL_DIR%\.git" (
  echo.
  echo ERROR: "%INSTALL_DIR%" is not a git installation folder.
  echo Run install.bat first, or pass the correct InstallDir.
  exit /b 1
)

echo.
echo Updating deployment...
echo Repo: %REPO_URL%
echo Branch: %BRANCH%
echo InstallDir: %INSTALL_DIR%
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_PATH%" -RepoUrl "%REPO_URL%" -Branch "%BRANCH%" -InstallDir "%INSTALL_DIR%" -OpenFirewall
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo Update failed with exit code %EXIT_CODE%.
  exit /b %EXIT_CODE%
)

echo.
echo Update completed successfully.
exit /b 0
