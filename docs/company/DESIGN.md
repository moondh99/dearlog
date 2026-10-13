# 디자인 결정

## 방향

가족에게 건네는 편지와 기록집의 여백을 웹 편집 디자인으로 옮긴다. 부모님의 목소리가 가족의 기록이 되는 흐름을 실제 제품 화면으로 보여준다. 사진 속 가족을 임의로 만들어 실제 고객처럼 제시하지 않는다.

## 토큰

아이보리 `#f7f4ed`, 종이 `#fffcf7`, 잉크 `#302e29`, 보조 잉크 `#656258`, 선 `#ded9cd`, 올리브 `#52654b`. 기존 서비스의 라일락 UI는 제품 캡처 안에 그대로 유지해 서비스와 소개 페이지를 구분한다.

제목/기록 발췌는 마루 부리 SemiBold 600, 본문/UI는 Pretendard Variable 400/500/600. 폰트는 눈누와 원저작자 자료를 확인한 뒤 공개 정적 파일로 자체 호스팅한다. 기존 서비스의 Noto Sans KR/Serif KR는 변경하지 않는다.

## 구조

```
브랜드 | 기록 과정 · 서비스 화면 · 팀 소개 | 서비스 시작
한 줄 소개 + CTA                 실제 인터뷰 화면
가족의 미처 묻지 못한 이야기      설명용 기록 발췌 (명시)
질문 → 인터뷰 → 가족 검수 → 기록 (순서가 의미 있는 4단계)
실제 질문 / 검수 / 자서전 UI 세 화면 (가상 데이터 명시)
디어로그 팀                       작업 원칙
문의 이메일                       서비스 시작
```

데스크톱은 최대 1184px 편집형 그리드, 모바일은 같은 읽기 순서의 한 열이다. 과도한 카드, 추상 그라디언트, 가짜 KPI, 자동 영상·슬라이더를 쓰지 않는다. 실제 화면 3개가 핵심 근거다. 하나의 시각적 특징은 '질문 한 줄에서 가족의 기록으로' 이어지는 얇은 세로 기록선과 종이 위의 발췌다. 정보와 관계없는 번호/장식은 제외한다.

## 구현 경계

소개 페이지는 기존 390px 앱 레이아웃 바깥의 정확한 `/company` 경로에서만 렌더링한다. 기존 모바일 wrapper 및 모든 서비스 라우트는 유지한다. CSS는 `.company-page` 아래로 한정해 전역 서체/색/링크/버튼을 변경하지 않는다. 최초 화면은 기존 `/auth`로 연결하며 문의는 mailto다. 기존 스케줄 모니터가 소개 페이지에서 실행되지 않게 서비스 경계 안에 둔다.

제품 화면을 설명하는 이미지에는 alt, width/height를 제공한다. 가상 데이터로 캡처한 실제 UI임을 눈에 띄게 표시한다. 데이터가 들어간 기록 발췌는 '설명용 예시'로 구분한다. 기본 font-display swap, 로컬 폰트, 이미지 lazy loading(최초 이미지 제외), reduced motion을 지원한다.

## 참고

- 요청 자료: https://github.com/VoltAgent/awesome-agent-skills
- 요청 자료: https://noonnu.cc/
- 요청 자료: https://github.com/Q00/ouroboros/blob/main/README.ko.md
- 로컬 frontend-design: 주제에 근거한 타이포·여백·단일 시각적 특징, 구현 전 계획/비평.
- 로컬 emil-design-eng: 읽기 순서, 명확한 focus, reduced-motion, 짧은 상태 전환 원칙.
- https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/SKILL.md
- https://raw.githubusercontent.com/addyosmani/web-quality-skills/main/skills/accessibility/SKILL.md
- https://raw.githubusercontent.com/ibelick/ui-skills/main/skills/baseline-ui/SKILL.md

접근성은 본문 대비 4.5:1, 터치/키보드 링크 44px 이상, 17px 모바일 본문을 적용한다. 큰 글자는 W3C 기준 18pt(24 CSS px) 또는 14pt(18.67 CSS px) bold로 판단하며 외부 자료의 px/pt 오기를 그대로 따르지 않는다. 최종 브라우저 계산값의 최소 본문 대비는 5.02:1이다.

폰트 출처/전문은 `public/company/fonts/README.txt`, `MaruBuri-OFL.txt`, `Pretendard-LICENSE.txt`에 동봉했다. 마루 부리의 600은 400으로 오기하지 않는다. 원본 바이너리를 수정/서브셋 없이 배포한다.

자기 검토에서 320px 제목의 한국어 어절이 나뉘는 것을 확인해 h1/h2에 `word-break: keep-all`을 적용했다. 최초 서비스 화면은 가짜 활동 상태 없이 실제 녹음 대기 UI를 캡처했다. 실제 음성/이메일 전송을 수행했다고 표시하지 않는다.

외부 자료는 원칙만 참고한다. 원격 스크립트 설치, 에이전트 호출, Ouroboros CLI 실행 없음.
