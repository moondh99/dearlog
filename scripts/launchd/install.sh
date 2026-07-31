#!/bin/zsh
# Dearlog 서버/터널 launchd 자동 실행 설정 설치 스크립트
set -e

# 이 스크립트가 있는 곳에서 저장소 위치를 구합니다. 저장소를 옮기거나 폴더 이름을 바꾼 뒤
# 다시 실행하기만 하면 됩니다. 예전에는 경로가 박혀 있어 폴더명을 바꾸자 자동 실행이
# 조용히 멈췄고, launchd는 실패를 눈에 띄게 알려 주지 않았습니다.
DIR="${0:A:h}"
REPO_ROOT="${DIR:h:h}"
UID_NUM=$(id -u)
DEST="$HOME/Library/LaunchAgents"
mkdir -p "$DEST" "$DIR/logs"

# 저장소의 plist는 __DEARLOG_ROOT__ 자리표시자를 쓰는 템플릿입니다.
# 설치 시점에 실제 경로로 채워 LaunchAgents로 복사합니다.
for label in com.dearlog.server com.dearlog.cloudflared; do
  sed "s|__DEARLOG_ROOT__|$REPO_ROOT|g" "$DIR/$label.plist" > "$DEST/$label.plist"
done

for label in com.dearlog.server com.dearlog.cloudflared; do
  launchctl bootout "gui/$UID_NUM" "$DEST/$label.plist" 2>/dev/null || true
  launchctl bootstrap "gui/$UID_NUM" "$DEST/$label.plist"
  launchctl enable "gui/$UID_NUM/$label"
done

echo "설치 완료. 저장소 경로: $REPO_ROOT"
launchctl print "gui/$UID_NUM/com.dearlog.server" | head -5
launchctl print "gui/$UID_NUM/com.dearlog.cloudflared" | head -5
