@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1 || goto :node
where cargo >nul 2>&1 || goto :rust
if not exist node_modules (
  echo Installing the Tauri command-line dependency...
  call npm install
  if errorlevel 1 goto :installfail
)
echo Starting OnlyBeats Command Center in desktop development mode...
call npm run desktop:dev
exit /b %errorlevel%
:node
echo ERROR: Node.js is not installed. Read INSTALL_WINDOWS.md.
pause
exit /b 1
:rust
echo ERROR: Rust is not installed. Read INSTALL_WINDOWS.md.
pause
exit /b 1
:installfail
echo ERROR: npm install failed. Check internet access and TROUBLESHOOTING.md.
pause
exit /b 1
