#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
echo "[信息] 正在启动群岛前线。"
echo "[INFO] Starting Archipelago Frontline."
python3 scripts/start_server.py
