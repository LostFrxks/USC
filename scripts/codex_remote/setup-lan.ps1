param(
  [string]$CodexRemotePath = "ops/codex_remote",
  [int]$BackendPort = 8080,
  [int]$FrontendPort = 5173
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-LanIPv4 {
  $cfg = Get-NetIPConfiguration |
    Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.IPv4Address -ne $null } |
    Select-Object -First 1

  if ($null -eq $cfg -or $null -eq $cfg.IPv4Address) {
    throw "Cannot detect LAN IPv4 address."
  }

  return $cfg.IPv4Address.IPAddress
}

function Set-DotEnvValue {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string]$Key,
    [Parameter(Mandatory = $true)][string]$Value
  )

  $escapedKey = [Regex]::Escape($Key)
  $content = Get-Content -Path $FilePath -Raw
  $line = "$Key=$Value"

  if ($content -match "(?m)^$escapedKey=") {
    $content = [Regex]::Replace($content, "(?m)^$escapedKey=.*$", $line)
  } else {
    if (-not $content.EndsWith("`n")) {
      $content += "`r`n"
    }
    $content += "$line`r`n"
  }

  Set-Content -Path $FilePath -Value $content -Encoding UTF8
}

$resolvedRoot = (Resolve-Path ".").Path
$resolvedRemote = Resolve-Path -Path $CodexRemotePath -ErrorAction Stop
$remoteDir = $resolvedRemote.Path
$envPath = Join-Path $remoteDir ".env"
$envExamplePath = Join-Path $remoteDir ".env.example"

if (-not (Test-Path $envPath)) {
  if (-not (Test-Path $envExamplePath)) {
    throw "Missing $envExamplePath."
  }
  Copy-Item -Path $envExamplePath -Destination $envPath -Force
}

$lanIp = Get-LanIPv4
$wsUrl = "ws://127.0.0.1:$BackendPort/ws/anchor"
$authUrl = "http://${lanIp}:$BackendPort"
$deviceUrl = "http://${lanIp}:$FrontendPort/device"
$corsOrigins = "http://localhost:$FrontendPort,http://${lanIp}:$FrontendPort"
$projectCwd = '"' + $resolvedRoot + '"'

Set-DotEnvValue -FilePath $envPath -Key "LOCAL_BACKEND_PORT" -Value "$BackendPort"
Set-DotEnvValue -FilePath $envPath -Key "LOCAL_FRONTEND_PORT" -Value "$FrontendPort"
Set-DotEnvValue -FilePath $envPath -Key "AUTH_MODE" -Value "basic"
Set-DotEnvValue -FilePath $envPath -Key "ANCHOR_ORBIT_URL" -Value $wsUrl
Set-DotEnvValue -FilePath $envPath -Key "AUTH_URL" -Value $authUrl
Set-DotEnvValue -FilePath $envPath -Key "DEVICE_VERIFICATION_URL" -Value $deviceUrl
Set-DotEnvValue -FilePath $envPath -Key "CORS_ORIGINS" -Value $corsOrigins
Set-DotEnvValue -FilePath $envPath -Key "ANCHOR_APP_CWD" -Value $projectCwd

if (-not (Select-String -Path $envPath -Pattern "(?m)^CODEX_REMOTE_WEB_JWT_SECRET=" -Quiet)) {
  $webSecret = python -c "import secrets; print(secrets.token_urlsafe(48))"
  Set-DotEnvValue -FilePath $envPath -Key "CODEX_REMOTE_WEB_JWT_SECRET" -Value $webSecret
}

if (-not (Select-String -Path $envPath -Pattern "(?m)^CODEX_REMOTE_ANCHOR_JWT_SECRET=" -Quiet)) {
  $anchorSecret = python -c "import secrets; print(secrets.token_urlsafe(48))"
  Set-DotEnvValue -FilePath $envPath -Key "CODEX_REMOTE_ANCHOR_JWT_SECRET" -Value $anchorSecret
}

Write-Output "codex_remote .env configured"
Write-Output "LAN IP: $lanIp"
Write-Output "Web UI: http://${lanIp}:$FrontendPort"
Write-Output "Backend health: http://${lanIp}:$BackendPort/health"
