$ErrorActionPreference = "Stop"

$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $listener) {
  Write-Host "Server status: not running"
  Write-Host "Control page: http://localhost:3000/control"
  Write-Host "Display page: http://localhost:3000/display"
  exit 0
}

$pid = $listener.OwningProcess
$process = Get-Process -Id $pid -ErrorAction SilentlyContinue
$ipv4 = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.IPAddress -notlike "169.254.*" -and
    $_.IPAddress -ne "127.0.0.1" -and
    $_.PrefixOrigin -ne "WellKnown"
  } |
  Select-Object -ExpandProperty IPAddress -First 1

Write-Host "Server status: running"
Write-Host "PID: $pid"
if ($process) {
  Write-Host "Process: $($process.ProcessName)"
}
Write-Host "Control page: http://localhost:3000/control"
Write-Host "Display page: http://localhost:3000/display"
if ($ipv4) {
  Write-Host "Display page from another PC: http://$ipv4:3000/display"
}
