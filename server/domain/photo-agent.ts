import fs from 'node:fs/promises';
import {
  getFactChatClient,
  hasFactChatApiKey,
  normalizeFactChatChatCompletionInput,
} from '../ai-clients';
import {
  createChatCompletionWithUsage,
  recordInternalAiUsage,
  type InternalAiUsageContext,
} from '../ai-usage';

export async function analyzePhotoAndCreateQuestions(input: {
  filePath: string;
  mimeType: string;
  chapterId?: string;
}, usageContext?: InternalAiUsageContext) {
  const fallback = {
    analysis: {
      people: [],
      places: [],
      objects: [],
      estimatedEra: '알 수 없음',
      description: '로컬에 저장된 사진입니다. 사진을 보며 떠오르는 기억을 질문으로 이어갑니다.',
    },
    questions: [
      '이 사진을 보시면 가장 먼저 어떤 장면이 떠오르시나요?',
      '사진 속 장소나 사람과 관련해 기억나는 말이 있으신가요?',
      '이 사진이 찍힌 날의 분위기는 어땠나요?',
    ],
  };

  if (!hasFactChatApiKey() || !input.mimeType.startsWith('image/')) {
    await recordInternalAiUsage({
      context: usageContext,
      endpoint: 'photo_analysis',
      outcome: 'fallback',
      statusCode: 200,
      errorMessage: 'Photo analysis used local fallback.',
    });
    return fallback;
  }

  try {
    const bytes = await fs.readFile(input.filePath);
    const dataUrl = `data:${input.mimeType};base64,${bytes.toString('base64')}`;
    const client = getFactChatClient();
    const providerInput = normalizeFactChatChatCompletionInput({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_completion_tokens: 900,
      messages: [
        {
          role: 'system',
          content: '사진을 분석해 people, places, objects, estimatedEra, description, questions 배열을 JSON으로 반환하세요. questions는 어르신에게 묻는 따뜻한 한국어 질문 3개입니다.',
        },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            { type: 'text', text: '이 사진 기반 인터뷰 질문을 만들어 주세요.' },
          ],
        },
      ],
    }, 'vision') as Record<string, unknown>;
    const response = await createChatCompletionWithUsage<any>({
      client,
      endpoint: 'photo_analysis',
      providerInput,
      context: usageContext,
      timeoutMs: 12_000,
    });
    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    return {
      analysis: {
        people: Array.isArray(parsed.people) ? parsed.people : [],
        places: Array.isArray(parsed.places) ? parsed.places : [],
        objects: Array.isArray(parsed.objects) ? parsed.objects : [],
        estimatedEra: typeof parsed.estimatedEra === 'string' ? parsed.estimatedEra : '알 수 없음',
        description: typeof parsed.description === 'string' ? parsed.description : fallback.analysis.description,
      },
      questions: Array.isArray(parsed.questions) && parsed.questions.length > 0
        ? parsed.questions.filter((q: unknown): q is string => typeof q === 'string').slice(0, 5)
        : fallback.questions,
    };
  } catch (error) {
    console.warn('Photo analysis failed, using fallback questions:', error);
    await recordInternalAiUsage({
      context: usageContext,
      endpoint: 'photo_analysis',
      outcome: 'fallback',
      statusCode: 200,
      errorMessage: error instanceof Error ? error.message : 'Photo analysis failed.',
    });
    return fallback;
  }
}
