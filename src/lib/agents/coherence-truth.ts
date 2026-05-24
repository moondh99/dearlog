/**
 * Coherence & Truth Agent
 *
 * Analyzes interview history to detect contradictions or factual conflicts
 * (e.g. conflicting dates, locations, family relations, or events),
 * and generates gentle follow-up questions to resolve the conflicts.
 * Uses GPT-4o-mini with JSON response format.
 */

import { getOpenAIClient } from '../openai-client';

export interface Memory {
  id: string;
  text: string;
}

export interface FactualConflict {
  conflictType: string;
  description: string;
  conflictingItems: string[]; // Memory IDs that conflict
  followUpQuestion: string; // A gentle question to clarify/rectify the mismatch
}

/**
 * Detects factual conflicts among the senior's recorded memories.
 */
export async function detectFactualConflicts(
  memories: Memory[]
): Promise<FactualConflict[]> {
  if (memories.length < 2) {
    return [];
  }

  const systemPrompt = `당신은 시니어의 기억을 기록하고 자서전을 집필하는 지식 무결성 검증 전문가입니다.
기록된 기억 리스트를 교차 분석하여 다음 항목들 간의 모순이나 사실적 불일치를 찾으십시오:
1. 연도/날짜/시간 (예: 1965년에 결혼했다고 했다가 나중에 1968년에 결혼했다고 진술한 경우)
2. 지명/장소 (예: 고향이 강릉이라고 했다가 나중에 고향이 안동이라고 진술한 경우)
3. 가족 및 인물 관계 (예: 큰 아들 이름이 철수라고 했다가 나중에 영수라고 진술한 경우)
4. 중요한 특정 생애 사건 (예: 첫 직장이 은행이었다고 했다가 나중에 학교 선생님이었다고 진술한 경우)

모순이 발견될 경우, 다음 인터뷰 시 어르신이 상처받거나 당황하지 않고 자연스럽게 사실관계를 정정할 수 있도록 돕는 매우 따뜻하고 정중한 '정정 유도 질문(followUpQuestion)'을 제안하십시오.

반드시 아래 JSON 형식으로만 응답해야 합니다:
{
  "conflicts": [
    {
      "conflictType": "모순 유형 (날짜 | 장소 | 인물 | 사건 | 기타)",
      "description": "어떤 모순이 발생했는지에 대한 상세한 설명 (예: 큰아들의 이름이 '철수'와 '영수'로 다르게 기술됨)",
      "conflictingItems": ["모순이 발생한 기억 ID 1", "모순이 발생한 기억 ID 2"],
      "followUpQuestion": "어르신께 정중히 확인하고 교정하기 위한 따뜻한 질문 (예: 어르신, 저번에 큰아드님 성함이 철수라고 하셨는데, 오늘 말씀해 주신 영수라는 분은 누구이신가요?)"
    }
  ]
}

주의사항:
- 모순이 전혀 발견되지 않는 경우, "conflicts"는 빈 배열([])로 반환하십시오.
- 입력된 기억 ID(conflictingItems)가 실제 입력값의 ID와 정확히 일치해야 합니다.`;

  const memoriesExcerpt = memories.map(m => `[ID: ${m.id}] ${m.text}`).join('\n\n');
  const userPrompt = `[분석할 기억 리스트]\n${memoriesExcerpt}\n\n위 기억들을 검사하여 사실적 모순점을 모두 추출해 주십시오.`;

  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2, // 모순 분석은 정확해야 하므로 낮은 온도로 설정
    });

    const content = response.choices[0].message.content;
    if (!content) {
      return [];
    }

    const parsed = JSON.parse(content);
    if (!parsed || !Array.isArray(parsed.conflicts)) {
      return [];
    }

    return parsed.conflicts.map((c: any) => ({
      conflictType: typeof c.conflictType === 'string' ? c.conflictType : '기타',
      description: typeof c.description === 'string' ? c.description : '',
      conflictingItems: Array.isArray(c.conflictingItems) ? c.conflictingItems.map(String) : [],
      followUpQuestion: typeof c.followUpQuestion === 'string' ? c.followUpQuestion : '',
    }));
  } catch (error) {
    console.error('Coherence & Truth Agent Error:', error);
    return [];
  }
}
