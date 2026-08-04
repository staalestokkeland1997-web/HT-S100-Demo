#!/usr/bin/env sh
# Run the HT ECDIS demo on a local machine.
# Starts a small static web server in this folder and opens the demo
# in your default browser. Requires python3, python or node on PATH.

PORT="${1:-8000}"
URL="http://localhost:$PORT/"

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR" || exit 1

open_browser() {
  # Give the server a moment to start, then open the demo.
  ( sleep 1
    if command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"
    elif command -v open >/dev/null 2>&1; then open "$URL"
    else echo ">> Open $URL in your browser."
    fi ) &
}

echo "HT ECDIS demo — serving $DIR on $URL  (Ctrl+C to stop)"

if command -v python3 >/dev/null 2>&1; then
  open_browser
  exec python3 -m http.server "$PORT" --bind 127.0.0.1
elif command -v python >/dev/null 2>&1; then
  open_browser
  exec python -m http.server "$PORT" --bind 127.0.0.1
elif command -v node >/dev/null 2>&1; then
  open_browser
  exec node server.js "$PORT"
else
  echo "Error: need python3, python or node installed to serve the demo." >&2
  echo "Install one of them, or serve this folder with any static web server." >&2
  exit 1
fi
