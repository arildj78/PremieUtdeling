@echo off
setlocal

REM Usage:
REM   install.bat <RepoUrl> [Branch] [InstallDir]
REM Example:
REM   install.bat https://github.com/user/repo.git main "%USERPROFILE%\Premieutdeling"

set "REPO_URL=%~1"
set "BRANCH=%~2"
set "INSTALL_DIR=%~3"

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

if "%INSTALL_DIR%"=="" set "INSTALL_DIR=%SCRIPT_DIR%"

if "%REPO_URL%"=="" if not exist "%INSTALL_DIR%\.git" (
  set /p REPO_URL=GitHub repo URL ^(for example https://github.com/user/repo.git^): 
)

if "%BRANCH%"=="" set "BRANCH=main"

set "SCRIPT_PATH=%~dp0scripts\install-from-github.ps1"

if not exist "%SCRIPT_PATH%" (
  echo.
  echo ERROR: Could not find "%SCRIPT_PATH%"
  echo Make sure this batch file is in the project root.
  exit /b 1
)

echo.
echo Starting install...
if "%REPO_URL%"=="" (
  echo Repo: ^<existing clone^>
) else (
  echo Repo: %REPO_URL%
)
echo Branch: %BRANCH%
echo InstallDir: %INSTALL_DIR%
echo.

if "%REPO_URL%"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_PATH%" -Branch "%BRANCH%" -InstallDir "%INSTALL_DIR%" -OpenFirewall -SetupAutostart
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_PATH%" -RepoUrl "%REPO_URL%" -Branch "%BRANCH%" -InstallDir "%INSTALL_DIR%" -OpenFirewall -SetupAutostart
)
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo Install with autostart failed ^(exit code %EXIT_CODE%^).
  echo Retrying without autostart setup...

  if "%REPO_URL%"=="" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_PATH%" -Branch "%BRANCH%" -InstallDir "%INSTALL_DIR%" -OpenFirewall
  ) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_PATH%" -RepoUrl "%REPO_URL%" -Branch "%BRANCH%" -InstallDir "%INSTALL_DIR%" -OpenFirewall
  )
  set "EXIT_CODE=%ERRORLEVEL%"

  if not "%EXIT_CODE%"=="0" (
    echo.
    echo Install failed with exit code %EXIT_CODE%.
    echo Advice: Try running install.bat as Administrator, or rerun and share the full error output.
    exit /b %EXIT_CODE%
  )

  echo.
  echo Install completed, but autostart was not configured automatically.
  echo Advice: Run install.bat as Administrator to enable autostart setup.
)

echo.
echo Install completed successfully.

set "START_SCRIPT=%INSTALL_DIR%\scripts\start-server.ps1"
if exist "%START_SCRIPT%" (
  echo Starting server in a new window...
  start "Premieutdeling Server" powershell -NoProfile -ExecutionPolicy Bypass -File "%START_SCRIPT%"
) else (
  echo WARNING: Could not find start script at "%START_SCRIPT%"
)

exit /b 0
