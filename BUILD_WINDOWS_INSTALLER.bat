@echo off
cd /d "%~dp0"

echo ======================================
echo OnlyBeats v3.3 Installer Builder
echo ======================================
echo.

echo Installing dependencies...
call npm install
if errorlevel 1 (
  echo.
  echo ERROR: Dependency installation failed.
  pause
  exit /b 1
)

echo.
echo Building OnlyBeats v3.3.0 installer...
call npm run dist:win
if errorlevel 1 (
  echo.
  echo ERROR: Installer build failed.
  echo Review the error above.
  pause
  exit /b 1
)

echo.
echo ======================================
echo Installer build completed
echo ======================================
echo.

if exist "dist\OnlyBeats-Setup-3.3.0.exe" (
  echo Installer found:
  echo dist\OnlyBeats-Setup-3.3.0.exe
) else (
  echo WARNING: Expected installer was not found.
  echo Check the dist folder.
)

echo.
pause
