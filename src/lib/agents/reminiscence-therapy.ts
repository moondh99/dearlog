/**
 * Reminiscence Therapy Agent
 *
 * Generates sensory-focused prompts (visual, auditory, olfactory, tactile, gustatory)
 * to stimulate cognitive recall and emotional comfort for senior users.
 * Uses GPT-4o-mini with JSON response format for structured prompts.
 */

import { getOpenAIClient } from '../openai-client';

export type SensoryType = 'visual' | 'auditory' | 'olfactory' | 'tactile' | 'gustatory' | 'general';

export interface SensoryPrompt {
  sensoryType: SensoryType;
  promptText: string; // The natural-language question for the senior
  relevanceReason: string; // Internal explanation of how this prompt helps trigger memories
}

/**
 * Generates sensory-based therapy questions based on the chapter title and past recollections.
 */
export async function generateSensoryPrompts(
  chapterTitle: string,
  pastMemories: string[]
): Promise<SensoryPrompt[]> {
  const systemPrompt = `당신은 노인 심리 회상 테라피(Reminiscence Therapy) 전문가입니다.
주어진 자서전 챕터 주제와 이전에 기록된 과거 기억들을 분석하여, 시니어의 장기 기억과 뇌의 인지 기능(오감 인지)을 효과적으로 자극하고 정서적 위안을 줄 수 있는 질문 세트를 만드세요.

각 질문은 다음 5가지 감각 유형 중 하나 이상을 골라 설계되어야 합니다:
- "visual" (시각): 선명한 풍경, 색상, 빛, 모양의 회상
- "auditory" (청각): 자연 소리, 당시 음악, 대화 소리, 주변 소음의 회상
- "olfactory" (후각): 밥 짓는 냄새, 시골 냄새, 꽃 향기, 계절 냄새 등의 회상
- "tactile" (촉각): 흙의 질감, 부모님의 손길, 옷감의 촉감, 온도 등의 회상
- "gustatory" (미각): 그 시절 먹었던 고유한 음식 맛, 간식 등의 회상

반드시 아래 JSON 형식으로만 변환하여 반환하십시오:
{
  "prompts": [
    {
      "sensoryType": "감각 유형 (visual | auditory | olfactory | tactile | gustatory | general)",
      "promptText": "시니어에게 다정하게 말을 건네는 오감 자극 질문",
      "relevanceReason": "이 질문이 시니어의 인지적 자극과 기억 회상에 어떻게 도움을 주는지 치료적 이유 설명"
    }
  ]
}

주의사항:
- 시니어의 연령대(보통 70대 이상)에 어울리는 다정하고 따뜻한 격식체 종결어미(~하셨나요?, ~시지요?, ~겠지요?)를 사용하세요.
- 질문 텍스트(promptText)는 친근하게 귓가에 속삭이듯 작성하여 시니어가 대화에 편하게 응할 수 있도록 하세요.
- 과거 기억(pastMemories)과 모순되거나 중복되지 않도록 하되, 과거에 나눴던 에피소드를 기반으로 오감 디테일을 유도할 수 있는 단서를 질문에 담으면 매우 좋습니다.`;

  const memoriesExcerpt = pastMemories.length > 0 
    ? pastMemories.map((m, idx) => `[이전 기억 ${idx + 1}] ${m}`).join('\n')
    : '이전 기록 없음 (이 챕터가 첫 대화 시작점임)';

  const userPrompt = `[자서전 챕터] ${chapterTitle}\n\n[이전 기억 데이터]\n${memoriesExcerpt}\n\n위 정보를 바탕으로 오감을 자극하는 회상 요법 질문들을 3~5개 제안해 주세요.`;

  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.6,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      return getDefaultPrompts(chapterTitle);
    }

    const parsed = JSON.parse(content);
    if (!parsed || !Array.isArray(parsed.prompts)) {
      return getDefaultPrompts(chapterTitle);
    }

    return parsed.prompts.map((p: any) => ({
      sensoryType: validateSensoryType(p.sensoryType),
      promptText: typeof p.promptText === 'string' ? p.promptText : '',
      relevanceReason: typeof p.relevanceReason === 'string' ? p.relevanceReason : '',
    }));
  } catch (error) {
    console.error('Reminiscence Therapy Agent Error:', error);
    return getDefaultPrompts(chapterTitle);
  }
}

function validateSensoryType(type: unknown): SensoryType {
  const validTypes: SensoryType[] = ['visual', 'auditory', 'olfactory', 'tactile', 'gustatory', 'general'];
  if (typeof type === 'string' && validTypes.includes(type as SensoryType)) {
    return type as SensoryType;
  }
  return 'general';
}

function getDefaultPrompts(chapterTitle: string): SensoryPrompt[] {
  return [
    {
      sensoryType: 'visual',
      promptText: `${chapterTitle} 시절에 머릿속에서 가장 먼저 떠오르는 예쁜 풍경이나 색상은 무엇인가요?`,
      relevanceReason: '오픈형 시각 질문을 통해 뇌의 시지각 중심 장기 기억을 소환하도록 유도함.',
    },
    {
      sensoryType: 'auditory',
      promptText: `그 시절 자주 듣던 노래나, 그리운 부모님 혹은 친구의 목소리가 들리는 듯한 소리가 있나요?`,
      relevanceReason: '청각적 자극을 통해 정서적 유대감이 얽힌 기억의 인출을 촉진함.',
    }
  ];
}
