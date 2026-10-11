#!/usr/bin/env bash
#
# Fingerprint Lab — all commands, no npm.
#
#   ./run.sh serve      serve on http://localhost:8000
#   ./run.sh build      build the standalone single-file page
#   ./run.sh verify     run the dependency-free checks
#   ./run.sh open       serve, then open the standalone build in a browser
#
# There is nothing to install. The site is hand-written HTML, CSS and
# JavaScript with zero dependencies, by design.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-8000}"

case "${1:-serve}" in

  serve)
    echo "Fingerprint Lab  ->  http://localhost:$PORT"
    echo
    echo "The page needs no install step and makes no network requests."
    echo "Ctrl-C to stop."
    echo
    cd "$ROOT/docs"
    exec python3 -m http.server "$PORT" --bind 127.0.0.1
    ;;

  build)
    if ! command -v node >/dev/null 2>&1; then
      echo "node not found — needed only to bundle the standalone build."
      echo "The site itself does not need node. Skip this with: ./run.sh serve"
      exit 1
    fi
    exec node "$ROOT/tools/build-standalone.mjs"
    ;;

  verify)
    exec python3 "$ROOT/tools/verify.py"
    ;;

  open)
    if [ ! -f "$ROOT/dist/fingerprint-lab.html" ]; then
      echo "Standalone build missing — building it first."
      "$0" build
    fi
    echo "Opening dist/fingerprint-lab.html — no server required."
    if command -v xdg-open >/dev/null 2>&1; then
      xdg-open "$ROOT/dist/fingerprint-lab.html"
    elif command -v open >/dev/null 2>&1; then
      open "$ROOT/dist/fingerprint-lab.html"
    else
      echo "No opener found. Open it manually:"
      echo "  $ROOT/dist/fingerprint-lab.html"
    fi
    ;;

  *)
    echo "usage: ./run.sh {serve|build|verify|open}" >&2
    exit 2
    ;;
esac