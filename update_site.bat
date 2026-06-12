@echo off
rem Обёртка для планировщика: лог пишется в update.log рядом со скриптом
echo ===== %date% %time% ===== >> "%~dp0update.log"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update_site.ps1" >> "%~dp0update.log" 2>&1
