#!/usr/bin/env bash
set -euo pipefail

node "$(dirname "$0")/preflight.mjs"
node "$(dirname "$0")/gate-c-ambiguity.mjs"
node "$(dirname "$0")/witness-oracle.mjs"
