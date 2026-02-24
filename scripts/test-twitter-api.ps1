# Test twitterapi.io from env file (no key in terminal).
# Run from repo root: .\scripts\test-twitter-api.ps1
# Optional: .\scripts\test-twitter-api.ps1 -UserName muazxinthi

param(
    [string]$UserName = "muazxinthi",
    [ValidateSet("info", "last_tweets")]
    [string]$Endpoint = "last_tweets"
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir

# Load TWITTERAPI_API_KEY from env file (no key in terminal)
$envFiles = @(
    (Join-Path $repoRoot "apps\web\.env.local"),
    (Join-Path $repoRoot "apps\web\.env"),
    (Join-Path $repoRoot ".env"),
    (Join-Path $repoRoot ".env.local")
)
$apiKey = $null
foreach ($f in $envFiles) {
    if (-not (Test-Path -LiteralPath $f)) { continue }
    $content = Get-Content -LiteralPath $f -ErrorAction SilentlyContinue
    foreach ($line in $content) {
        if ($line -match '^\s*TWITTERAPI_API_KEY\s*=\s*(.+)$') {
            $apiKey = $matches[1].Trim().Trim('"').Trim("'")
            break
        }
    }
    if ($apiKey) { break }
}
if (-not $apiKey) {
    Write-Error "TWITTERAPI_API_KEY not found. Check: $($envFiles[0])"
    exit 1
}

$headers = @{ "X-API-Key" = $apiKey }
$uri = if ($Endpoint -eq "info") {
    "https://api.twitterapi.io/twitter/user/info?userName=$([uri]::EscapeDataString($UserName))"
} else {
    "https://api.twitterapi.io/twitter/user/last_tweets?userName=$([uri]::EscapeDataString($UserName))&includeReplies=true"
}

Write-Host "[test-twitter-api] endpoint=$Endpoint userName=$UserName (key read from env file)"
try {
    $result = Invoke-RestMethod -Uri $uri -Headers $headers
    $result | ConvertTo-Json -Depth 5
} catch {
    Write-Host "HTTP error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        Write-Host $reader.ReadToEnd()
    }
    exit 1
}
