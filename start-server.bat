@echo off
setlocal

set "SCRIPT_PATH=%~dp0scripts\start-server.ps1"
if not exist "%SCRIPT_PATH%" (
  echo ERROR: Could not find "%SCRIPT_PATH%"
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_PATH%"
exit /b %ERRORLEVEL%
