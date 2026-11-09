param([switch]$Demo, [switch]$SinNavegador)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$python = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $python) -or -not (Test-Path -LiteralPath 'frontend\dist\index.html')) {
    throw 'Primero ejecutá .\instalar.ps1.'
}
if ($Demo) {
    $env:INVENTORY_DB = Join-Path $PSScriptRoot 'backend\data\demo\inventory.db'
    if (-not (Test-Path -LiteralPath $env:INVENTORY_DB)) {
        & $python backend\demo.py --db $env:INVENTORY_DB
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar la demostración.' }
    }
}
$portInUse = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($portInUse) { throw 'El puerto 8000 ya está en uso. Cerrá la otra instancia antes de iniciar.' }
# Open only after the HTTP server is ready, without a visible helper window.
if (-not $SinNavegador) {
    $waitScript = Join-Path $PSScriptRoot 'scripts\abrir-cuando-listo.ps1'
    Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + $waitScript + '"'))
}
Write-Host 'Inventario en http://127.0.0.1:8000. Para detenerlo, presioná Ctrl+C.' -ForegroundColor Green
& $python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --workers 1
