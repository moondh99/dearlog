import { Memory } from '../store';
import { getOpenAIClient } from './openai-client';

export interface ChatMessage {
  role: 'user' | 'model'; // 'model' used for compatibility with existing UI
  text: string;
}

const mapHistory = (history: ChatMessage[]) => 
  history.map(msg => ({
    role: msg.role === 'model' ? 'assistant' as const : 'user' as const,
    content: msg.text,
  }));

export async function generateInterviewResponse(history: ChatMessage[]): Promise<string> {
  const systemInstruction = `
당신은 70대 어르신의 인생 이야기를 경청하고 기록하는 'Dearlog 기록가'입니다.
말투: 정중하고 따뜻한 격식체를 사용하세요. (예: ~하셨군요, ~이지요)
속도: 한 번에 한 가지 질문만 던지세요.
공감: 답변 내용에 대해 구체적인 감정적 공감을 먼저 표현한 뒤, 관련 있는 꼬리 질문을 하세요.
금기: AI인 티를 너무 내거나, 분석적인 태도를 보이지 마세요. "각색"하지 말고 "기억을 모시는" 태도를 유지하세요.
시작: 첫 질문은 "어르신, 오늘 함께 인생의 소중한 조각들을 모아보고 싶습니다. 가장 기억에 남는 어린 시절의 풍경은 어떤 모습인가요?"와 같이 시작합니다.
`;

  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemInstruction },
        ...mapHistory(history)
      ],
      temperature: 0.7,
    });
    return response.choices[0].message.content || '말씀을 더 듣고 싶습니다. 계속 이야기해 주시겠어요?';
  } catch (error) {
    console.error('Error generating interview response:', error);
    return '죄송합니다. 잠시 생각이 멈췄네요. 다시 한 번 말씀해 주시겠어요?';
  }
}

export async function summarizeMemory(transcript: string): Promise<Omit<Memory, 'id' | 'date' | 'privacy'>> {
  const systemPrompt = `
다음은 어르신과의 인터뷰 기록입니다. 이 기록을 바탕으로 다음 정보를 JSON 형식으로만 추출해주세요.
요구사항 (오직 JSON 데이터만 반환할 것):
{
  "topic": "주제 (예: 어린 시절, 가족, 직업 등)",
  "originalTranscript": "인터뷰 원본 텍스트",
  "cleanedTranscript": "문맥을 매끄럽게 다듬은 텍스트 (어르신 말투 유지)",
  "publishVersion": "가족과 공유하기 좋은 에세이 형태 글",
  "tags": {
    "people": ["인물1", "인물2"],
    "places": ["장소1"],
    "emotions": ["감정1"],
    "timePeriod": "추정 시대"
  }
}
`;

  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: transcript }
      ],
      temperature: 0.2,
    });
    
    const data = JSON.parse(response.choices[0].message.content || '{}');
    return {
      topic: data.topic || '기억의 조각',
      originalTranscript: data.originalTranscript || transcript,
      cleanedTranscript: data.cleanedTranscript || transcript,
      publishVersion: data.publishVersion || transcript,
      tags: data.tags || { people: [], places: [], emotions: [], timePeriod: '알 수 없음' },
      confidenceLabel: '확인됨',
      contradictions: [],
      consent: { status: 'granted', accessTier: '본인만', designatedFamilyIds: [], lastModified: '' },
      consentSettings: { 출판: 'granted', 가족열람: 'granted', 챗봇: 'granted', 사후공개: 'granted', 민감정보: 'granted' },
      embedding: null,
    };
  } catch (error) {
    console.error('Error summarizing memory:', error);
    return {
      topic: '새로운 기억',
      originalTranscript: transcript,
      cleanedTranscript: transcript,
      publishVersion: transcript,
      tags: { people: [], places: [], emotions: [], timePeriod: '' },
      confidenceLabel: '확인됨',
      contradictions: [],
      consent: { status: 'granted', accessTier: '본인만', designatedFamilyIds: [], lastModified: '' },
      consentSettings: { 출판: 'granted', 가족열람: 'granted', 챗봇: 'granted', 사후공개: 'granted', 민감정보: 'granted' },
      embedding: null,
    };
  }
}

export async function generatePersonaResponse(message: string, memories: Memory[], history: ChatMessage[]): Promise<string> {
  const memoriesContext = memories.map(m => 
    `[기억 ID: ${m.id}] 주제: ${m.topic}\n내용: ${m.publishVersion}`
  ).join('\n\n');

  const systemInstruction = `
당신은 이 기억들의 주인공인 70대 어르신입니다.
따뜻하고 연륜이 묻어나는 말투로 대답하세요. (예: ~했지, ~란다, ~허허)
사용자(가족이나 후손)의 질문에 대답할 때, 제공된 '나의 기억들'을 바탕으로 대답하세요.
기억을 인용할 때는 자연스럽게 이야기하되, 응답 끝에 인용한 기억의 ID를 [출처: 기억 ID] 형식으로 반드시 적어주세요.
기억에 없는 내용을 물어보면 "그건 잘 기억이 안 나는구나"라고 솔직하게 말씀하세요.

나의 기억들:
${memoriesContext}
`;

  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemInstruction },
        ...mapHistory(history),
        { role: 'user', content: message }
      ],
      temperature: 0.7,
    });
    return response.choices[0].message.content || '허허, 무슨 말을 해야 할지 모르겠구나.';
  } catch (error) {
    console.error('Error generating persona response:', error);
    return '아이고, 귀가 어두워서 잘 못 들었네. 다시 말해주겠니?';
  }
}
