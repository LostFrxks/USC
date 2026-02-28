param(
  [string]$PythonVersion = "3.12"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backendDir = Join-Path $repoRoot "backend"
$venvDir = Join-Path $backendDir ".venv_local"
$venvPython = Join-Path $venvDir "Scripts\\python.exe"
$requirements = Join-Path $backendDir "requirements.txt"

function Invoke-BasePython {
  param([string[]]$Args)
  if (Get-Command py -ErrorAction SilentlyContinue) {
    try {
      & py ("-$PythonVersion") @Args
      return
    } catch {
      Write-Host "py -$PythonVersion failed, trying plain python..." -ForegroundColor Yellow
    }
  }

  if (Get-Command python -ErrorAction SilentlyContinue) {
    & python @Args
    return
  }

  throw "Python launcher not found. Install Python 3.12+ and re-run."
}

if (!(Test-Path $venvPython)) {
  Write-Host "Creating backend virtualenv: $venvDir" -ForegroundColor Cyan
  Invoke-BasePython -Args @("-m", "venv", $venvDir)
} else {
  Write-Host "Using existing backend virtualenv: $venvDir" -ForegroundColor Cyan
}

Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -r $requirements

Write-Host ""
Write-Host "Done. Activate and run backend:" -ForegroundColor Green
Write-Host "cd backend"
Write-Host ".\\.venv_local\\Scripts\\Activate.ps1"
Write-Host "python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
