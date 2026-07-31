#!/bin/zsh -l
# Dearlog 로컬 API 서버를 자동 실행합니다. (launchd가 호출)
set -e
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.nvm/versions/node/*/bin:$PATH"

# 저장소 위치를 스크립트 자신의 경로에서 구합니다.
# 예전에는 절대 경로가 박혀 있어 폴더 이름을 바꾸자 자동 실행이 조용히 멈췄습니다.
# ${0:A:h} 는 zsh에서 이 스크립트가 실제로 있는 디렉터리입니다.
cd "${0:A:h}/../.."

exec npm run server:dev
