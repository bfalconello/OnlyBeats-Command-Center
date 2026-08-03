@echo off
cd /d "%~dp0"
echo ======================================
echo OnlyBeats v6.0.4 Builder
echo ======================================
echo.
call npm install
if errorlevel 1 (echo ERROR: npm install failed.&pause&exit /b 1)
call npm run dist:win
if errorlevel 1 (echo ERROR: installer build failed.&pause&exit /b 1)
echo.
echo Expected:
echo dist\OnlyBeats-Setup-6.0.4.exe
echo dist\OnlyBeats-Setup-6.0.4.exe.blockmap
echo dist\latest.yml
pause
