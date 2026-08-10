@echo off
rem Run the HT ECDIS demo in KIOSK MODE on a local machine (Windows).
rem
rem Starts the local server and opens the demo in Chrome/Edge with --kiosk:
rem real fullscreen with NO tab strip, NO address bar, NO "press Esc to exit"
rem hint and NO close button. Closing the browser also stops the server.
rem
rem   run-kiosk.bat          - port 8000
rem   run-kiosk.bat 9000     - custom port
rem
rem To quit the kiosk:  Alt+F4

setlocal EnableExtensions
title HT ECDIS kiosk launcher
set PORT=%1
if "%PORT%"=="" set PORT=8000
set "URL=http://localhost:%PORT%/?kiosk=1"

cd /d "%~dp0"
rem Persistent browser profile: keeps the aisstream API key (localStorage) and
rem any granted GPS permission between kiosk launches.
set "PROFILE=%~dp0.kiosk-profile"
set "SRVTITLE=HT ECDIS kiosk server"

rem ---- find a Chromium-family browser ---------------------------------------
set "BROWSER="
for %%P in (
  "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  "%LocalAppData%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
  "%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe"
) do if not defined BROWSER if exist %%P set "BROWSER=%%~P"
if not defined BROWSER if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"

rem ---- find a server runtime -------------------------------------------------
rem Order matters: node first (server.js also provides the /proxy endpoint that
rem unlocks live Kartverket tide data), then the "py" launcher. Plain "python"
rem is tried LAST and only if it really runs: on stock Windows 10/11,
rem "where python" finds the Microsoft Store alias stub, which starts nothing
rem and exits silently - the classic "double-click does nothing" trap.
set "SRVCMD="
where node >nul 2>nul
if not errorlevel 1 set "SRVCMD=node server.js %PORT%"
if not defined SRVCMD (
  where py >nul 2>nul
  if not errorlevel 1 set "SRVCMD=py -m http.server %PORT% --bind 127.0.0.1"
)
if not defined SRVCMD (
  python -c "print(1)" >nul 2>nul
  if not errorlevel 1 set "SRVCMD=python -m http.server %PORT% --bind 127.0.0.1"
)

if not defined SRVCMD goto :nofallback_server

echo Starting local server: %SRVCMD%
start "%SRVTITLE%" /min cmd /c %SRVCMD%

rem ---- wait until the server actually answers (max ~10 s) --------------------
set /a TRIES=0
:waitloop
where curl >nul 2>nul
if errorlevel 1 (
  rem no curl.exe on this Windows - just give the server a moment
  timeout /t 3 /nobreak >nul
  goto :ready
)
curl -s -o nul http://localhost:%PORT%/ && goto :ready
set /a TRIES+=1
if %TRIES% geq 20 goto :srvfail
timeout /t 1 /nobreak >nul 2>nul || ping -n 2 127.0.0.1 >nul
goto :waitloop

:ready
if not defined BROWSER goto :nobrowser

echo HT ECDIS - KIOSK MODE on %URL%
echo Browser: %BROWSER%
echo Quit with Alt+F4. Closing the browser stops the server.

rem --kiosk                            real fullscreen, no browser UI, no exit button
rem --user-data-dir                    own profile (no bookmarks bar, no restore bubble)
rem --overscroll-history-navigation=0  stop swipe-back from leaving the chart
start "" /wait "%BROWSER%" --kiosk --user-data-dir="%PROFILE%" --no-first-run --no-default-browser-check --noerrdialogs --disable-infobars --disable-session-crashed-bubble --disable-features=TranslateUI,Translate --overscroll-history-navigation=0 --autoplay-policy=no-user-gesture-required "%URL%"
goto :stop

:nobrowser
echo.
echo No Chrome/Edge/Brave found - cannot start hint-free kiosk mode.
echo Opening your default browser instead; press F11 for fullscreen.
start "" "%URL%"
echo.
echo Press any key to STOP the server and close this window.
pause >nul
goto :stop

:srvfail
echo.
echo ERROR: the local server did not answer on port %PORT%.
echo Try another port:  run-kiosk.bat 9000
echo.
pause
goto :stop

:nofallback_server
echo.
echo Neither Node.js nor Python found - cannot start the local web server.
echo   Install Node.js:  https://nodejs.org   (recommended - enables live tide data)
echo   or Python:        https://python.org
if not defined BROWSER goto :nothing_at_all
echo.
echo Opening the demo DIRECTLY from disk as a fallback (works, but device GPS,
echo the data proxy and the Helm Console link need the local server).
start "" /wait "%BROWSER%" --kiosk --user-data-dir="%PROFILE%" --no-first-run --no-default-browser-check --noerrdialogs --disable-infobars --disable-session-crashed-bubble --overscroll-history-navigation=0 "file:///%~dp0ht-ecdis.html?kiosk=1"
goto :end

:nothing_at_all
echo No browser for kiosk mode found either. Install Node.js and Chrome/Edge.
echo.
pause
goto :end

:stop
taskkill /FI "WINDOWTITLE eq %SRVTITLE%*" /T /F >nul 2>nul

:end
endlocal
