$ErrorActionPreference = "Stop"

$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $listener) {
  Write-Host "No server is listening on port 3000."
  exit 0
}

$pid = $listener.OwningProcess
$process = Get-Process -Id $pid -ErrorAction SilentlyContinue

if (-not $process) {
  Write-Host "Port 3000 is in use, but the owning process could not be resolved."
  exit 1
}

Stop-Process -Id $pid -Force
Write-Host "Stopped server process on port 3000 (PID: $pid)."
