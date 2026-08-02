@echo off
setlocal
cd /d "%~dp0"
title OnlyBeats Command Center 0.2.1
cls
echo ============================================================
echo            ONLYBEATS COMMAND CENTER 0.2.1
echo ============================================================
echo.
echo Choose an option:
echo.
echo   1. Open instant browser preview (no installation)
echo   2. Run native desktop app in development mode
echo   3. Build Windows installer
echo   4. Open step-by-step guide
echo   5. Exit
echo.
choice /c 12345 /n /m "Selection: "
if errorlevel 5 exit /b 0
if errorlevel 4 start "" "%~dp0START_HERE.html" & exit /b 0
if errorlevel 3 call "%~dp0BUILD_WINDOWS.bat" & exit /b %errorlevel%
if errorlevel 2 call "%~dp0RUN_DESKTOP.bat" & exit /b %errorlevel%
if errorlevel 1 call "%~dp0PREVIEW_APP.bat" & exit /b %errorlevel%
