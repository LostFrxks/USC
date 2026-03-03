Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$patterns = @(
  "-m uvicorn app.main:app --host 0.0.0.0 --port 8080",
  "bun services/anchor/src/index.ts",
  'bun.exe" --env-file .env bin/dev-local.ts',
  "bunx.exe --bun vite --host 0.0.0.0 --port 5173"
)

$all = Get-CimInstance Win32_Process
$targets = @()
foreach ($proc in $all) {
  $cmd = [string]$proc.CommandLine
  if ([string]::IsNullOrWhiteSpace($cmd)) { continue }
  foreach ($p in $patterns) {
    if ($cmd -match $p) {
      $targets += $proc
      break
    }
  }
}

if ($targets.Count -eq 0) {
  Write-Output "No codex_remote processes found."
  exit 0
}

$stopped = New-Object System.Collections.Generic.List[string]
foreach ($target in ($targets | Sort-Object ProcessId -Unique)) {
  try {
    Stop-Process -Id $target.ProcessId -Force -ErrorAction Stop
    $stopped.Add("$($target.Name)#$($target.ProcessId)")
  } catch {
    # ignore
  }
}

if ($stopped.Count -eq 0) {
  Write-Output "No codex_remote processes were stopped."
} else {
  Write-Output "Stopped: $($stopped -join ', ')"
}
