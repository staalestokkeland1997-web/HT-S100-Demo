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

setlocal
set PORT=%1
if "%PORT%"=="" set PORT=8000
set URL=http://localhost:%PORT%/?kiosk=1

cd /d "%~dp0"
rem Persistent browser profile: keeps the aisstream API key (localStorage) and
rem any granted GPS permission between kiosk launches.
set "PROFILE=%~dp0.kiosk-profile"
set "SRVTITLE=HT ECDIS kiosk server"

rem ---- find a Chromium-family browser ---------------------------------------
set "BROWSER="
for %%P in (
  "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
  "%LocalAppData%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
  "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
  "%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe"
) do if not defined BROWSER if exist %%P set "BROWSER=%%~P"

rem ---- start the local server ------------------------------------------------
rem node is preferred: server.js also provides the /proxy endpoint that unlocks
rem the CORS-blocked Kartverket tide feed.
where node >nul 2>nul
if %errorlevel%==0 (
  start "%SRVTITLE%" /min cmd /c node server.js %PORT%
  goto :served
)
where python >nul 2>nul
if %errorlevel%==0 (
  echo note: node not found - serving without the /proxy endpoint ^(no live tide data^).
  start "%SRVTITLE%" /min cmd /c python -m http.server %PORT% --bind 127.0.0.1
  goto :served
)
where py >nul 2>nul
if %errorlevel%==0 (
  echo note: node not found - serving without the /proxy endpoint ^(no live tide data^).
  start "%SRVTITLE%" /min cmd /c py -m http.server %PORT% --bind 127.0.0.1
  goto :served
)
echo Error: need Node.js or Python installed to serve the demo.
exit /b 1

:served
rem give the server a moment to bind the port
timeout /t 2 /nobreak >nul

if not defined BROWSER (
  echo.
  echo No Chrome/Edge/Brave found - cannot start hint-free kiosk mode.
  echo Opening your default browser instead; press F11 for fullscreen.
  start "" "%URL%"
  echo Close this window to stop the server.
  pause >nul
  goto :stop
)

echo HT ECDIS - KIOSK MODE on %URL%
echo Browser: %BROWSER%
echo Quit with Alt+F4. Closing the browser stops the server.

rem --kiosk                            real fullscreen, no browser UI, no exit button
rem --user-data-dir                    own profile (no bookmarks bar, no restore bubble)
rem --overscroll-history-navigation=0  stop swipe-back from leaving the chart
start "" /wait "%BROWSER%" ^
  --kiosk ^
  --user-data-dir="%PROFILE%" ^
  --no-first-run ^
  --no-default-browser-check ^
  --noerrdialogs ^
  --disable-infobars ^
  --disable-session-crashed-bubble ^
  --disable-features=TranslateUI,Translate ^
  --overscroll-history-navigation=0 ^
  --autoplay-policy=no-user-gesture-required ^
  "%URL%"

:stop
taskkill /FI "WINDOWTITLE eq %SRVTITLE%*" /T /F >nul 2>nul
endlocal
