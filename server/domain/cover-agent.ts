import {
  getFactChatClient,
  hasFactChatApiKey,
  normalizeFactChatChatCompletionInput,
} from '../ai-clients';
import { createChatCompletionWithUsage, recordInternalAiUsage, type InternalAiUsageContext } from '../ai-usage';
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

const RENDERED_COVER_PALETTES = ['warm_archive', 'quiet_blue', 'classic_ink'] as const;
const VISUAL_COVER_TEMPLATES = ['photo_plate', 'chapter_band', 'letterpress', 'framed_portrait'] as const;

function rotateFrom<T extends string>(values: readonly T[], preferred: string) {
  const start = values.findIndex((value) => value === preferred);
  if (start < 0) return [...values];
  return [...values.slice(start), ...values.slice(0, start)];
}

function candidateReason(base: CoverDecision, palette: string, template: string, index: number) {
  if (index === 0) return base.analysis.reason;
  const moodCopy: Record<string, string> = {
    warm_archive: '따뜻한 가족 회상을 중심에 둔 표지입니다.',
    quiet_blue: '차분하고 정돈된 회고록 느낌을 강조한 표지입니다.',
    classic_ink: '단정한 기록집과 문학적인 인상을 살린 표지입니다.',
  };
  const templateCopy: Record<string, string> = {
    chapter_band: '장 제목처럼 또렷한 띠 구성을 사용했습니다.',
    framed_portrait: '인물 기록집처럼 보이는 액자형 구성을 사용했습니다.',
    letterpress: '글자의 무게가 중심이 되는 활판형 구성을 사용했습니다.',
    photo_plate: '사진첩 같은 판형 구성을 사용했습니다.',
  };
  return `${moodCopy[palette] ?? base.analysis.reason} ${templateCopy[template] ?? ''}`.trim();
}

export function buildCoverDecisionCandidates(primary: CoverDecision, count = 3): CoverDecision[] {
  const palettes = rotateFrom(RENDERED_COVER_PALETTES, primary.palette);
  const templates = rotateFrom(VISUAL_COVER_TEMPLATES, primary.template);
  const fonts = rotateFrom(COVER_FONTS, primary.font);
  const candidates: CoverDecision[] = [];
  const seen = new Set<string>();

  for (let index = 0; candidates.length < count && index < 12; index += 1) {
    const palette = palettes[index % palettes.length];
    const template = templates[index % templates.length];
    const font = fonts[index % fonts.length];
    const key = `${palette}:${template}:${font}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({
      palette,
      template,
      font,
      analysis: {
        ...primary.analysis,
        reason: candidateReason(primary, palette, template, candidates.length),
      },
    });
  }

  return candidates.length > 0 ? candidates : [primary];
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

export async function decideCoverDesign(
  transcripts: string[],
  usageContext?: InternalAiUsageContext,
): Promise<CoverDecision> {
  const fallback = fallbackCoverDecision(transcripts);
  if (!hasFactChatApiKey() || transcripts.join('').trim().length === 0) {
    await recordInternalAiUsage({
      context: usageContext,
      endpoint: 'cover_design',
      outcome: 'fallback',
      statusCode: 200,
      errorMessage: 'FactChat key or transcripts missing; using local cover fallback.',
    });
    return fallback;
  }

  try {
    const client = getFactChatClient();
    const providerInput = normalizeFactChatChatCompletionInput({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_completion_tokens: 900,
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
    const response = await createChatCompletionWithUsage<any>({
      client,
      endpoint: 'cover_design',
      providerInput,
      context: usageContext,
      timeoutMs: 12_000,
    });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
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
  } catch (error) {
    console.warn('Cover design agent failed; using fallback cover decision.', error);
    await recordInternalAiUsage({
      context: usageContext,
      endpoint: 'cover_design',
      outcome: 'fallback',
      statusCode: 200,
      errorMessage: 'Cover design agent failed; using fallback cover decision.',
    });
    return fallback;
  }
}
