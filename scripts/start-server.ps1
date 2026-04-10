$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$logsDir = Join-Path $projectRoot "logs"
$outLog = Join-Path $logsDir "server.out.log"
$errLog = Join-Path $logsDir "server.err.log"

function Resolve-NodeExe {
	$cmd = Get-Command node -ErrorAction SilentlyContinue
	if ($cmd -and $cmd.Source) {
		return $cmd.Source
	}

	$candidates = @(
		(Join-Path $env:ProgramFiles "nodejs\\node.exe"),
		(Join-Path ${env:ProgramFiles(x86)} "nodejs\\node.exe")
	)

	foreach ($candidate in $candidates) {
		if ($candidate -and (Test-Path $candidate)) {
			return $candidate
		}
	}

	throw "Could not find node.exe. Install Node.js LTS and rerun install.bat."
}

if (-not (Test-Path $logsDir)) {
	New-Item -ItemType Directory -Path $logsDir | Out-Null
}

$existingListener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($existingListener) {
	Write-Host "Server appears to be running already on port 3000 (PID: $($existingListener.OwningProcess))."
	exit 0
}

$nodeExe = Resolve-NodeExe

$process = Start-Process \
	-FilePath $nodeExe \
	-ArgumentList @("server.js") \
	-WorkingDirectory $projectRoot \
	-WindowStyle Hidden \
	-RedirectStandardOutput $outLog \
	-RedirectStandardError $errLog \
	-PassThru

Write-Host "Server started in background (PID: $($process.Id))."
Write-Host "Log files:"
Write-Host "  $outLog"
Write-Host "  $errLog"
