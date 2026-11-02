<#
.SYNOPSIS
  Builds the backend and frontend Lambda container images and pushes them to ECR.

.EXAMPLE
  ./deploy/deploy.ps1 -Region ap-south-1
  ./deploy/deploy.ps1 -Region ap-south-1 -Only backend -UpdateFunctions

.NOTES
  Requires Docker Desktop running and the AWS CLI logged in (aws configure / aws sso login).
  -UpdateFunctions points existing Lambda functions (zero-backend / zero-frontend by default)
  at the freshly pushed image. Create the functions once by hand first; see deploy/README.md.
#>
param(
    [string]$Region = $(if ($env:AWS_REGION) { $env:AWS_REGION } else { "ap-south-1" }),
    [string]$Tag = (Get-Date -Format "yyyyMMdd-HHmmss"),
    [ValidateSet("all", "backend", "frontend")]
    [string]$Only = "all",
    [string]$BackendRepo = "zero-backend",
    [string]$FrontendRepo = "zero-frontend",
    [string]$BackendFunction = "zero-backend",
    [string]$FrontendFunction = "zero-frontend",
    [switch]$UpdateFunctions
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function Invoke-Checked([string]$what, [scriptblock]$cmd) {
    & $cmd
    if ($LASTEXITCODE -ne 0) { throw "$what failed (exit $LASTEXITCODE)" }
}

docker info *> $null
if ($LASTEXITCODE -ne 0) { throw "Docker is not running. Start Docker Desktop and retry." }

$account = (aws sts get-caller-identity --query Account --output text)
if ($LASTEXITCODE -ne 0 -or -not $account) { throw "AWS CLI is not authenticated. Run 'aws configure' or 'aws sso login'." }
$registry = "$account.dkr.ecr.$Region.amazonaws.com"

Write-Host "Account $account, region $Region, tag $Tag" -ForegroundColor Cyan
Invoke-Checked "ECR login" { aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin $registry }

$targets = @()
if ($Only -in "all", "backend")  { $targets += @{ Name = "backend";  Dir = "backend";  Repo = $BackendRepo;  Function = $BackendFunction } }
if ($Only -in "all", "frontend") { $targets += @{ Name = "frontend"; Dir = "frontend"; Repo = $FrontendRepo; Function = $FrontendFunction } }

$pushed = @{}
foreach ($t in $targets) {
    $repo = $t.Repo
    aws ecr describe-repositories --repository-names $repo --region $Region *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Creating ECR repository $repo" -ForegroundColor Yellow
        Invoke-Checked "create repository $repo" {
            aws ecr create-repository --repository-name $repo --region $Region --image-scanning-configuration scanOnPush=true *> $null
        }
    }

    $image = "$registry/${repo}:$Tag"
    Write-Host "`nBuilding $($t.Name) -> $image" -ForegroundColor Cyan
    # Lambda needs a single-arch image manifest: amd64, and no buildx provenance attestation
    Invoke-Checked "docker build $($t.Name)" {
        docker build --platform linux/amd64 --provenance=false -t $image -t "$registry/${repo}:latest" (Join-Path $root $t.Dir)
    }
    Invoke-Checked "docker push $image" { docker push $image }
    Invoke-Checked "docker push latest" { docker push "$registry/${repo}:latest" }
    $pushed[$t.Name] = $image

    if ($UpdateFunctions) {
        Write-Host "Updating Lambda function $($t.Function)" -ForegroundColor Cyan
        Invoke-Checked "update $($t.Function)" {
            aws lambda update-function-code --function-name $t.Function --image-uri $image --region $Region --output text --query LastUpdateStatus
        }
    }
}

Write-Host "`nPushed images:" -ForegroundColor Green
$pushed.GetEnumerator() | ForEach-Object { Write-Host ("  {0,-9} {1}" -f $_.Key, $_.Value) }
