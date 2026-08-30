#!/usr/bin/env bash
# Firebase emulators for local development.
#
# firebase-tools >=15 requires JDK 21+. openjdk@21 is installed keg-only via
# Homebrew so it does not disturb the system JDK; we point at it explicitly here
# rather than mutating the user's shell profile.
set -euo pipefail

if [ -d /opt/homebrew/opt/openjdk@21 ]; then
  export JAVA_HOME="/opt/homebrew/opt/openjdk@21"
  export PATH="$JAVA_HOME/bin:$PATH"
fi

cd "$(dirname "$0")/.."
exec firebase emulators:start \
  --only auth,firestore,database,storage \
  --project plotkraft-agentic "$@"
