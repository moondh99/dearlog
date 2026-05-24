import fs from 'node:fs/promises';
import OpenAI from 'openai';
import { config } from '../config';

export async function analyzePhotoAndCreateQuestions(input: {
  filePath: string;
  mimeType: string;
  chapterId?: string;
}) {
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

  if (!config.openaiApiKey || !input.mimeType.startsWith('image/')) return fallback;

  const bytes = await fs.readFile(input.filePath);
  const dataUrl = `data:${input.mimeType};base64,${bytes.toString('base64')}`;
  const client = new OpenAI({ apiKey: config.openaiApiKey });
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    temperature: 0.3,
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
}
