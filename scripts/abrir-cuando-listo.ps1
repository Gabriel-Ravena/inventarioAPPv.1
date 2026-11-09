$deadline = (Get-Date).AddSeconds(30)
while ((Get-Date) -lt $deadline) {
    try {
        $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health' -TimeoutSec 1
        if ($health.status -eq 'ok') { Start-Process 'http://127.0.0.1:8000'; exit 0 }
    } catch { }
    Start-Sleep -Milliseconds 400
}
exit 1
