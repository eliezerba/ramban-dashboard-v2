$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$indexHtml = Join-Path $root 'index.html'
$dataIndexJs = Join-Path $root 'data\data-index.js'

if (-not (Test-Path $indexHtml)) {
	Write-Host "[ERROR] Missing file: $indexHtml" -ForegroundColor Red
	exit 1
}

if (-not (Test-Path $dataIndexJs)) {
	Write-Host '[INFO] data-index.js is missing. Running data build...' -ForegroundColor Yellow
	if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
		Write-Host '[ERROR] Node.js was not found. Cannot generate data files.' -ForegroundColor Red
		exit 1
	}

	node .\scripts\build-data-index.js
	if ($LASTEXITCODE -ne 0) {
		Write-Host '[ERROR] Failed to build data index.' -ForegroundColor Red
		exit $LASTEXITCODE
	}
}

Start-Process "$root\index.html"
