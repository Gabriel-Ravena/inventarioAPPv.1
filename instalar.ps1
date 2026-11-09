$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw 'Instalá Python 3.11 o superior y agregalo a PATH.' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Instalá Node.js 20.19 o superior (incluye npm).' }
if (-not (Test-Path -LiteralPath '.venv\Scripts\python.exe')) {
    & python -m venv .venv
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el entorno virtual.' }
}
$python = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
# También repara un entorno creado sin pip, si el Python principal tiene pip.
if (-not (Test-Path -LiteralPath '.venv\Lib\site-packages\pip\__main__.py')) {
    & python -m pip --python $python install pip
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo instalar pip en el entorno virtual.' }
}
& $python -m pip install -r backend\requirements-lock.txt
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias de Python.' }
Push-Location frontend
try {
    if (Get-Command pnpm.cmd -ErrorAction SilentlyContinue) {
        & pnpm.cmd install --frozen-lockfile
        if ($LASTEXITCODE -ne 0) { throw 'Falló la instalación del frontend.' }
        & pnpm.cmd build
    } elseif (Get-Command npm.cmd -ErrorAction SilentlyContinue) {
        & npm.cmd install
        if ($LASTEXITCODE -ne 0) { throw 'Falló la instalación del frontend.' }
        & npm.cmd run build
    } else { throw 'No se encontró npm ni pnpm.' }
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo compilar el frontend.' }
} finally { Pop-Location }
Write-Host 'Instalación completa. Ejecutá .\iniciar.ps1 para abrir la aplicación.' -ForegroundColor Green
