@echo off
cd /d "%~dp0"
call npm install
if errorlevel 1 exit /b 1
call npm run dist:win
if errorlevel 1 exit /b 1
echo Installer created in dist\
pause
