
import { GoogleGenAI, Modality } from "@google/genai";
import { VoiceName, SpeakerConfig, DialogueItem, SpeechSpeed } from "../types";

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
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

const speedInstructions: Record<SpeechSpeed, string> = {
  'v-slow': "Speak extremely slowly, pausing significantly between every word. Articulate every syllable with perfect clarity for a dictation exercise.",
  'slow': "Speak slowly and clearly, as if teaching a beginner English student. Emphasize correct pronunciation.",
  'normal': "Speak at a natural, conversational pace.",
  'fast': "Speak quickly and fluently, like a native speaker in a hurry."
};

export async function generateSingleSpeakerAudio(
  text: string,
  voice: VoiceName,
  tone: string = "",
  speed: SpeechSpeed = 'normal'
): Promise<AudioBuffer> {
  // Correctly initialize GoogleGenAI with process.env.API_KEY
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `${speedInstructions[speed]} ${tone ? `Tone: ${tone}.` : ""} Text to speak: ${text}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio data returned");

  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: SAMPLE_RATE });
  return await decodeAudioData(decode(base64Audio), audioContext, SAMPLE_RATE, 1);
}

export async function generateMultiSpeakerAudio(
  dialogue: DialogueItem[],
  speakers: SpeakerConfig[],
  speed: SpeechSpeed = 'normal'
): Promise<AudioBuffer> {
  // Correctly initialize GoogleGenAI with process.env.API_KEY
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const speakerMap = speakers.reduce((acc, s) => {
    acc[s.id] = s.name;
    return acc;
  }, {} as Record<string, string>);

  const conversationText = dialogue
    .map((item) => `${speakerMap[item.speakerId]}: ${item.text}`)
    .join("\n");

  const prompt = `${speedInstructions[speed]} Generate a multi-speaker audio conversation with distinct voices for each participant. Dialogue:\n${conversationText}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: speakers.map(s => ({
            speaker: s.name,
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: s.voice }
            }
          }))
        }
      }
    }
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio data returned");

  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: SAMPLE_RATE });
  return await decodeAudioData(decode(base64Audio), audioContext, SAMPLE_RATE, 1);
}

export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const length = buffer.length * 2 + 44;
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
