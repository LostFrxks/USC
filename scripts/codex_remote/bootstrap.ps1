param(
  [string]$CodexRemotePath = "ops/codex_remote",
  [string]$CodexRemoteRepo = "https://github.com/dwnmf/codex_remote.git",
  [string]$CodexRemoteBranch = "main"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$bunBin = Join-Path $env:USERPROFILE ".bun\bin"
if (Test-Path $bunBin) {
  $env:Path = "$bunBin;$env:Path"
}

if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
  throw "bun is not installed. Install with: irm bun.sh/install.ps1|iex"
}

if (-not (Test-Path $CodexRemotePath)) {
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "git is required to clone codex_remote. Install git first."
  }
  Write-Output "[0/4] codex_remote not found. Cloning repository..."
  git clone --depth 1 --branch $CodexRemoteBranch $CodexRemoteRepo $CodexRemotePath
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to clone codex_remote from $CodexRemoteRepo."
  }
}

$remoteDir = (Resolve-Path -Path $CodexRemotePath -ErrorAction Stop).Path
$controlPlaneDir = Join-Path $remoteDir "services\control-plane"
$anchorDir = Join-Path $remoteDir "services\anchor"

Write-Output "[1/4] Installing root JS dependencies..."
Push-Location $remoteDir
try {
  bun install
} finally {
  Pop-Location
}

Write-Output "[2/4] Installing anchor JS dependencies..."
Push-Location $anchorDir
try {
  bun install
} finally {
  Pop-Location
}

Write-Output "[3/4] Installing control-plane Python dependencies..."
Push-Location $controlPlaneDir
try {
  py -3 -m pip install -r requirements.txt
} finally {
  Pop-Location
}

Write-Output "[4/4] Preparing LAN .env..."
& (Join-Path (Resolve-Path ".").Path "scripts\codex_remote\setup-lan.ps1") -CodexRemotePath $CodexRemotePath

Write-Output "codex_remote bootstrap complete."
