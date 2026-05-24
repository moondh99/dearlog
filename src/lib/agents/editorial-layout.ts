/**
 * Editorial Layout Agent
 *
 * Semantic layout analysis that correlates photos with book chapters,
 * and generates custom Prologues/Epilogues to enhance overall quality.
 * Uses GPT-4o-mini with JSON response format.
 */

import { getOpenAIClient } from '../openai-client';

export interface Chapter {
  id: string;
  title?: string;
  text: string;
}

export interface Photo {
  id: string;
  description?: string;
  people?: string[];
  places?: string[];
  estimatedEra?: string;
  analysisJson?: string;
}

export interface PhotoCorrelation {
  chapterId: string;
  photoId: string;
  placementReason: string;
}

export interface EditorialNotes {
  prologue: string;
  epilogue: string;
}

/**
 * Correlates list of photos to the book chapters based on semantic context analysis.
 */
export async function correlatePhotosToText(
  chapters: Chapter[],
  photos: Photo[]
): Promise<PhotoCorrelation[]> {
  if (chapters.length === 0 || photos.length === 0) {
    return [];
  }

  const systemPrompt = `당신은 전문 책 편집자이자 레이아웃 디자이너입니다.
주어진 자서전 챕터들과 사진 메타데이터 목록을 분석하여, 각 사진이 어떤 챕터에 들어가기에 가장 적절한지 의미론적으로 매핑하십시오.

반드시 아래 JSON 형식으로만 응답해야 합니다:
{
  "correlations": [
    {
      "chapterId": "챕터 ID (입력된 챕터 중 하나)",
      "photoId": "사진 ID (입력된 사진 중 하나)",
      "placementReason": "이 사진을 해당 챕터에 배치해야 하는 구체적이고 설득력 있는 이유 (책 편집자의 관점)"
    }
  ]
}

규칙:
- 모든 챕터나 사진을 억지로 1:1 대응할 필요는 없지만, 내용이 어울리는 조합이 있다면 적극적으로 매핑해 주세요.
- 각 사진에 대해 가장 적절한 단 하나의 챕터를 추천하거나, 의미가 겹치지 않는다면 여러 사진이 한 챕터에 들어갈 수도 있습니다.`;

  const inputChapters = chapters.map(c => ({
    id: c.id,
    title: c.title || '',
    textExcerpt: c.text.slice(0, 1000)
  }));

  const inputPhotos = photos.map(p => ({
    id: p.id,
    description: p.description || '',
    people: p.people || [],
    places: p.places || [],
    estimatedEra: p.estimatedEra || '',
    analysisJson: p.analysisJson || ''
  }));

  const userPrompt = `[자서전 챕터 목록]\n${JSON.stringify(inputChapters, null, 2)}\n\n[사진 메타데이터 목록]\n${JSON.stringify(inputPhotos, null, 2)}\n\n위 사진들을 자서전 각 챕터 본문에 맞춤 배치해 주세요.`;

  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      return getDefaultCorrelations(chapters, photos);
    }

    const parsed = JSON.parse(content);
    if (!parsed || !Array.isArray(parsed.correlations)) {
      return getDefaultCorrelations(chapters, photos);
    }

    return parsed.correlations.map((c: any) => ({
      chapterId: typeof c.chapterId === 'string' ? c.chapterId : '',
      photoId: typeof c.photoId === 'string' ? c.photoId : '',
      placementReason: typeof c.placementReason === 'string' ? c.placementReason : '',
    })).filter((c: any) => c.chapterId && c.photoId);
  } catch (error) {
    console.error('Editorial Layout correlation error:', error);
    return getDefaultCorrelations(chapters, photos);
  }
}

function getDefaultCorrelations(chapters: Chapter[], photos: Photo[]): PhotoCorrelation[] {
  if (chapters.length > 0 && photos.length > 0) {
    return [
      {
        chapterId: chapters[0].id,
        photoId: photos[0].id,
        placementReason: '자서전 텍스트와 사진 간의 자동 매핑 분석 실패로 인한 기본 배치.',
      }
    ];
  }
  return [];
}

/**
 * Generates an elegant prologue and epilogue based on the overall book content.
 */
export async function generateEditorialNotes(
  autobiographyText: string
): Promise<EditorialNotes> {
  const systemPrompt = `당신은 출판사 편집장입니다.
제공된 자서전 전체 본문 텍스트를 바탕으로, 책의 완성도와 감동을 높일 수 있는 출판 서문(Prologue)과 발문(Epilogue)을 대필해 주십시오.

서문(Prologue)은 이 자서전이 쓰여지게 된 배경, 이 시니어 삶의 깊이와 기록의 가치, 그리고 자서전을 펼치는 독자(가족, 자녀 등)를 환영하는 내용을 담아야 하며,
발문(Epilogue)은 온 생애를 성실히 헤쳐온 시니어의 발자취를 추억하고, 앞으로 남겨질 기억의 유산에 대한 가치를 다정하고 차분하게 요약 정리해야 합니다.

반드시 아래 JSON 형식으로만 응답해야 합니다:
{
  "prologue": "서문 텍스트 내용",
  "epilogue": "발문 텍스트 내용"
}

어투:
- 매우 품격 있고 문학적이며, 눈시울을 붉히는 감동적이고 부드러운 한국어 경어체를 쓰세요.`;

  const userPrompt = `[자서전 전체 본문]\n${autobiographyText.slice(0, 4000)}\n\n위 본문을 바탕으로 깊이 있고 감동적인 서문과 발문을 지어 주십시오.`;

  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      return getDefaultNotes();
    }

    const parsed = JSON.parse(content);
    return {
      prologue: typeof parsed.prologue === 'string' ? parsed.prologue : getDefaultNotes().prologue,
      epilogue: typeof parsed.epilogue === 'string' ? parsed.epilogue : getDefaultNotes().epilogue,
    };
  } catch (error) {
    console.error('Editorial Layout notes error:', error);
    return getDefaultNotes();
  }
}

function getDefaultNotes(): EditorialNotes {
  return {
    prologue: '지나온 삶의 조각들을 하나하나 정성스럽게 엮어 이 한 권의 책으로 빚어냅니다. 고단했으나 눈부셨던 시절의 기록들이 다음 세대에게 따뜻한 등불이 되기를 기원합니다.',
    epilogue: '한 사람의 위대한 역사가 담긴 이야기를 마칩니다. 기록된 순간들은 지나간 과거가 아니라 우리 모두의 마음속에 영원히 살아 숨 쉬는 오늘의 유산입니다.',
  };
}
