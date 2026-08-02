@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1 || goto :node
where cargo >nul 2>&1 || goto :rust
if not exist node_modules (
  echo Installing build dependency...
  call npm install
  if errorlevel 1 goto :fail
)
echo Building OnlyBeats Command Center 0.2.1...
call npm run desktop:build
if errorlevel 1 goto :fail
echo.
echo BUILD COMPLETE
echo Installer files are normally in:
echo src-tauri\target\release\bundle\
start "" "%~dp0src-tauri\target\release\bundle"
pause
exit /b 0
:node
echo ERROR: Install Node.js LTS first. See INSTALL_WINDOWS.md.
pause
exit /b 1
:rust
echo ERROR: Install Rust first. See INSTALL_WINDOWS.md.
pause
exit /b 1
:fail
echo.
echo BUILD FAILED. Follow TROUBLESHOOTING.md and send the complete error text.
pause
exit /b 1
