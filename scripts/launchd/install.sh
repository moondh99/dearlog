#!/bin/zsh
# Dearlog 서버/터널 launchd 자동 실행 설정 설치 스크립트
set -e
DIR="/Users/moondh/Downloads/디어로그/scripts/launchd"
UID_NUM=$(id -u)
DEST="$HOME/Library/LaunchAgents"
mkdir -p "$DEST"

cp "$DIR/com.dearlog.server.plist" "$DEST/"
cp "$DIR/com.dearlog.cloudflared.plist" "$DEST/"

for label in com.dearlog.server com.dearlog.cloudflared; do
  launchctl bootout "gui/$UID_NUM" "$DEST/$label.plist" 2>/dev/null || true
  launchctl bootstrap "gui/$UID_NUM" "$DEST/$label.plist"
  launchctl enable "gui/$UID_NUM/$label"
done

echo "설치 완료. 상태 확인:"
launchctl print "gui/$UID_NUM/com.dearlog.server" | head -5
launchctl print "gui/$UID_NUM/com.dearlog.cloudflared" | head -5
