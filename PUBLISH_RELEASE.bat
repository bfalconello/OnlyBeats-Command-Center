@echo off
cd /d "%~dp0"

echo ======================================
echo OnlyBeats GitHub Release Publisher
echo ======================================
echo.
echo Recommended: publish by pushing a matching version tag.
echo Example for this release:
echo.
echo   v6.0.0
echo.
echo GitHub Actions will build and attach:
echo   OnlyBeats-Setup-6.0.0.exe
echo   OnlyBeats-Setup-6.0.0.exe.blockmap
echo   latest.yml
echo.
echo The release must be published, not left as a draft.
echo.
pause
