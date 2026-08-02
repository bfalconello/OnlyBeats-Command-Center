@echo off
setlocal
cls
echo ONLYBEATS COMMAND CENTER - PC CHECK
echo ====================================
where node >nul 2>&1 && (for /f "delims=" %%v in ('node -v') do echo [OK] Node.js %%v) || echo [MISSING] Node.js LTS
where npm >nul 2>&1 && (for /f "delims=" %%v in ('npm -v') do echo [OK] npm %%v) || echo [MISSING] npm
where cargo >nul 2>&1 && (for /f "delims=" %%v in ('cargo -V') do echo [OK] %%v) || echo [MISSING] Rust/Cargo
where rustc >nul 2>&1 && (for /f "delims=" %%v in ('rustc -V') do echo [OK] %%v) || echo [MISSING] rustc
where cl >nul 2>&1 && echo [OK] Microsoft C++ Build Tools detected || echo [CHECK] Visual Studio C++ tools may need installation
reg query "HKLM\SOFTWARE\Microsoft\EdgeUpdate\Clients" >nul 2>&1 && echo [OK] Microsoft Edge WebView environment detected || echo [CHECK] WebView2 normally comes with current Windows

echo.
echo Browser preview requires none of the development tools above.
pause
