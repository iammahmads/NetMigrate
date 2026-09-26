#!/bin/sh
set -e

# API-key auth is via environment variable, not an interactive login
# command — confirmed pattern per bob.ibm.com's auth method table.
# Verify BOBSHELL_API_KEY is the correct variable name before relying
# on this; set it at `docker run` time, never baked into the image.
: "${BOBSHELL_API_KEY:?BOBSHELL_API_KEY must be set}"

# Accept the license non-interactively on first run (required before
# any non-interactive bob -p call will work)
bob --accept-license -p "Confirm Bob Shell is ready" || { echo "Bob Shell auth/license check failed"; exit 1; }

exec "$@"