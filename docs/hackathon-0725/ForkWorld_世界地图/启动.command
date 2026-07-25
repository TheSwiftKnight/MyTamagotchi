#!/bin/bash
# ForkWorld 世界地图 —— 双击本文件即可启动（Mac）
cd "$(dirname "$0")"
PORT=8200
echo "======================================"
echo "  ForkWorld · 世界地图"
echo "  正在 http://localhost:$PORT 启动..."
echo "  关闭本终端窗口即停止服务"
echo "======================================"
# 端口占用则自动 +1 找空闲端口
while lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; do PORT=$((PORT+1)); done
( sleep 1; open "http://localhost:$PORT/global.html?bg=1" ) &
python3 -m http.server $PORT
