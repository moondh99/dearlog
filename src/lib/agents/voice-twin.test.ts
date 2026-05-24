import { vi, describe, it, expect } from 'vitest';
import { generateVoiceProfile } from './voice-twin';

vi.mock('../openai-client', () => ({
  getOpenAIClient: () => ({
    chat: {
      completions: {
        create: vi.fn().mockImplementation((config) => {
          const userMessage = config.messages.find((m: any) => m.role === 'user')?.content || '';
          
          if (userMessage.includes('audio_01') || userMessage.includes('Gyeongsang')) {
            return Promise.resolve({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      pitch: 1.1,
                      speed: 0.85,
                      accentDialect: '경상도 사투리',
                      emotionalStability: 0.9,
                      synthesisParams: {
                        vibrato: 'low',
                        clarity: 0.95,
                        breathiness: 0.15,
                        toneAccentuation: 'high'
                      }
                    }),
                  },
                },
              ],
            });
          } else {
            return Promise.resolve({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      pitch: 1.0,
                      speed: 0.9,
                      accentDialect: '표준어',
                      emotionalStability: 0.8,
                      synthesisParams: {
                        vibrato: 'medium',
                        clarity: 0.8,
                        breathiness: 0.2,
                        toneAccentuation: 'medium'
                      }
                    }),
                  },
                },
              ],
            });
          }
        }),
      },
    },
  }),
}));

describe('Voice Twin Synthesis Agent', () => {
  it('generates a custom voice twin profile based on audio metadata', async () => {
    const dummyAudioMetadata = [
      { fileKey: 'audio_01.wav', duration: 15.4 },
      { fileKey: 'audio_02.wav', duration: 22.1 }
    ];
    const speechProfile = {
      preferredTone: 'warm',
      dialectAccents: ['Gyeongsang']
    };

    const profile = await generateVoiceProfile(dummyAudioMetadata, speechProfile);
    expect(profile.pitch).toBe(1.1);
    expect(profile.speed).toBe(0.85);
    expect(profile.accentDialect).toBe('경상도 사투리');
    expect(profile.emotionalStability).toBe(0.9);
    expect(profile.synthesisParams.toneAccentuation).toBe('high');
  });
});
