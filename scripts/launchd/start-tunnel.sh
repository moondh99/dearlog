#!/bin/zsh -l
# Dearlog Cloudflare Named Tunnel(dearlog)을 자동 실행합니다. (launchd가 호출)
set -e
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
exec cloudflared tunnel run dearlog
