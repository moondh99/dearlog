#!/bin/zsh -l
# Dearlog 로컬 API 서버를 자동 실행합니다. (launchd가 호출)
set -e
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.nvm/versions/node/*/bin:$PATH"
cd "/Users/moondh/Downloads/디어로그"
exec npm run server:dev
