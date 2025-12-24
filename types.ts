
export enum VoiceName {
  Kore = 'Kore',
  Puck = 'Puck',
  Charon = 'Charon',
  Fenrir = 'Fenrir',
  Zephyr = 'Zephyr'
}

export const VoiceDescriptions: Record<VoiceName, { en: string; tr: string; gender: 'male' | 'female' }> = {
  [VoiceName.Kore]: { en: 'Soft & Gentle', tr: 'Yumuşak ve Nazik', gender: 'female' },
  [VoiceName.Puck]: { en: 'Bright & Youthful', tr: 'Parlak ve Genç', gender: 'male' },
  [VoiceName.Charon]: { en: 'Deep & Resonant', tr: 'Derin ve Yankılı', gender: 'male' },
  [VoiceName.Fenrir]: { en: 'Strong & Narrative', tr: 'Güçlü ve Anlatıcı', gender: 'male' },
  [VoiceName.Zephyr]: { en: 'Warm & Clear', tr: 'Sıcak ve Net', gender: 'female' }
};

export type SpeechSpeed = 'v-slow' | 'slow' | 'normal' | 'fast';
export type AppLang = 'tr' | 'en';

export interface SpeakerConfig {
  id: string;
  name: string;
  voice: VoiceName;
}

export interface DialogueItem {
  speakerId: string;
  text: string;
}

export interface AudioGenerationHistory {
  id: string;
  text: string;
  audioUrl: string;
  timestamp: Date;
  voice: string;
  speed: SpeechSpeed;
  lang: AppLang;
}
