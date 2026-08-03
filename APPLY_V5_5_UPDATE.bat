@echo off
setlocal

cd /d "%~dp0"

echo ==========================================
echo OnlyBeats v5.5 Safe Update Helper
echo ==========================================
echo.
echo This helper protects app\firebase-config.js
echo before you manually copy this release.
echo.

if exist "app\firebase-config.js" (
  copy /Y "app\firebase-config.js" "firebase-config.v5-backup.js" >nul
  echo Firebase configuration backup created:
  echo firebase-config.v5-backup.js
) else (
  echo WARNING: app\firebase-config.js was not found.
)

echo.
echo Copy this release over your repository.
echo Then copy firebase-config.v5-backup.js back to:
echo app\firebase-config.js
echo.
pause
