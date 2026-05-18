import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const colors = {
  bg: '#FDFAF6',
  surface: '#FFFFFF',
  surfaceAlt: '#FAF7F2',
  border: '#E8DDD0',
  borderStrong: '#D4C5B0',
  text: '#1C1917',
  muted: '#78716C',
  subtle: '#A8A29E',
  primary: '#B45309',
  primaryLight: '#D97706',
  primaryPale: '#FEF3C7',
  secondary: '#0F766E',
  secondaryPale: '#CCFBF1',
  success: '#15803D',
  error: '#B91C1C',
};

const font = "'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', Arial, sans-serif";

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function wrap(text, limit) {
  const words = String(text).split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > limit && current) {
      lines.push(current);
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
  }
  if (current) lines.push(current);
  return lines;
}

function textBlock(text, x, y, options = {}) {
  const {
    size = 18,
    weight = 600,
    fill = colors.text,
    width = 24,
    lineHeight = Math.round(size * 1.38),
    anchor = 'start',
  } = options;
  const lines = Array.isArray(text) ? text : wrap(text, width);
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" fill="${fill}">
${lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${esc(line)}</tspan>`).join('\n')}
</text>`;
}

function rect(x, y, w, h, options = {}) {
  const {
    fill = colors.surface,
    stroke = colors.border,
    radius = 18,
    strokeWidth = 1,
    opacity = 1,
    extra = '',
  } = options;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}" ${extra}/>`;
}

function pill(label, x, y, options = {}) {
  const {
    fill = colors.primaryPale,
    stroke = 'none',
    color = colors.primary,
    width = Math.max(84, label.length * 13 + 28),
  } = options;
  return `${rect(x, y, width, 34, { fill, stroke, radius: 17 })}
${textBlock(label, x + width / 2, y + 22, { size: 13, weight: 800, fill: color, anchor: 'middle', width: 20 })}`;
}

function arrow(x1, y1, x2, y2, color = colors.borderStrong) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2.5" stroke-linecap="round" marker-end="url(#arrow)"/>`;
}

function iconCircle(label, x, y, options = {}) {
  const {
    fill = colors.primary,
    color = '#FFFFFF',
    size = 36,
  } = options;
  return `<circle cx="${x}" cy="${y}" r="${size / 2}" fill="${fill}"/>
${textBlock(label, x, y + 5, { size: 13, weight: 900, fill: color, anchor: 'middle', width: 4 })}`;
}

function phoneFrame(title, subtitle, x, y, body, options = {}) {
  const w = 390;
  const h = 844;
  const fill = options.fill ?? colors.bg;
  return `<g id="${esc(title)}" transform="translate(${x} ${y})">
${rect(0, 0, w, h, { fill: '#111111', stroke: '#111111', radius: 44 })}
${rect(10, 10, w - 20, h - 20, { fill, stroke: '#222222', radius: 36 })}
<rect x="145" y="22" width="100" height="24" rx="12" fill="#111111"/>
${textBlock(title, 28, 72, { size: 24, weight: 900, width: 19 })}
${textBlock(subtitle, 28, 102, { size: 13, weight: 650, fill: colors.muted, width: 36 })}
${body}
</g>`;
}

function tabletFrame(title, subtitle, x, y, body) {
  const w = 768;
  const h = 1024;
  return `<g id="${esc(title)}" transform="translate(${x} ${y})">
${rect(0, 0, w, h, { fill: '#111111', stroke: '#111111', radius: 36 })}
${rect(14, 14, w - 28, h - 28, { fill: colors.bg, stroke: '#222222', radius: 26 })}
${textBlock(title, 42, 70, { size: 28, weight: 900, width: 22 })}
${textBlock(subtitle, 42, 104, { size: 14, weight: 650, fill: colors.muted, width: 64 })}
${body}
</g>`;
}

function button(label, x, y, w, variant = 'primary') {
  const fill = variant === 'secondary' ? colors.secondary : variant === 'ghost' ? colors.surfaceAlt : colors.primary;
  const stroke = variant === 'ghost' ? colors.border : fill;
  const color = variant === 'ghost' ? colors.text : '#FFFFFF';
  return `${rect(x, y, w, 52, { fill, stroke, radius: 16 })}
${textBlock(label, x + w / 2, y + 33, { size: 15, weight: 850, fill: color, anchor: 'middle', width: 24 })}`;
}

function input(label, value, x, y, w) {
  return `${textBlock(label, x, y, { size: 12, weight: 800, fill: colors.muted, width: 18 })}
${rect(x, y + 12, w, 52, { fill: colors.surface, stroke: colors.border, radius: 14 })}
${textBlock(value, x + 16, y + 44, { size: 15, weight: 650, fill: colors.text, width: 24 })}`;
}

function bottomNav(active, y = 770) {
  const items = [
    ['말씀', '●'],
    ['보관함', '▣'],
    ['가족', '◎'],
    ['분신', '◇'],
    ['자서전', '□'],
  ];
  return `<g>
${rect(22, y, 346, 58, { fill: colors.surface, stroke: colors.border, radius: 24 })}
${items.map((item, index) => {
    const x = 56 + index * 68;
    const activeItem = item[0] === active;
    return `<g>
${textBlock(item[1], x, y + 22, { size: 14, weight: 900, fill: activeItem ? colors.primary : colors.subtle, anchor: 'middle', width: 3 })}
${textBlock(item[0], x, y + 43, { size: 11, weight: 800, fill: activeItem ? colors.primary : colors.muted, anchor: 'middle', width: 5 })}
</g>`;
  }).join('\n')}
</g>`;
}

function journeyRail(x, y, compact = false) {
  const stages = ['회상', '정리', '가족', '분신', '자서전'];
  const gap = compact ? 64 : 126;
  return `<g transform="translate(${x} ${y})">
${stages.map((stage, index) => {
    const fill = index === 0 ? colors.primary : index < 2 ? colors.secondaryPale : colors.surfaceAlt;
    const stroke = index === 0 ? colors.primary : colors.border;
    const color = index === 0 ? '#FFFFFF' : index < 2 ? colors.secondary : colors.muted;
    return `<g transform="translate(${index * gap} 0)">
${rect(0, 0, compact ? 54 : 104, 34, { fill, stroke, radius: 17 })}
${textBlock(`${index + 1}. ${stage}`, compact ? 27 : 52, 22, { size: compact ? 11 : 13, weight: 850, fill: color, anchor: 'middle', width: 8 })}
</g>`;
  }).join('\n')}
</g>`;
}

function card(title, body, x, y, w, h, accent = colors.primary) {
  return `${rect(x, y, w, h, { fill: colors.surface, stroke: colors.border, radius: 18 })}
<rect x="${x}" y="${y}" width="6" height="${h}" rx="3" fill="${accent}"/>
${textBlock(title, x + 20, y + 30, { size: 16, weight: 900, width: Math.floor(w / 14) })}
${textBlock(body, x + 20, y + 58, { size: 12, weight: 600, fill: colors.muted, width: Math.floor(w / 9), lineHeight: 17 })}`;
}

function authWelcomeBody() {
  return `
${iconCircle('D', 195, 188, { size: 74 })}
${textBlock('Dearlog', 195, 268, { size: 36, weight: 950, fill: colors.primary, anchor: 'middle', width: 12 })}
${textBlock('어르신의 이야기를 기억 카드와 자서전으로 이어갑니다.', 48, 318, { size: 17, weight: 700, fill: colors.text, width: 24, lineHeight: 24 })}
${card('오늘 할 일', '첫 회상을 편안하게 시작하고 가족에게 남길 이야기를 모읍니다.', 28, 392, 334, 112, colors.secondary)}
${button('휴대폰 번호로 시작하기', 28, 610, 334)}
${button('가족 초대 코드로 들어가기', 28, 674, 334, 'ghost')}
${textBlock('글자는 크게, 버튼은 한 손으로 누르기 쉽게 설계합니다.', 44, 742, { size: 12, weight: 700, fill: colors.subtle, width: 32 })}
`;
}

function phoneLoginBody() {
  return `
${textBlock('가입과 로그인을 같은 흐름으로 처리합니다.', 28, 146, { size: 17, weight: 750, width: 28, lineHeight: 25 })}
${input('휴대폰 번호', '010 1234 5678', 28, 222, 334)}
${button('인증번호 받기', 28, 322, 334)}
${card('보호 안내', '전화번호는 본인 확인과 가족 초대 연결에만 사용합니다.', 28, 412, 334, 112, colors.secondary)}
${button('처음으로', 28, 674, 160, 'ghost')}
${button('다음', 202, 674, 160)}
`;
}

function verificationBody() {
  return `
${textBlock('문자로 받은 6자리 인증번호를 입력합니다.', 28, 146, { size: 17, weight: 750, width: 28, lineHeight: 25 })}
${input('인증번호', '483 920', 28, 222, 334)}
${pill('02:41 남음', 28, 302, { fill: colors.secondaryPale, color: colors.secondary, width: 112 })}
${button('확인하고 계속', 28, 366, 334)}
${button('인증번호 다시 받기', 28, 430, 334, 'ghost')}
${card('오류 상태', '번호가 맞지 않으면 큰 글씨 안내와 재입력 CTA를 보여줍니다.', 28, 552, 334, 116, colors.error)}
`;
}

function roleSelectBody() {
  return `
${textBlock('누구의 이야기로 시작할까요?', 28, 146, { size: 23, weight: 950, width: 18 })}
${rect(28, 220, 334, 142, { fill: colors.primaryPale, stroke: colors.primary, radius: 22, strokeWidth: 2 })}
${iconCircle('어', 70, 274, { fill: colors.primary, size: 48 })}
${textBlock('어르신으로 시작', 108, 258, { size: 18, weight: 900, fill: colors.primary, width: 14 })}
${textBlock('내 이야기를 직접 남깁니다.', 108, 286, { size: 13, weight: 700, fill: colors.primary, width: 19 })}
${rect(28, 386, 334, 126, { fill: colors.surface, stroke: colors.border, radius: 22 })}
${iconCircle('가', 70, 440, { fill: colors.secondary, size: 48 })}
${textBlock('가족으로 참여', 108, 428, { size: 18, weight: 900, width: 14 })}
${textBlock('질문과 검수를 도와드립니다.', 108, 456, { size: 13, weight: 700, fill: colors.muted, width: 20 })}
${button('어르신으로 계속', 28, 640, 334)}
`;
}

function seniorProfileBody() {
  return `
${textBlock('편하게 불러드릴 이름과 기본 정보를 정합니다.', 28, 138, { size: 17, weight: 750, width: 27, lineHeight: 24 })}
${input('이름 또는 별명', '김영자', 28, 210, 334)}
${input('출생연도대', '1950년대', 28, 298, 334)}
${input('선호 호칭', '어르신', 28, 386, 334)}
${card('가족 초대', '지금 초대하지 않아도 회상 기록은 바로 시작할 수 있습니다.', 28, 488, 334, 110, colors.secondary)}
${button('가족 초대하기', 28, 632, 160, 'ghost')}
${button('건너뛰고 시작', 202, 632, 160)}
`;
}

function interviewBody(photo = false) {
  return `
${journeyRail(26, 126, true)}
${card('첫 질문', '어르신, 오늘 함께 인생의 소중한 조각들을 모아보고 싶습니다.', 28, 184, 334, 110, colors.primary)}
${rect(42, 318, 220, 72, { fill: colors.secondaryPale, stroke: colors.secondaryPale, radius: 20 })}
${textBlock('어릴 때 살던 동네가 생각나요...', 62, 350, { size: 15, weight: 700, width: 20, lineHeight: 21 })}
${photo ? `${rect(28, 414, 334, 154, { fill: colors.surface, stroke: colors.border, radius: 20 })}
${rect(48, 438, 102, 84, { fill: colors.primaryPale, stroke: colors.primaryPale, radius: 16 })}
${textBlock('사진', 99, 486, { size: 17, weight: 900, fill: colors.primary, anchor: 'middle', width: 5 })}
${textBlock('사진 속 장면 분석 완료', 168, 452, { size: 15, weight: 900, width: 17 })}
${textBlock('1970년대 추정 · 가족 · 부산 · 교복', 168, 480, { size: 12, weight: 700, fill: colors.muted, width: 20, lineHeight: 17 })}
${pill('사진으로 회상', 168, 524, { fill: colors.secondaryPale, color: colors.secondary, width: 126 })}` : `${card('회상 진행도', '응답 2개 · 인물 태그 1개 · 장소 태그 1개', 28, 430, 334, 112, colors.secondary)}`}
${rect(28, 646, 334, 70, { fill: colors.surface, stroke: colors.border, radius: 22 })}
${textBlock('말씀을 입력하거나 마이크를 눌러주세요', 52, 688, { size: 14, weight: 700, fill: colors.muted, width: 24 })}
${iconCircle('🎙', 318, 681, { fill: colors.primary, size: 42 })}
${bottomNav('말씀')}
`;
}

function archiveBody() {
  return `
${journeyRail(26, 126, true)}
${textBlock('최근 보관된 추억', 28, 184, { size: 22, weight: 950, width: 16 })}
${rect(28, 222, 334, 70, { fill: colors.surface, stroke: colors.border, radius: 18 })}
${pill('기억 카드 3', 44, 240, { width: 96 })}
${pill('태그 DB 12', 148, 240, { fill: colors.secondaryPale, color: colors.secondary, width: 96 })}
${card('사진 메타데이터 활용', '파일명, EXIF 촬영일, 카메라, GPS는 공개 전 확인합니다.', 28, 318, 334, 118, colors.secondary)}
${card('기억 카드', '엄마와 시장에 갔던 날 · 가족 공개 · 확인됨', 28, 458, 334, 120, colors.primary)}
${card('검증 필요', '시기나 장소가 애매한 이야기는 가족 질문으로 이어집니다.', 28, 600, 334, 104, colors.error)}
${bottomNav('보관함')}
`;
}

function familyBody() {
  return `
${journeyRail(26, 126, true)}
${textBlock('가족 공간', 28, 184, { size: 22, weight: 950, width: 12 })}
${card('어르신께 여쭤볼 질문', '할머니가 처음 서울에 올라오셨을 때 어떤 마음이셨나요?', 28, 230, 334, 128, colors.secondary)}
${rect(28, 386, 334, 118, { fill: colors.surface, stroke: colors.border, radius: 20 })}
${textBlock('공개 범위', 48, 420, { size: 16, weight: 900, width: 12 })}
${pill('나만 보기', 48, 444, { fill: colors.surfaceAlt, color: colors.muted, width: 88 })}
${pill('가족 공개', 146, 444, { fill: colors.primaryPale, color: colors.primary, width: 92 })}
${pill('전체 공개', 248, 444, { fill: colors.surfaceAlt, color: colors.muted, width: 88 })}
${card('동의 설정', '출판 · 가족열람 · 챗봇 · 사후공개 · 민감정보를 기억별로 조정합니다.', 28, 532, 334, 128, colors.primary)}
${bottomNav('가족')}
`;
}

function personaBody() {
  return `
${journeyRail(26, 126, true)}
${textBlock('나의 분신', 28, 184, { size: 22, weight: 950, width: 12 })}
${rect(28, 234, 286, 88, { fill: colors.secondaryPale, stroke: colors.secondaryPale, radius: 22 })}
${textBlock('오냐, 왔니? 궁금한 게 있으면 뭐든 물어보렴.', 48, 268, { size: 15, weight: 800, width: 24, lineHeight: 22 })}
${rect(82, 350, 280, 80, { fill: colors.primary, stroke: colors.primary, radius: 22 })}
${textBlock('할머니가 좋아하던 계절은 언제였어요?', 104, 384, { size: 15, weight: 800, fill: '#FFFFFF', width: 23, lineHeight: 22 })}
${card('근거 배지', '시장에 갔던 날 · 관련도 82% · 공개 범위 확인됨', 28, 466, 334, 110, colors.secondary)}
${rect(28, 650, 334, 58, { fill: colors.surface, stroke: colors.border, radius: 20 })}
${textBlock('분신에게 물어볼 내용', 50, 686, { size: 14, weight: 700, fill: colors.muted, width: 20 })}
${bottomNav('분신')}
`;
}

function autobiographyBody() {
  return `
${journeyRail(26, 126, true)}
${textBlock('자서전', 28, 184, { size: 22, weight: 950, width: 10 })}
${rect(28, 236, 334, 70, { fill: colors.surface, stroke: colors.border, radius: 18 })}
${textBlock('문체 선택', 48, 264, { size: 14, weight: 900, width: 10 })}
${pill('회고문', 142, 254, { fill: colors.primaryPale, color: colors.primary, width: 78 })}
${pill('기사체', 228, 254, { fill: colors.surfaceAlt, color: colors.muted, width: 78 })}
${button('자서전 생성하기', 28, 338, 334)}
${card('목차 미리보기', '1. 어린 시절  2. 가족  3. 일과 전환점  4. 전하고 싶은 말', 28, 430, 334, 128, colors.primary)}
${card('가족 검수 코멘트', '챕터별 출처와 코멘트를 남기고 PDF로 내려받습니다.', 28, 590, 334, 112, colors.secondary)}
${bottomNav('자서전')}
`;
}

function settingsBody() {
  return `
${textBlock('설정', 28, 126, { size: 24, weight: 950, width: 8 })}
${card('사후 이용 정책', '전체 공개 · 현재 설정 유지 · 전체 삭제 중 선택하고 이중 확인합니다.', 28, 184, 334, 128, colors.primary)}
${card('기억 검색 연결', '나의 분신과 가족 일정 알림에서 찾을 수 있게 색인합니다.', 28, 336, 334, 118, colors.secondary)}
${card('가족 일정', '생일, 기념일, 제사 등 일정 기반 회상 질문을 만듭니다.', 28, 478, 334, 118, colors.secondary)}
${card('민감 정보', 'GPS/EXIF 등 사진 메타데이터는 가족 공개 전에 확인합니다.', 28, 620, 334, 104, colors.error)}
`;
}

const journeySteps = [
  ['회원가입/로그인', '휴대폰 번호 입력', '초대 코드는 선택 흐름', '인증 세션'],
  ['역할 선택', '어르신으로 시작', '가족은 초대 후 참여', '역할/프로필'],
  ['기본 프로필', '이름, 출생연도대, 호칭', '초대 수락 대기', '사용자 설정'],
  ['첫 회상', '음성/텍스트로 이야기', '질문 후보 등록', '세션/녹취'],
  ['사진 회상', '사진 선택 후 이야기', '사진 확인 가능', '사진/EXIF/태그'],
  ['기억 카드', 'AI 교정본 확인', '가족 공개 후보', '기억 카드'],
  ['추억 보관함', '태그/타임라인 탐색', '공개 기억 열람', '태그 DB/RAG'],
  ['가족 공간', '공개 범위 동의', '질문/검수 코멘트', '동의/질문 상태'],
  ['나의 분신', '기억 기반 대화', '가족 질문 가능', '근거 배지'],
  ['자서전', '문체 선택 후 생성', '챕터 검수', '챕터/PDF'],
  ['설정', '사후 정책 설정', '일정 등록', '정책/캘린더'],
];

function journeyMap() {
  const x = 80;
  const y = 150;
  const colW = 205;
  const rowH = 142;
  const lanes = ['어르신 행동', '가족 행동', 'Dearlog AI/시스템', '생성/저장 데이터'];
  const laneColors = [colors.primaryPale, colors.secondaryPale, colors.surfaceAlt, '#FDE68A'];
  let output = `<g id="00 Service Journey Map">
${textBlock('00 Service Journey Map', 80, 72, { size: 34, weight: 950, width: 32 })}
${textBlock('로그인/회원가입부터 설정까지 이어지는 Dearlog 모바일 우선 사용자 여정', 80, 110, { size: 16, weight: 650, fill: colors.muted, width: 70 })}
${lanes.map((lane, index) => `${rect(x, y + index * 56, 210, 42, { fill: laneColors[index], stroke: 'none', radius: 14 })}
${textBlock(lane, x + 18, y + 27 + index * 56, { size: 15, weight: 900, fill: index === 0 ? colors.primary : index === 1 ? colors.secondary : colors.text, width: 18 })}`).join('\n')}
`;

  journeySteps.forEach((step, index) => {
    const sx = x + 255 + index * colW;
    output += `<g transform="translate(${sx} ${y - 28})">
${rect(0, 0, 178, rowH + 196, { fill: colors.surface, stroke: colors.border, radius: 18 })}
${textBlock(`${index + 1}. ${step[0]}`, 16, 32, { size: 15, weight: 950, fill: colors.text, width: 15 })}
${textBlock(step[1], 16, 86, { size: 13, weight: 750, fill: colors.primary, width: 18, lineHeight: 18 })}
${textBlock(step[2], 16, 142, { size: 13, weight: 750, fill: colors.secondary, width: 18, lineHeight: 18 })}
${textBlock(index < 3 ? '계정/온보딩 처리' : index < 6 ? '인터뷰 분석과 카드화' : index < 9 ? '권한/검색/대화 연결' : '문서와 정책 관리', 16, 198, { size: 13, weight: 750, fill: colors.muted, width: 18, lineHeight: 18 })}
${textBlock(step[3], 16, 254, { size: 13, weight: 850, fill: colors.text, width: 18, lineHeight: 18 })}
</g>`;
    if (index < journeySteps.length - 1) {
      output += arrow(sx + 178, y + 142, sx + colW, y + 142, colors.primaryLight);
    }
  });

  output += `</g>`;
  return output;
}

function mobileWireframes() {
  const frames = [
    ['Auth / Welcome', '휴대폰 기반 진입', authWelcomeBody()],
    ['Auth / Phone Login', '번호 입력과 보호 안내', phoneLoginBody()],
    ['Auth / Verification', '인증번호 확인', verificationBody()],
    ['Onboarding / Role Select', '어르신 우선 역할 선택', roleSelectBody()],
    ['Onboarding / Senior Profile', '기본 프로필과 가족 초대', seniorProfileBody()],
    ['Interview / First Memory', '첫 회상 인터뷰', interviewBody(false)],
    ['Interview / Photo Recall', '사진 분석 기반 회상', interviewBody(true)],
    ['Archive / Summary', '태그/사진/메타데이터 보관함', archiveBody()],
    ['Family / Review & Questions', '질문, 공개 범위, 동의', familyBody()],
    ['Persona / Chat', '근거 기반 분신 대화', personaBody()],
    ['Autobiography / Generate', '문체 선택과 생성', autobiographyBody()],
    ['Settings / Consent & Policy', '사후 정책과 일정', settingsBody()],
  ];
  const startX = 80;
  const startY = 720;
  const gapX = 455;
  const gapY = 930;
  let output = `<g id="01 Mobile Wireframes">
${textBlock('01 Mobile Wireframes', 80, 650, { size: 34, weight: 950, width: 26 })}
${textBlock('스마트폰 390x844 기준. 로그인부터 기억 카드 생성과 후속 여정까지 CTA가 이어지도록 구성.', 80, 688, { size: 16, weight: 650, fill: colors.muted, width: 82 })}`;

  frames.forEach((frame, index) => {
    const col = index % 4;
    const row = Math.floor(index / 4);
    output += phoneFrame(frame[0], frame[1], startX + col * gapX, startY + row * gapY, frame[2]);
  });
  output += '</g>';
  return output;
}

function tabletDashboardBody() {
  return `
${journeyRail(42, 132, false)}
${rect(42, 194, 190, 760, { fill: colors.surface, stroke: colors.border, radius: 20 })}
${textBlock('Dearlog', 66, 238, { size: 24, weight: 950, fill: colors.primary, width: 12 })}
${['말씀 나누기', '추억 보관함', '가족 공간', '나의 분신', '자서전', '설정'].map((label, index) => `${rect(62, 284 + index * 58, 150, 42, { fill: index === 0 ? colors.primaryPale : colors.surfaceAlt, stroke: 'none', radius: 14 })}
${textBlock(label, 82, 311 + index * 58, { size: 14, weight: 850, fill: index === 0 ? colors.primary : colors.muted, width: 12 })}`).join('\n')}
${rect(258, 194, 458, 342, { fill: colors.surface, stroke: colors.border, radius: 24 })}
${textBlock('오늘의 회상 인터뷰', 292, 244, { size: 25, weight: 950, width: 20 })}
${card('AI 질문', '지난번 시장 이야기를 이어가 볼까요? 그날 함께 있던 분이 떠오르시나요?', 292, 288, 390, 112, colors.primary)}
${rect(292, 430, 390, 66, { fill: colors.surfaceAlt, stroke: colors.border, radius: 20 })}
${textBlock('말씀을 입력하거나 마이크를 누르세요', 318, 471, { size: 15, weight: 750, fill: colors.muted, width: 30 })}
${iconCircle('🎙', 650, 463, { fill: colors.primary, size: 42 })}
${rect(258, 568, 220, 172, { fill: colors.surface, stroke: colors.border, radius: 22 })}
${textBlock('보관함 요약', 286, 608, { size: 19, weight: 950, width: 12 })}
${textBlock('기억 카드 3 · 태그 12 · 사진 2', 286, 642, { size: 14, weight: 750, fill: colors.muted, width: 19 })}
${rect(496, 568, 220, 172, { fill: colors.surface, stroke: colors.border, radius: 22 })}
${textBlock('다음 단계', 524, 608, { size: 19, weight: 950, width: 12 })}
${textBlock('가족 질문 확인', 524, 642, { size: 14, weight: 850, fill: colors.primary, width: 16 })}
${button('가족 공간으로', 524, 674, 150)}
`;
}

function tabletJourneyBody() {
  return `
${rect(42, 142, 684, 790, { fill: colors.surface, stroke: colors.border, radius: 24 })}
${textBlock('태블릿에서는 여정과 작업 화면을 나란히 배치합니다.', 80, 196, { size: 24, weight: 950, width: 34 })}
${journeyRail(80, 242, false)}
${card('1. 회상 기록', '음성/텍스트/사진으로 기억을 수집합니다.', 80, 316, 290, 120, colors.primary)}
${card('2. 기억 정리', '태그 DB, 사진 메타데이터, 타임라인을 확인합니다.', 80, 462, 290, 120, colors.secondary)}
${card('3. 가족 확인', '질문과 공개 범위, 동의 설정을 다룹니다.', 80, 608, 290, 120, colors.primary)}
${card('4. 분신/자서전', '근거 기반 대화와 문체별 자서전 생성으로 확장합니다.', 400, 316, 290, 120, colors.secondary)}
${card('민감 정보 게이트', 'GPS/EXIF는 가족 공개 전 확인 CTA를 반드시 거칩니다.', 400, 462, 290, 120, colors.error)}
${card('완료 상태', '자서전 초안 생성 후 보관함 살펴보기로 순환합니다.', 400, 608, 290, 120, colors.success)}
`;
}

function tabletWireframes() {
  return `<g id="02 Tablet Wireframes">
${textBlock('02 Tablet Wireframes', 80, 3560, { size: 34, weight: 950, width: 28 })}
${textBlock('태블릿 768x1024 기준. 좌측 내비게이션과 넓은 작업 영역으로 정보 밀도를 조절.', 80, 3598, { size: 16, weight: 650, fill: colors.muted, width: 84 })}
${tabletFrame('Tablet / Home Journey', '메인 여정과 인터뷰 패널', 80, 3630, tabletDashboardBody())}
${tabletFrame('Tablet / Journey Detail', '단계별 상태와 민감 정보 게이트', 900, 3630, tabletJourneyBody())}
</g>`;
}

function components() {
  return `<g id="03 Components">
${textBlock('03 Components', 80, 4720, { size: 34, weight: 950, width: 20 })}
${textBlock('Figma 컴포넌트로 분리할 기본 요소: CTA, 여정 레일, 상태 칩, 기억 카드, 공개 범위 선택.', 80, 4758, { size: 16, weight: 650, fill: colors.muted, width: 84 })}
${rect(80, 4828, 420, 330, { fill: colors.surface, stroke: colors.border, radius: 24 })}
${textBlock('Buttons', 112, 4874, { size: 22, weight: 950, width: 10 })}
${button('Primary CTA', 112, 4910, 176)}
${button('Secondary CTA', 112, 4978, 176, 'secondary')}
${button('Ghost CTA', 112, 5046, 176, 'ghost')}
${rect(540, 4828, 520, 330, { fill: colors.surface, stroke: colors.border, radius: 24 })}
${textBlock('Journey Rail', 572, 4874, { size: 22, weight: 950, width: 14 })}
${journeyRail(572, 4920, false)}
${journeyRail(572, 4992, true)}
${rect(1100, 4828, 460, 330, { fill: colors.surface, stroke: colors.border, radius: 24 })}
${textBlock('Status Chips', 1132, 4874, { size: 22, weight: 950, width: 14 })}
${pill('완료', 1132, 4914, { fill: colors.secondaryPale, color: colors.secondary, width: 72 })}
${pill('현재', 1218, 4914, { fill: colors.primary, color: '#FFFFFF', width: 72 })}
${pill('대기', 1304, 4914, { fill: colors.surfaceAlt, color: colors.muted, width: 72 })}
${pill('잠김', 1390, 4914, { fill: colors.surfaceAlt, color: colors.subtle, width: 72 })}
${card('Memory Card', '주제 · 날짜 · 공개 범위 · 확인됨 · 연결 사진 1개', 1132, 4984, 380, 112, colors.primary)}
${rect(80, 5200, 660, 280, { fill: colors.surface, stroke: colors.border, radius: 24 })}
${textBlock('Privacy Selector', 112, 5246, { size: 22, weight: 950, width: 18 })}
${pill('나만 보기', 112, 5294, { fill: colors.surfaceAlt, color: colors.muted, width: 108 })}
${pill('가족 공개', 236, 5294, { fill: colors.primaryPale, color: colors.primary, width: 108 })}
${pill('전체 공개', 360, 5294, { fill: colors.surfaceAlt, color: colors.muted, width: 108 })}
${textBlock('민감정보 공개 전에는 GPS/EXIF 확인 CTA를 카드 하단에 배치합니다.', 112, 5366, { size: 15, weight: 700, fill: colors.muted, width: 54 })}
</g>`;
}

const svgWidth = 2600;
const svgHeight = 5560;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
<defs>
  <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
    <path d="M0,0 L0,6 L9,3 z" fill="${colors.borderStrong}" />
  </marker>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000000" flood-opacity="0.08"/>
  </filter>
</defs>
<style>
  text { font-family: ${font}; letter-spacing: 0; }
</style>
<rect width="${svgWidth}" height="${svgHeight}" fill="${colors.bg}"/>
${journeyMap()}
${mobileWireframes()}
${tabletWireframes()}
${components()}
</svg>`;

const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Dearlog Mobile Journey + Wireframes</title>
  <style>
    :root {
      --bg: ${colors.bg};
      --surface: ${colors.surface};
      --border: ${colors.border};
      --text: ${colors.text};
      --muted: ${colors.muted};
      --primary: ${colors.primary};
      --secondary: ${colors.secondary};
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: ${font};
    }
    header {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 18px 28px;
      background: rgba(255,255,255,0.92);
      border-bottom: 1px solid var(--border);
      backdrop-filter: blur(12px);
    }
    h1 { margin: 0; color: var(--primary); font-size: 24px; }
    p { margin: 0; color: var(--muted); font-weight: 650; }
    nav { display: flex; gap: 8px; flex-wrap: wrap; }
    nav a {
      color: var(--text);
      text-decoration: none;
      border: 1px solid var(--border);
      background: var(--surface);
      border-radius: 999px;
      padding: 8px 12px;
      font-size: 13px;
      font-weight: 800;
    }
    main { padding: 24px; }
    .board {
      overflow: auto;
      border: 1px solid var(--border);
      border-radius: 24px;
      background: white;
      box-shadow: 0 8px 24px rgba(0,0,0,0.06);
    }
    svg { display: block; max-width: none; }
    .note {
      margin: 0 0 16px;
      padding: 16px 18px;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: var(--surface);
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Dearlog Mobile Journey + Wireframes</h1>
      <p>Figma import-ready SVG, smartphone 390x844, tablet 768x1024.</p>
    </div>
    <nav>
      <a href="#00 Service Journey Map">00 Journey</a>
      <a href="#01 Mobile Wireframes">01 Mobile</a>
      <a href="#02 Tablet Wireframes">02 Tablet</a>
      <a href="#03 Components">03 Components</a>
    </nav>
  </header>
  <main>
    <div class="note">
      Figma 직접 편집 도구가 세션에 노출되지 않아, Figma에서 SVG로 가져올 수 있는 산출물을 생성했습니다.
      Figma에서 <strong>Place image</strong> 또는 드래그 앤 드롭으로 <code>dearlog-mobile-journey-wireframes.svg</code>를 가져오면 텍스트/벡터 기반 보드로 검토할 수 있습니다.
    </div>
    <div class="board">
      ${svg}
    </div>
  </main>
</body>
</html>`;

const readme = `# Dearlog Mobile Journey + Wireframes

This folder contains Figma import-ready design artifacts for the Dearlog mobile-first journey.

## Files

- \`dearlog-mobile-journey-wireframes.svg\`: Main Figma-importable board.
- \`dearlog-mobile-journey-wireframes.html\`: Browser review version with the same board embedded.
- \`generate-dearlog-wireflow.mjs\`: Generator used to keep the SVG and HTML in sync.

## Figma Structure Represented

- \`00 Service Journey Map\`: Full journey from login/signup to settings.
- \`01 Mobile Wireframes\`: Smartphone \`390x844\` frames.
- \`02 Tablet Wireframes\`: Tablet \`768x1024\` frames.
- \`03 Components\`: Buttons, journey rail, cards, status chips, privacy selector.

## Import Notes

The current Codex session did not expose a callable Figma editing tool after plugin installation, so the design is delivered as an SVG board that can be imported into Figma.
Open Figma and drag \`dearlog-mobile-journey-wireframes.svg\` onto the canvas.
`;

writeFileSync(join(__dirname, 'dearlog-mobile-journey-wireframes.svg'), svg);
writeFileSync(join(__dirname, 'dearlog-mobile-journey-wireframes.html'), html);
writeFileSync(join(__dirname, 'README.md'), readme);

console.log('Generated Dearlog journey wireflow artifacts in design/.');
