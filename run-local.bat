@echo off
rem Run the HT ECDIS demo on a local machine (Windows).
rem Starts a small static web server in this folder and opens the demo
rem in your default browser. Requires Node.js or Python on PATH.

setlocal EnableExtensions
title HT ECDIS local server
set PORT=%1
if "%PORT%"=="" set PORT=8000
set "URL=http://localhost:%PORT%/"

cd /d "%~dp0"

rem node first (server.js also provides the /proxy endpoint for live tide
rem data), then the "py" launcher. Plain "python" last, and only if it truly
rem runs: on stock Windows, "where python" finds the Microsoft Store alias
rem stub, which starts nothing and exits silently.
where node >nul 2>nul
if not errorlevel 1 (
  echo HT ECDIS demo - serving %cd% on %URL%  ^(Ctrl+C to stop^)
  start "" %URL%
  node server.js %PORT%
  goto :end
)

where py >nul 2>nul
if not errorlevel 1 (
  echo HT ECDIS demo - serving %cd% on %URL%  ^(Ctrl+C to stop^)
  start "" %URL%
  py -m http.server %PORT% --bind 127.0.0.1
  goto :end
)

python -c "print(1)" >nul 2>nul
if not errorlevel 1 (
  echo HT ECDIS demo - serving %cd% on %URL%  ^(Ctrl+C to stop^)
  start "" %URL%
  python -m http.server %PORT% --bind 127.0.0.1
  goto :end
)

echo.
echo Neither Node.js nor Python found - cannot start the local web server.
echo   Install Node.js:  https://nodejs.org   (recommended)
echo   or Python:        https://python.org
echo.
pause
exit /b 1

:end
endlocal
