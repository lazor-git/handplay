#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
PIDFILE=/tmp/handplay-vite.pid

start() {
  if [ -f "$PIDFILE" ] && kill -0 "$(cat $PIDFILE)" 2>/dev/null; then
    echo "already running (pid $(cat $PIDFILE))"
    exit 0
  fi
  nohup npm run dev > /tmp/handplay-vite.log 2>&1 &
  echo $! > "$PIDFILE"
  echo "started — https://$(hostname -I | tr ' ' '\n' | grep -v ':' | head -1):5173/ (log: /tmp/handplay-vite.log)"
}

stop() {
  if [ -f "$PIDFILE" ] && kill -0 "$(cat $PIDFILE)" 2>/dev/null; then
    kill "$(cat $PIDFILE)"
    pkill -f "node.*vite" 2>/dev/null || true
    rm -f "$PIDFILE"
    echo "stopped"
  else
    pkill -f "node.*vite" 2>/dev/null && echo "stopped" || echo "not running"
    rm -f "$PIDFILE"
  fi
}

case "${1:-}" in
  start) start ;;
  stop) stop ;;
  restart) stop; sleep 1; start ;;
  status) [ -f "$PIDFILE" ] && kill -0 "$(cat $PIDFILE)" 2>/dev/null && echo "running (pid $(cat $PIDFILE))" || echo "not running" ;;
  *) echo "usage: $0 {start|stop|restart|status}" ;;
esac
