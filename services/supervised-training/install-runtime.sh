#!/usr/bin/env bash
set -euo pipefail

RUNTIME_ROOT=/opt/agentland-training

python3.11 -m venv "$RUNTIME_ROOT/venv"
"$RUNTIME_ROOT/venv/bin/pip" install --upgrade pip
"$RUNTIME_ROOT/venv/bin/pip" install -r "$RUNTIME_ROOT/current/requirements.txt"
"$RUNTIME_ROOT/venv/bin/pip" install --no-deps rtmlib==0.0.15
