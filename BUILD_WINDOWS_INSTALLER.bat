@echo off
cd /d "%~dp0"
echo ======================================
echo OnlyBeats v5.0.0-beta.1 Builder
echo ======================================
echo.
call npm install
if errorlevel 1 (echo ERROR: npm install failed.&pause&exit /b 1)
call npm run dist:win
if errorlevel 1 (echo ERROR: installer build failed.&pause&exit /b 1)
echo.
if exist "dist\OnlyBeats-Setup-5.0.0-beta.1.exe" (
 echo Installer found: dist\OnlyBeats-Setup-5.0.0-beta.1.exe
) else (
 echo WARNING: expected installer was not found.
)
pause
