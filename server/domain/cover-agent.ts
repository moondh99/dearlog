import OpenAI from 'openai';
import { config } from '../config';
import { COVER_FONTS, COVER_PALETTES, COVER_TEMPLATES } from './constants';

export interface CoverDecision {
  palette: string;
  template: string;
  font: string;
  analysis: {
    tone: string;
    keywords: string[];
    reason: string;
  };
}

function fallbackCoverDecision(transcripts: string[]): CoverDecision {
  const text = transcripts.join(' ');
  const warm = /가족|어머니|아버지|손녀|감사|사랑/.test(text);
  const reflective = /후회|상실|그리움|힘들/.test(text);

  return {
    palette: reflective ? 'quiet_blue' : warm ? 'warm_archive' : 'classic_ink',
    template: warm ? 'photo_plate' : 'letterpress',
    font: reflective ? '명조체' : '고딕체',
    analysis: {
      tone: reflective ? '차분하고 회고적' : warm ? '따뜻하고 가족 중심적' : '담백하고 정돈된',
      keywords: [...new Set((text.match(/[가-힣]{2,}/g) ?? []).slice(0, 8))],
      reason: '로컬 fallback 분석으로 표지 기본값을 선택했습니다.',
    },
  };
}

export async function decideCoverDesign(transcripts: string[]): Promise<CoverDecision> {
  if (!config.openaiApiKey || transcripts.join('').trim().length === 0) {
    return fallbackCoverDecision(transcripts);
  }

  const client = new OpenAI({ apiKey: config.openaiApiKey });
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: `자서전 인터뷰 기록을 분석해 표지 설정을 JSON으로 고르세요.
palette는 ${COVER_PALETTES.join(', ')} 중 하나, template은 ${COVER_TEMPLATES.join(', ')} 중 하나, font는 ${COVER_FONTS.join(', ')} 중 하나여야 합니다.
응답 형식: {"palette":"...","template":"...","font":"...","analysis":{"tone":"...","keywords":["..."],"reason":"..."}}`,
      },
      { role: 'user', content: transcripts.join('\n\n').slice(0, 12000) },
    ],
  });

  const parsed = JSON.parse(response.choices[0].message.content || '{}');
  const fallback = fallbackCoverDecision(transcripts);
  return {
    palette: COVER_PALETTES.includes(parsed.palette) ? parsed.palette : fallback.palette,
    template: COVER_TEMPLATES.includes(parsed.template) ? parsed.template : fallback.template,
    font: COVER_FONTS.includes(parsed.font) ? parsed.font : fallback.font,
    analysis: {
      tone: typeof parsed.analysis?.tone === 'string' ? parsed.analysis.tone : fallback.analysis.tone,
      keywords: Array.isArray(parsed.analysis?.keywords) ? parsed.analysis.keywords.filter((v: unknown): v is string => typeof v === 'string') : fallback.analysis.keywords,
      reason: typeof parsed.analysis?.reason === 'string' ? parsed.analysis.reason : fallback.analysis.reason,
    },
  };
}
