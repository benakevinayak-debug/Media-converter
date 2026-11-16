@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Explorer-Menu.ps1" -Remove
if errorlevel 1 echo The menu could not be removed. See the error above.
pause
