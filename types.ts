
export enum VoiceName {
  Zephyr = 'Zephyr',
  Puck = 'Puck',
  Kore = 'Kore',
  Fenrir = 'Fenrir',
  Aoede = 'Aoede',
  Charon = 'Charon',
  Leda = 'Leda',
  Hektor = 'Hektor',
  Leto = 'Leto',
  Mimas = 'Mimas'
}

export const VoiceDescriptions: Record<VoiceName, { en: string; tr: string; de: string; gender: 'male' | 'female'; traits: string }> = {
  [VoiceName.Zephyr]: { en: 'Warm & Clear', tr: 'Sıcak ve Net', de: 'Warm & Klar', gender: 'female', traits: 'professional, clear, articulate' },
  [VoiceName.Puck]: { en: 'Youthful Male', tr: 'Genç Erkek', de: 'Jugendlicher Mann', gender: 'male', traits: 'energetic, bright, youthful boy' },
  [VoiceName.Kore]: { en: 'Soft & Gentle', tr: 'Yumuşak ve Nazik', de: 'Sanft & Zart', gender: 'female', traits: 'calm, maternal, soothing' },
  [VoiceName.Fenrir]: { en: 'Strong Narrative', tr: 'Güçlü ve Anlatıcı', de: 'Starke Erzählung', gender: 'male', traits: 'bold, heroic, deep masculine tone' },
  [VoiceName.Aoede]: { en: 'Artistic & Lyrical', tr: 'Sanatsal ve Lirik', de: 'Künstlerisch & Lyrisch', gender: 'female', traits: 'expressive, musical, soft' },
  [VoiceName.Charon]: { en: 'Deep & Resonant', tr: 'Derin ve Yankılı', de: 'Tief & Resonanz', gender: 'male', traits: 'authoritative, deep, old man' },
  [VoiceName.Leda]: { en: 'Energetic & Friendly', tr: 'Enerjik ve Dost Canlısı', de: 'Energetisch & Freundlich', gender: 'female', traits: 'upbeat, happy, welcoming' },
  [VoiceName.Hektor]: { en: 'Mature & Reliable', tr: 'Olgun ve Güvenilir', de: 'Reif & Zuverlässig', gender: 'male', traits: 'steady, trustworthy, mid-age' },
  [VoiceName.Leto]: { en: 'Commanding & Bold', tr: 'Otoriter ve Keskin', de: 'Befehlsgewaltig & Mutig', gender: 'female', traits: 'direct, serious, high-status' },
  [VoiceName.Mimas]: { en: 'Corporate & Official', tr: 'Kurumsal ve Resmi', de: 'Sachlich & Offiziell', gender: 'male', traits: 'neutral, steady, professional' }
};

export type SpeechSpeed = 'v-slow' | 'slow' | 'normal' | 'fast';
export type AppLang = 'tr' | 'en' | 'de';

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
