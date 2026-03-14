#!/usr/bin/env bash
# Run the SaaS web frontend. Executes from project root.
set -e
cd "$(dirname "$0")/.."
exec ./run_web.sh
