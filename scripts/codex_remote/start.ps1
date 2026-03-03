param(
  [string]$CodexRemotePath = "ops/codex_remote",
  [switch]$SkipLanSetup
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$bunBin = Join-Path $env:USERPROFILE ".bun\bin"
if (Test-Path $bunBin) {
  $env:Path = "$bunBin;$env:Path"
}

if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
  throw "bun is not installed. Run scripts/codex_remote/bootstrap.ps1 first."
}

if (-not $SkipLanSetup) {
  & (Join-Path (Resolve-Path ".").Path "scripts\codex_remote\setup-lan.ps1") -CodexRemotePath $CodexRemotePath
}

$remoteDir = (Resolve-Path -Path $CodexRemotePath -ErrorAction Stop).Path
Push-Location $remoteDir
try {
  bun --env-file .env bin/dev-local.ts
} finally {
  Pop-Location
}
