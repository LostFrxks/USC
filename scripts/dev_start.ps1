param(
  [string]$Host = "0.0.0.0",
  [int]$ApiPort = 8000,
  [int]$WebPort = 5173
)

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backendActivate = Join-Path $repoRoot "backend\.venv_local\Scripts\Activate.ps1"

Write-Host "Starting USC demo stack..."
docker compose up -d postgres redis

if (-not (Test-Path $backendActivate)) {
  Write-Host ""
  Write-Host "Local backend env not found (.venv_local)." -ForegroundColor Yellow
  Write-Host "Run once:"
  Write-Host "powershell -ExecutionPolicy Bypass -File scripts/bootstrap_backend_venv.ps1"
}

Write-Host "Run backend in a separate terminal:"
Write-Host "cd backend"
Write-Host ".\.venv_local\Scripts\Activate.ps1"
Write-Host "python -m uvicorn app.main:app --host $Host --port $ApiPort --reload"

Write-Host "Run frontend in another terminal:"
Write-Host "cd frontend"
Write-Host "npm run dev -- --host $Host --port $WebPort --strictPort"

Write-Host "Health checks:"
Write-Host "http://${Host}:$ApiPort/api/health"
Write-Host "http://${Host}:$ApiPort/api/health/cache"
Write-Host "http://${Host}:$ApiPort/api/health/llm"
