param(
  [string]$RepoUrl = "",

  [string]$Branch = "main",

  [string]$InstallDir = "$env:USERPROFILE\\Premieutdeling",

  [switch]$OpenFirewall,

  [switch]$SetupAutostart
)

$ErrorActionPreference = "Stop"

function Require-Command {
  param([string]$CommandName)

  if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $CommandName. Install Node.js LTS from https://nodejs.org/ and rerun the script in a new terminal window."
  }
}

function Test-Command {
  param([string]$CommandName)
  return [bool](Get-Command $CommandName -ErrorAction SilentlyContinue)
}

function Add-NodeToPathIfInstalled {
  $candidateDirs = @(
    (Join-Path $env:ProgramFiles "nodejs"),
    (Join-Path ${env:ProgramFiles(x86)} "nodejs")
  ) | Where-Object { $_ -and (Test-Path $_) }

  foreach ($dir in $candidateDirs) {
    $nodeExe = Join-Path $dir "node.exe"
    $npmCmd = Join-Path $dir "npm.cmd"
    if ((Test-Path $nodeExe) -and (Test-Path $npmCmd)) {
      if (-not ($env:Path -split ';' | Where-Object { $_ -eq $dir })) {
        $env:Path = "$dir;$env:Path"
      }
      return
    }
  }
}

function Install-NodeIfMissing {
  Add-NodeToPathIfInstalled
  if ((Test-Command "node") -and (Test-Command "npm")) {
    return
  }

  Write-Host "Node.js not found. Attempting automatic install of Node.js LTS..." -ForegroundColor Yellow

  if (Test-Command "winget") {
    Write-Host "Installing Node.js LTS via winget..." -ForegroundColor Cyan
    winget install --id OpenJS.NodeJS.LTS --exact --accept-source-agreements --accept-package-agreements --silent
    Add-NodeToPathIfInstalled
    if ((Test-Command "node") -and (Test-Command "npm")) {
      Write-Host "Node.js installed via winget." -ForegroundColor Green
      return
    }
  }

  if (Test-Command "choco") {
    Write-Host "Installing Node.js LTS via Chocolatey..." -ForegroundColor Cyan
    choco install nodejs-lts -y --no-progress
    Add-NodeToPathIfInstalled
    if ((Test-Command "node") -and (Test-Command "npm")) {
      Write-Host "Node.js installed via Chocolatey." -ForegroundColor Green
      return
    }
  }

  throw "Could not auto-install Node.js. Ensure winget or choco is available, or install Node.js LTS manually."
}

Write-Host "Checking prerequisites..." -ForegroundColor Cyan
Add-NodeToPathIfInstalled
Install-NodeIfMissing
Require-Command git
Require-Command node
Require-Command npm

if (Test-Path (Join-Path $InstallDir ".git")) {

  Write-Host "Repository already exists. Updating..." -ForegroundColor Cyan
  Push-Location $InstallDir
  git fetch origin
  git checkout $Branch
  git pull --ff-only origin $Branch
  Pop-Location
} else {
  if ([string]::IsNullOrWhiteSpace($RepoUrl)) {
    throw "RepoUrl is required when InstallDir is not already a git repository: $InstallDir"
  }

  Write-Host "Cloning repository..." -ForegroundColor Cyan
  git clone --branch $Branch $RepoUrl $InstallDir
}

Write-Host "Installing Node dependencies with npm ci..." -ForegroundColor Cyan
Push-Location $InstallDir
npm ci

$exampleData = Join-Path $InstallDir "public\\data\\ceremonies.example.json"
$realData = Join-Path $InstallDir "public\\data\\ceremonies.json"
if ((Test-Path $exampleData) -and (-not (Test-Path $realData))) {
  Write-Host "Creating local data file from example dataset..." -ForegroundColor Cyan
  Copy-Item $exampleData $realData
}

Pop-Location

$postInstallWarnings = @()

if ($OpenFirewall) {
  try {
    $ruleName = "Premieutdeling-3000"
    $existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

    if (-not $existingRule) {
      Write-Host "Opening Windows Firewall for TCP/3000..." -ForegroundColor Cyan
      New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 | Out-Null
    } else {
      Write-Host "Firewall rule already exists: $ruleName" -ForegroundColor DarkGray
    }
  } catch {
    $postInstallWarnings += "Could not open firewall port 3000 automatically (requires admin)."
    Write-Host "Warning: Could not configure Windows Firewall automatically." -ForegroundColor Yellow
    Write-Host "Advice: Run install.bat as Administrator, or open TCP/3000 manually." -ForegroundColor Yellow
  }
}

if ($SetupAutostart) {
  $taskName = "Premieutdeling-Autostart"
  $taskScript = Join-Path $InstallDir "scripts\\start-server.ps1"

  if (-not (Test-Path $taskScript)) {
    throw "Cannot configure autostart: missing script $taskScript"
  }

  $taskAction = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$taskScript`""

  # Prefer ONSTART (boot), fallback to ONLOGON if admin rights are not available.
  $onStartResult = cmd /c "schtasks /Create /TN \"$taskName\" /SC ONSTART /RU SYSTEM /RL HIGHEST /TR \"$taskAction\" /F" 2>&1
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Configured autostart task (ONSTART): $taskName" -ForegroundColor Green
  } else {
    Write-Host "ONSTART task creation failed, trying ONLOGON for current user..." -ForegroundColor Yellow
    $onLogonResult = cmd /c "schtasks /Create /TN \"$taskName\" /SC ONLOGON /RL LIMITED /TR \"$taskAction\" /F" 2>&1
    if ($LASTEXITCODE -eq 0) {
      Write-Host "Configured autostart task (ONLOGON): $taskName" -ForegroundColor Green
    } else {
      Write-Host $onStartResult -ForegroundColor DarkGray
      Write-Host $onLogonResult -ForegroundColor DarkGray
      $postInstallWarnings += "Could not configure autostart task automatically."
      Write-Host "Warning: Could not configure autostart scheduled task." -ForegroundColor Yellow
      Write-Host "Advice: Run install.bat as Administrator and rerun, or create the task manually." -ForegroundColor Yellow
    }
  }
}

$ipv4 = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.IPAddress -notlike "169.254.*" -and
    $_.IPAddress -ne "127.0.0.1" -and
    $_.PrefixOrigin -ne "WellKnown"
  } |
  Select-Object -ExpandProperty IPAddress -First 1

Write-Host "" 
Write-Host "Install complete." -ForegroundColor Green
Write-Host "Start server:" -ForegroundColor Green
Write-Host "  Set-Location \"$InstallDir\""
Write-Host "  npm start"
Write-Host ""
Write-Host "Control page:" -ForegroundColor Green
Write-Host "  http://localhost:3000/control"

if ($ipv4) {
  Write-Host "Display page from another PC:" -ForegroundColor Green
  Write-Host "  http://$ipv4:3000/display"
}

if ($postInstallWarnings.Count -gt 0) {
  Write-Host "" 
  Write-Host "Completed with warnings:" -ForegroundColor Yellow
  foreach ($warning in $postInstallWarnings) {
    Write-Host "  - $warning" -ForegroundColor Yellow
  }
}
