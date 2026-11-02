#!/usr/bin/env sh
cd "$(dirname "$0")" || exit 1
if command -v node >/dev/null 2>&1; then
  rm -f .kurukkanmoola-port
  node server.mjs &
  PID=$!
  for i in $(seq 1 30); do
    if [ -f .kurukkanmoola-port ]; then break; fi
    sleep 1
  done
  if [ ! -f .kurukkanmoola-port ]; then
    echo 'Server did not start.'
    kill "$PID" 2>/dev/null || true
    exit 1
  fi
  PORT=$(cat .kurukkanmoola-port)
  URL="http://localhost:${PORT}"
  echo "Kurukkanmoola X is running at $URL"
  if command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1 &
  elif command -v open >/dev/null 2>&1; then open "$URL"
  fi
  wait "$PID"
elif command -v python3 >/dev/null 2>&1; then
  echo 'Python fallback mode does not provide multiplayer APIs. Install Node.js for Kurukkanmoola X multiplayer.'
  python3 -m http.server 8080 --bind 127.0.0.1
else
  echo 'Install Node.js.'
  exit 1
fi
