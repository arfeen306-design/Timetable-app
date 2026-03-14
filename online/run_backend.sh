#!/usr/bin/env bash
# Run the SaaS backend. Executes from project root.
set -e
cd "$(dirname "$0")/.."
exec ./run_backend.sh
