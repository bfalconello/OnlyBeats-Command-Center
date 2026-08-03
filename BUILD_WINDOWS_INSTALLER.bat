@echo off
cd /d "%~dp0"

echo ======================================
echo OnlyBeats v5.5 Installer Builder
echo ======================================
echo.

call npm install
if errorlevel 1 (
  echo ERROR: npm install failed.
  pause
  exit /b 1
)

call npm run dist:win
if errorlevel 1 (
  echo ERROR: installer build failed.
  pause
  exit /b 1
)

echo.
if exist "dist\OnlyBeats-Setup-5.5.0.exe" (
  echo Installer found:
  echo dist\OnlyBeats-Setup-5.5.0.exe
) else (
  echo WARNING: expected installer was not found.
)

echo.
pause
