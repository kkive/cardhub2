param(
    [Parameter(Mandatory=$true, Position=0)]
    [string]$Namespace,
    [Parameter(Position=1)]
    [string]$Tag = "latest",
    [Parameter(Position=2)]
    [string]$Platform = "linux/amd64"
)

$ErrorActionPreference = "Stop"

$fullTag = "$Namespace/cards-hub:$Tag"
Write-Host "Building & pushing $fullTag (platform=$Platform) ..." -ForegroundColor Cyan

docker buildx build --platform $Platform --push -t $fullTag -f infra/docker/app/Dockerfile .
if ($LASTEXITCODE -ne 0) {
    Write-Error "Build/push failed for $fullTag"
    exit 1
}

Write-Host "Done: $fullTag pushed to Docker Hub." -ForegroundColor Green
