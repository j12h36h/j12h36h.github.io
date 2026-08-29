#!/usr/bin/env bash
set -euo pipefail
PROJECT_DOMAIN="https://logicalcommunicationservice.firebaseapp.com"
ROOT="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$ROOT/__/auth" "$ROOT/__/firebase"
for f in handler handler.js experiments.js iframe iframe.js links links.js; do
  echo "Fetching /__/auth/$f"
  curl -fL "$PROJECT_DOMAIN/__/auth/$f" -o "$ROOT/__/auth/$f"
done
curl -fL "$PROJECT_DOMAIN/__/firebase/init.json" -o "$ROOT/__/firebase/init.json"
echo "Firebase auth helpers downloaded into /__/. Commit the __ directory with the site."
echo "Done: $ROOT/__/auth and $ROOT/__/firebase/init.json"
