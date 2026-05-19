<#
.SYNOPSIS
    Pre-release quality gate for Cards hub.

.DESCRIPTION
    Runs build, typecheck, test, lint, and prod compose config validation.
    Optionally pushes the Docker image with -Push.

.PARAMETER Push
    If set, runs docker buildx push after all checks pass.

.PARAMETER Namespace
    Docker Hub namespace (default: kanggejie).

.PARAMETER Tag
    Image tag (default: v1).

.PARAMETER Platform
    Target platform (default: linux/amd64).
#>
param(
    [switch]$Push,
    [string]$Namespace = "kanggejie",
    [string]$Tag = "v1",
    [string]$Platform = "linux/amd64"
)

$ErrorActionPreference = "Stop"

function Step($name, $cmd) {
    Write-Host "`n=== $name ===" -ForegroundColor Cyan
    Invoke-Expression $cmd
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAIL: $name (exit code $LASTEXITCODE)" -ForegroundColor Red
        exit $LASTEXITCODE
    }
    Write-Host "PASS: $name" -ForegroundColor Green
}

Step "Build all packages"           "pnpm build"
Step "Typecheck"                    "pnpm typecheck"
Step "Tests"                        "pnpm test"
Step "Lint (typecheck + encoding)"  "pnpm lint"
# Inject temporary defaults for required env vars so config validation
# works without a real .env file. Existing values are preserved.
$_configEnvVars = @(
    'MYSQL_ROOT_PASSWORD','MYSQL_PASSWORD','MEILI_MASTER_KEY',
    'DOCKERHUB_NAMESPACE','PASSKEY_RP_ID','PASSKEY_ORIGIN','JWT_SECRET'
)
$_savedEnv = @{}
foreach ($_v in $_configEnvVars) {
    $_savedEnv[$_v] = [Environment]::GetEnvironmentVariable($_v, 'Process')
    if (-not $_savedEnv[$_v]) {
        [Environment]::SetEnvironmentVariable($_v, 'config-check-placeholder', 'Process')
    }
}
try {
    Step "Prod compose config"          "docker compose -f docker-compose.prod.yml config --quiet"
} finally {
    foreach ($_v in $_configEnvVars) {
        [Environment]::SetEnvironmentVariable($_v, $_savedEnv[$_v], 'Process')
    }
}

if ($Push) {
    Step "Docker buildx push" ".\scripts\docker-build-push.ps1 $Namespace $Tag $Platform"
    Write-Host "`nImage pushed: ${Namespace}/cards-hub:${Tag}" -ForegroundColor Green
}

Write-Host "`nAll release checks passed." -ForegroundColor Green
