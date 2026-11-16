@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Explorer-Menu.ps1"
if errorlevel 1 echo The menu could not be added. See the error above.
pause
