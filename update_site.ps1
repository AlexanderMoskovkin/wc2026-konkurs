# Ежедневное обновление сайта конкурса: site.py -> data.json -> git push.
# Запускается планировщиком через update_site.bat. Если изменений нет — выходит тихо.
$ErrorActionPreference = "Stop"
$site = $PSScriptRoot
Set-Location $site

$env:PYTHONIOENCODING = "utf-8"
python "$site\site.py"
if ($LASTEXITCODE -ne 0) {
    Write-Error "site.py завершился с ошибкой ($LASTEXITCODE), data.json не обновлён"
    exit 1
}

git add -A
git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    exit 0  # изменений нет
}

$stamp = Get-Date -Format "dd.MM.yyyy HH:mm"
git commit -m "site update $stamp"
if ($LASTEXITCODE -ne 0) { exit 1 }
git push origin main
exit $LASTEXITCODE
