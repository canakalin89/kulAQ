
import { VoiceName, SpeakerConfig, DialogueItem, SpeechSpeed, AppLang } from "../types";

function decode(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const SAMPLE_RATE = 24000;

type TtsRequest =
  | {
      mode: 'single';
      text: string;
      voice: VoiceName;
      speed: SpeechSpeed;
      ttsLang: AppLang;
      apiKey?: string;
    }
  | {
      mode: 'multi';
      dialogue: DialogueItem[];
      speakers: SpeakerConfig[];
      speed: SpeechSpeed;
      ttsLang: AppLang;
      apiKey?: string;
    };

function classifyError(error: any): Error {
  const msg: string = error?.message?.toLowerCase() ?? '';
  const status: number = error?.status ?? error?.code ?? 0;
  if (msg.includes('api_key') || msg.includes('api key') || msg.includes('invalid key') || status === 401 || status === 403) {
    return new Error('Gemini API anahtarı sunucuda eksik veya geçersiz. Netlify ortam değişkenlerinde GEMINI_API_KEY değerini kontrol edin.');
  }
  if (msg.includes('quota') || msg.includes('rate') || status === 429) {
    return new Error('API quota exceeded or rate limited. Please wait a moment and try again.');
  }
  if (status >= 500 || msg.includes('unavailable') || msg.includes('internal')) {
    return new Error('Gemini service is temporarily unavailable. Please try again.');
  }
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) {
    return new Error('Network error. Check your internet connection and try again.');
  }
  return error instanceof Error ? error : new Error(String(error?.message ?? error));
}

async function requestAudio(payload: TtsRequest): Promise<string> {
  const response = await fetch('/.netlify/functions/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  let body: any = null;
  try {
    body = await response.json();
  } catch {
    // Netlify function bulunamazsa çoğu zaman HTML döner; kullanıcıya anlaşılır hata verelim.
  }

  if (!response.ok) {
    throw classifyError({
      status: response.status,
      message: body?.error ?? `TTS sunucusu yanıt vermedi (${response.status}).`,
    });
  }

  if (!body?.audioBase64) throw new Error('No audio data returned from API');
  return body.audioBase64;
}

export async function generateSingleSpeakerAudio(
  text: string,
  voice: VoiceName,
  speed: SpeechSpeed = 'normal',
  ttsLang: AppLang = 'tr',
  ctx: AudioContext,
  apiKey?: string
): Promise<AudioBuffer> {
  try {
    const base64Audio = await requestAudio({ mode: 'single', text, voice, speed, ttsLang, apiKey });
    return await decodeAudioData(decode(base64Audio), ctx, SAMPLE_RATE, 1);
  } catch (error: any) {
    console.error("Gemini TTS Error:", error);
    throw classifyError(error);
  }
}

export async function generateMultiSpeakerAudio(
  dialogue: DialogueItem[],
  speakers: SpeakerConfig[],
  speed: SpeechSpeed = 'normal',
  ttsLang: AppLang = 'tr',
  ctx: AudioContext,
  apiKey?: string
): Promise<AudioBuffer> {
  try {
    const base64Audio = await requestAudio({ mode: 'multi', dialogue, speakers, speed, ttsLang, apiKey });
    return await decodeAudioData(decode(base64Audio), ctx, SAMPLE_RATE, 1);
  } catch (error: any) {
    console.error("Gemini Multi-Speaker TTS Error:", error);
    throw classifyError(error);
  }
}

export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const length = buffer.length * 2 * buffer.numberOfChannels + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);
  let pos = 0;

  const setUint16 = (data: number) => { view.setUint16(pos, data, true); pos += 2; };
  const setUint32 = (data: number) => { view.setUint32(pos, data, true); pos += 4; };

  setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157);
  setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(buffer.numberOfChannels);
  setUint32(buffer.sampleRate); setUint32(buffer.sampleRate * 2 * buffer.numberOfChannels);
  setUint16(buffer.numberOfChannels * 2); setUint16(16);
  setUint32(0x61746164); setUint32(length - pos - 4);

  const channels = [];
  for (let i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));

  let offset = 0;
  while (pos < length) {
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }
  return new Blob([bufferArray], { type: "audio/wav" });
}
