#!/bin/zsh
# 현재 자동 실행 설정 여부와 동작 상태를 확인합니다.
UID_NUM=$(id -u)
echo "--- LaunchAgents 등록 여부 ---"
ls -la "$HOME/Library/LaunchAgents" | grep dearlog || echo "(등록된 plist 없음)"
echo "--- launchctl 상태 ---"
launchctl print "gui/$UID_NUM/com.dearlog.server" 2>&1 | head -10
launchctl print "gui/$UID_NUM/com.dearlog.cloudflared" 2>&1 | head -10
echo "--- 헬스체크 ---"
curl -s https://dear-log.com/api/health || echo "(응답 없음)"
