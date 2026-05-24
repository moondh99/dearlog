/**
 * Voice Twin Synthesis Agent
 *
 * Generates custom speech parameters (pitch, speed, accent, emotion parameters)
 * for synthesizing senior's voice twin using recorded audio metadata.
 * Uses GPT-4o-mini with JSON response format.
 */

import { getOpenAIClient } from '../openai-client';

export interface AudioMetadata {
  fileKey: string;
  duration: number; // in seconds
}

export interface VoiceProfile {
  pitch: number; // Range e.g. 0.5 to 2.0 (1.0 is default)
  speed: number; // Range e.g. 0.5 to 2.0 (1.0 is default)
  accentDialect: string; // e.g. "Standard Korean", "Gyeongsang dialect"
  emotionalStability: number; // Range 0.0 to 1.0 (calmness indicator)
  synthesisParams: Record<string, any>; // TTS-engine specific parameters
}

/**
 * Generates synthesis parameters and accent dialect profiles based on recording audio metadata and textual speech profiles.
 */
export async function generateVoiceProfile(
  audioFilesMetadata: AudioMetadata[],
  speechProfile?: any
): Promise<VoiceProfile> {
  const systemPrompt = `당신은 최첨단 AI 음성 복제(Voice Cloning) 및 TTS(Text-to-Speech) 오디오 엔지니어입니다.
주어진 녹음 파일 정보(총 길이, 개수 등)와 텍스트 대화에서 분석된 언어적 특징(어투, 사투리 등)을 바탕으로,
디지털 트윈이 자서전을 낭독할 때 원본 시니어의 음성을 가장 생생하고 자연스럽게 구현할 수 있는 최적의 음성 합성 프로필을 설계하십시오.

반드시 아래 JSON 형식으로만 응답해야 합니다:
{
  "pitch": 1.0, // 음성 피치 (기본 1.0, 범위: 0.5 ~ 2.0)
  "speed": 1.0, // 말하기 속도 (기본 1.0, 범위: 0.5 ~ 2.0, 시니어인 경우 보통 0.8~0.95로 느리게 추천)
  "accentDialect": "말의 억양/방언 종류 (예: 표준어, 경상도 사투리, 전라도 사투리, 이북 사투리 등)",
  "emotionalStability": 0.8, // 정서적 안정성 (기본 0.5, 범위: 0.0 ~ 1.0, 차분하고 안정된 정도)
  "synthesisParams": {
    "vibrato": "진동 수준 (low | medium | high)",
    "clarity": "목소리 선명도 (0.0 ~ 1.0)",
    "breathiness": "숨소리 섞임 정도 (0.0 ~ 1.0)",
    "toneAccentuation": "말투 강세 세기 (low | medium | high)"
  }
}

주의사항:
- 시니어의 음성이 너무 빠르지 않도록, speed 값은 0.8 ~ 0.95 내외로 제안하는 경향이 좋습니다.
- 사투리가 speechProfile 텍스트 정보에 보일 경우 이를 억양/방언 종류(accentDialect)에 반영하십시오.`;

  const inputMeta = audioFilesMetadata.map(a => ({
    fileKey: a.fileKey,
    duration: `${a.duration}초`
  }));

  const textProfileExcerpt = speechProfile ? JSON.stringify(speechProfile) : '지정된 텍스트 특징 없음';
  
  const userPrompt = `[오디오 파일 정보]\n${JSON.stringify(inputMeta, null, 2)}\n\n[발화 텍스트 특징]\n${textProfileExcerpt}\n\n위 정보를 바탕으로 최적의 낭독용 TTS 음성 프로필 파라미터를 도출해 주십시오.`;

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
      return getDefaultVoiceProfile();
    }

    const parsed = JSON.parse(content);
    return {
      pitch: typeof parsed.pitch === 'number' ? parsed.pitch : 1.0,
      speed: typeof parsed.speed === 'number' ? parsed.speed : 0.9,
      accentDialect: typeof parsed.accentDialect === 'string' ? parsed.accentDialect : '표준어',
      emotionalStability: typeof parsed.emotionalStability === 'number' ? parsed.emotionalStability : 0.8,
      synthesisParams: parsed.synthesisParams && typeof parsed.synthesisParams === 'object' ? parsed.synthesisParams : getDefaultVoiceProfile().synthesisParams,
    };
  } catch (error) {
    console.error('Voice Twin Synthesis Agent Error:', error);
    return getDefaultVoiceProfile();
  }
}

export function getDefaultVoiceProfile(): VoiceProfile {
  return {
    pitch: 1.0,
    speed: 0.9,
    accentDialect: '표준어',
    emotionalStability: 0.8,
    synthesisParams: {
      vibrato: 'medium',
      clarity: 0.8,
      breathiness: 0.2,
      toneAccentuation: 'medium',
    },
  };
}
