$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
& .\.venv\Scripts\python.exe -m pytest -q -c backend\pytest.ini
if ($LASTEXITCODE -ne 0) { throw 'Fallaron las pruebas del backend.' }
Push-Location frontend
try {
    if (Get-Command pnpm.cmd -ErrorAction SilentlyContinue) { & pnpm.cmd build } else { & npm.cmd run build }
    if ($LASTEXITCODE -ne 0) { throw 'Falló la compilación del frontend.' }
} finally { Pop-Location }
