
export enum VoiceName {
  Kore = 'Kore',
  Puck = 'Puck',
  Charon = 'Charon',
  Fenrir = 'Fenrir',
  Zephyr = 'Zephyr'
}

export const VoiceDescriptions: Record<VoiceName, { en: string; tr: string; gender: 'male' | 'female'; traits: string }> = {
  [VoiceName.Kore]: { en: 'Soft & Gentle', tr: 'Yumuşak ve Nazik', gender: 'female', traits: 'calm, maternal, soothing' },
  [VoiceName.Puck]: { en: 'Youthful Male', tr: 'Genç Erkek', gender: 'male', traits: 'energetic, bright, youthful boy' },
  [VoiceName.Charon]: { en: 'Deep & Resonant', tr: 'Derin ve Yankılı', gender: 'male', traits: 'authoritative, deep, old man' },
  [VoiceName.Fenrir]: { en: 'Strong Narrative', tr: 'Güçlü ve Anlatıcı', gender: 'male', traits: 'bold, heroic, deep masculine tone' },
  [VoiceName.Zephyr]: { en: 'Warm & Clear', tr: 'Sıcak ve Net', gender: 'female', traits: 'professional, clear, articulate' }
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
