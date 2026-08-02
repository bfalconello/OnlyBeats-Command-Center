@echo off
cd /d "%~dp0"
echo Opening the zero-install OnlyBeats preview...
start "" "%~dp0app\index.html"
echo.
echo The app opened in your default browser.
echo Settings will persist in that browser.
pause
