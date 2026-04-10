@echo off
setlocal

REM Usage:
REM   update.bat <RepoUrl> [Branch] [InstallDir]
REM Example:
REM   update.bat https://github.com/user/repo.git main "%USERPROFILE%\Premieutdeling"

set "REPO_URL=%~1"
set "BRANCH=%~2"
set "INSTALL_DIR=%~3"

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

if "%INSTALL_DIR%"=="" set "INSTALL_DIR=%SCRIPT_DIR%"

if "%BRANCH%"=="" set "BRANCH=main"

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
if "%REPO_URL%"=="" (
  echo Repo: ^<existing clone^>
) else (
  echo Repo: %REPO_URL%
)
echo Branch: %BRANCH%
echo InstallDir: %INSTALL_DIR%
echo.

if "%REPO_URL%"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_PATH%" -Branch "%BRANCH%" -InstallDir "%INSTALL_DIR%" -OpenFirewall
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_PATH%" -RepoUrl "%REPO_URL%" -Branch "%BRANCH%" -InstallDir "%INSTALL_DIR%" -OpenFirewall
)
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo Update failed with exit code %EXIT_CODE%.
  exit /b %EXIT_CODE%
)

echo.
echo Update completed successfully.
exit /b 0
