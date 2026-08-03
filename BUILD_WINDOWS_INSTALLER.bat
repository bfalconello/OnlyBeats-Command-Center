@echo off
cd /d "%~dp0"

echo ======================================
echo OnlyBeats Windows Installer Builder
echo ======================================
echo.

echo Installing dependencies...
call npm install
if errorlevel 1 (
  echo.
  echo ERROR: Dependency installation failed.
  echo.
  pause
  exit /b 1
)

echo.
echo Building OnlyBeats v2.7.0 installer...
call npm run dist:win
if errorlevel 1 (
  echo.
  echo ERROR: Installer build failed.
  echo Review the error above.
  echo.
  pause
  exit /b 1
)

echo.
echo ======================================
echo Installer build completed
echo ======================================
echo.

if exist "dist\OnlyBeats-Setup-2.7.0.exe" (
  echo Installer found:
  echo dist\OnlyBeats-Setup-2.7.0.exe
) else (
  echo WARNING: The expected filename was not found.
  echo Check the dist folder for the generated installer.
)

echo.
pause
