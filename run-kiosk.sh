#!/usr/bin/env sh
# Run the HT ECDIS demo in KIOSK MODE on a local machine (Linux / macOS).
#
# Starts the local server and opens the demo in a Chromium-family browser with
# --kiosk: real fullscreen with NO tab strip, NO address bar, NO "press Esc to
# exit" hint and NO close button. Closing the browser also stops the server.
#
#   ./run-kiosk.sh          # port 8000
#   ./run-kiosk.sh 9000     # custom port
#
# To quit the kiosk:  Alt+F4  (Linux)  /  Cmd+Q  (macOS)

PORT="${1:-8000}"
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR" || exit 1

URL="http://localhost:$PORT/?kiosk=1"
# Persistent browser profile: keeps the aisstream API key (localStorage) and any
# granted GPS permission between kiosk launches.
PROFILE="$DIR/.kiosk-profile"

SRV=""
cleanup() { [ -n "$SRV" ] && kill "$SRV" 2>/dev/null; }
trap cleanup EXIT INT TERM

# ---- start the local server ------------------------------------------------
# node is preferred: server.js also provides the /proxy endpoint that unlocks
# the CORS-blocked Kartverket tide feed.
if command -v node >/dev/null 2>&1; then
  node server.js "$PORT" & SRV=$!
elif command -v python3 >/dev/null 2>&1; then
  echo "note: node not found — serving without the /proxy endpoint (no live tide data)."
  python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 & SRV=$!
elif command -v python >/dev/null 2>&1; then
  echo "note: node not found — serving without the /proxy endpoint (no live tide data)."
  python -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 & SRV=$!
else
  echo "Error: need node, python3 or python installed to serve the demo." >&2
  exit 1
fi

# wait for the port to answer (max ~10 s)
i=0
while [ $i -lt 50 ]; do
  if command -v curl >/dev/null 2>&1; then
    curl -s -o /dev/null "http://localhost:$PORT/" && break
  else
    sleep 1; break
  fi
  i=$((i + 1)); sleep 0.2
done

# ---- find a Chromium-family browser ----------------------------------------
BROWSER=""
for c in chromium chromium-browser google-chrome google-chrome-stable brave-browser microsoft-edge; do
  if command -v "$c" >/dev/null 2>&1; then BROWSER="$(command -v "$c")"; break; fi
done
if [ -z "$BROWSER" ]; then
  for m in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
           "/Applications/Chromium.app/Contents/MacOS/Chromium" \
           "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
           "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"; do
    if [ -x "$m" ]; then BROWSER="$m"; break; fi
  done
fi

if [ -z "$BROWSER" ]; then
  echo ""
  echo "No Chrome/Chromium/Edge found — cannot start hint-free kiosk mode."
  echo "Opening your default browser instead; press F11 for fullscreen."
  echo "Serving $URL  (Ctrl+C to stop)"
  if command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"
  elif command -v open >/dev/null 2>&1; then open "$URL"
  fi
  wait "$SRV"
  exit 0
fi

echo "HT ECDIS — KIOSK MODE on $URL"
echo "Browser: $BROWSER"
echo "Quit with Alt+F4 (Linux) or Cmd+Q (macOS). Closing the browser stops the server."

# --kiosk                        real fullscreen, no browser UI, no exit button
# --user-data-dir                own profile (no bookmarks bar, no restore bubble)
# --overscroll-history-navigation=0   stop swipe-back from leaving the chart
"$BROWSER" \
  --kiosk \
  --user-data-dir="$PROFILE" \
  --no-first-run \
  --no-default-browser-check \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-features=TranslateUI,Translate \
  --overscroll-history-navigation=0 \
  --autoplay-policy=no-user-gesture-required \
  "$URL" >/dev/null 2>&1

# browser closed -> trap stops the server
