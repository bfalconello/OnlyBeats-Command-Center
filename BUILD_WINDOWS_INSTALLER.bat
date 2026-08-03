@echo off
cd /d "%~dp0"

echo ======================================
echo OnlyBeats v6.0.2 Update Test Builder
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
echo Verifying automatic-update files...
if not exist "dist\OnlyBeats-Setup-6.0.2.exe" (
  echo ERROR: installer missing.
  pause
  exit /b 1
)
if not exist "dist\OnlyBeats-Setup-6.0.2.exe.blockmap" (
  echo ERROR: blockmap missing.
  pause
  exit /b 1
)
if not exist "dist\latest.yml" (
  echo ERROR: latest.yml missing.
  pause
  exit /b 1
)

echo.
echo Build complete:
echo dist\OnlyBeats-Setup-6.0.2.exe
echo dist\OnlyBeats-Setup-6.0.2.exe.blockmap
echo dist\latest.yml
echo.
pause
