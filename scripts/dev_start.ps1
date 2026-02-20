param(
  [string]$Host = "0.0.0.0",
  [int]$ApiPort = 8000,
  [int]$WebPort = 5173
)

Write-Host "Starting USC demo stack..."
docker compose up -d postgres redis

Write-Host "Run backend in a separate terminal:"
Write-Host "cd backend_fastapi"
Write-Host ".\.venv\Scripts\Activate.ps1"
Write-Host "python -m uvicorn app.main:app --host $Host --port $ApiPort --reload"

Write-Host "Run frontend in another terminal:"
Write-Host "cd frontend"
Write-Host "npm run dev -- --host $Host --port $WebPort --strictPort"

Write-Host "Health checks:"
Write-Host "http://localhost:$ApiPort/api/health"
Write-Host "http://localhost:$ApiPort/api/health/cache"
Write-Host "http://localhost:$ApiPort/api/health/llm"
