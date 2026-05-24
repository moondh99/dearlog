const LOOSE_TOPIC_WORDS = [
  '어머니', '아버지', '학교', '친구', '직장', '가족', '사진', '결혼', '아이', '고향',
  '마음', '기억', '그때', '시절', '사람', '장소',
];

function tokenize(text: string) {
  return text
    .replace(/[^\p{Letter}\p{Number}\s]/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

export function isFreeSpeech(input: { questionText?: string | null; transcriptText: string }) {
  const transcript = input.transcriptText.trim();
  if (transcript.length < 18) return false;
  if (!input.questionText) return LOOSE_TOPIC_WORDS.every((word) => !transcript.includes(word));

  const questionTokens = new Set(tokenize(input.questionText));
  const answerTokens = tokenize(transcript);
  const overlap = answerTokens.filter((token) => questionTokens.has(token)).length;
  const hasLifeTopic = LOOSE_TOPIC_WORDS.some((word) => transcript.includes(word));

  // 질문과 거의 겹치지 않으면서 생활사 단서도 약하면 자유 발화로 저장합니다.
  return overlap === 0 && !hasLifeTopic && transcript.length >= 30;
}
