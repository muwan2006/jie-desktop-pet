@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -STA -NoProfile -ExecutionPolicy Bypass -File "%~dp0voice-setup.ps1" -Action Install
pause
