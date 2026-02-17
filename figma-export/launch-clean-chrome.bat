@echo off
REM Launch Chrome without extensions for clean development
REM This ELIMINATES all wallet extension warnings

echo.
echo Starting Chrome without extensions...
echo This will open a clean browser with ZERO wallet warnings.
echo.

REM Try common Chrome installation paths
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --disable-extensions --new-window "http://localhost:5173"
    goto :success
)

if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --disable-extensions --new-window "http://localhost:5173"
    goto :success
)

if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
    start "" "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" --disable-extensions --new-window "http://localhost:5173"
    goto :success
)

echo Chrome not found in standard locations.
echo Please update the path in this script.
goto :end

:success
echo.
echo Chrome launched successfully!
echo - Extensions: DISABLED
echo - Wallet warnings: ELIMINATED
echo - Console: CLEAN
echo.

:end
pause
