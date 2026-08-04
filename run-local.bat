@echo off
rem Run the HT ECDIS demo on a local machine (Windows).
rem Starts a small static web server in this folder and opens the demo
rem in your default browser. Requires Python or Node.js on PATH.

setlocal
set PORT=%1
if "%PORT%"=="" set PORT=8000
set URL=http://localhost:%PORT%/

cd /d "%~dp0"

echo HT ECDIS demo - serving %cd% on %URL%  (Ctrl+C to stop)

where python >nul 2>nul
if %errorlevel%==0 (
  start "" %URL%
  python -m http.server %PORT% --bind 127.0.0.1
  goto :eof
)

where py >nul 2>nul
if %errorlevel%==0 (
  start "" %URL%
  py -m http.server %PORT% --bind 127.0.0.1
  goto :eof
)

where node >nul 2>nul
if %errorlevel%==0 (
  start "" %URL%
  node server.js %PORT%
  goto :eof
)

echo Error: need Python or Node.js installed to serve the demo.
echo Install one of them, or serve this folder with any static web server.
exit /b 1
