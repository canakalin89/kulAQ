import { GoogleGenAI, Modality } from '@google/genai';

const ALLOWED_VOICES = new Set(['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr']);
const ALLOWED_SPEEDS = new Set(['v-slow', 'slow', 'normal', 'fast']);
const ALLOWED_LANGS = new Set(['tr', 'en', 'de']);

const voiceDescriptions = {
  Kore: { gender: 'female', traits: 'calm, maternal, soothing' },
  Puck: { gender: 'male', traits: 'energetic, bright, youthful boy' },
  Charon: { gender: 'male', traits: 'authoritative, deep, old man' },
  Fenrir: { gender: 'male', traits: 'bold, heroic, deep masculine tone' },
  Zephyr: { gender: 'female', traits: 'professional, clear, articulate' },
};

const speedInstructions = {
  'v-slow': 'Speak extremely slowly, pausing significantly between every word. Articulate every syllable with perfect clarity.',
  slow: 'Speak slowly and clearly, as if teaching a beginner student.',
  normal: 'Speak at a natural, conversational pace.',
  fast: 'Speak quickly and fluently, like a native speaker in a hurry.',
};

const nonVerbalCueInstruction = `
STRICT PERFORMANCE RULE:
- Use punctuation (commas, periods, ellipses) to control rhythm and pauses.
- "..." (Ellipses) indicate a long, meaningful pause.
- "," (Commas) indicate a short, natural breathing pause.
- "[breathes in]" is a VOCAL ACTION. PERFORM THE SOUND of a natural intake of breath.
- CRITICAL: DO NOT SAY the words inside the brackets.
- UPPERCASE words (e.g., "IMPORTANT") must be spoken with HIGHER VOLUME, STRONGER STRESS, and HIGHER PITCH to provide emphasis.
- The delivery should sound professional and tailored for high-quality educational materials.
`;

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(payload),
  };
}

function cleanText(value, maxLength = 5000) {
  if (typeof value !== 'string') return '';
  return value.replace(/\0/g, '').trim().slice(0, maxLength);
}

function assertCommon(payload) {
  if (!ALLOWED_SPEEDS.has(payload.speed)) throw new Error('Invalid speed');
  if (!ALLOWED_LANGS.has(payload.ttsLang)) throw new Error('Invalid language');
}

function getVoiceStyleInstruction(voice, ttsLang) {
  const desc = voiceDescriptions[voice];
  const langLabel = ttsLang === 'tr' ? 'Turkish' : ttsLang === 'de' ? 'German' : 'English';

  let instruction = `You are performing as ${voice}.
  Target Language: ${langLabel}.
  MANDATORY: Speak in ${langLabel} with a perfect native accent.
  Style: ${desc.traits}. `;

  if (ttsLang === 'tr') {
    instruction += "Apply native Turkish phonetics for characters like 'ğ, ş, ç, ö, ü, ı'. Use standard Istanbul Turkish intonation. ";
  } else if (ttsLang === 'de') {
    instruction += "Apply native German phonetics. Pay special attention to 'Umlaute' (ä, ö, ü) and 'ß'. Use natural German sentence melody. ";
  }

  if (voice === 'Fenrir') {
    instruction += 'CRITICAL: Use an ULTRA-MASCULINE, deep, heavy chest-voice. Bass-baritone resonance. ';
  } else if (voice === 'Puck') {
    instruction += 'CRITICAL: Use a young male voice. Adolescent male resonance. Strictly masculine. ';
  } else if (voice === 'Charon') {
    instruction += 'CRITICAL: Extremely old, raspy, gravelly male voice. Deep weathered throat. ';
  } else if (desc.gender === 'male') {
    instruction += 'MANDATORY: Strictly masculine chest-voice. ';
  }

  return instruction;
}

function getSinglePrompt(payload) {
  return `
    ${nonVerbalCueInstruction}
    ${getVoiceStyleInstruction(payload.voice, payload.ttsLang)}
    ${speedInstructions[payload.speed]}
    Script to be spoken in ${payload.ttsLang.toUpperCase()} (PERFORM BRACKETED ACTIONS, STRESS UPPERCASE):
    ${cleanText(payload.text)}
  `;
}

function getMultiPrompt(payload) {
  const speakerMap = payload.speakers.reduce((acc, speaker) => {
    acc[speaker.id] = { name: cleanText(speaker.name, 80), voice: speaker.voice };
    return acc;
  }, {});

  const conversationText = payload.dialogue
    .map((item) => {
      const speaker = speakerMap[item.speakerId];
      return speaker ? `${speaker.name}: ${cleanText(item.text, 1000)}` : '';
    })
    .filter(Boolean)
    .join('\n');

  const voiceInstructions = payload.speakers
    .map((speaker) => getVoiceStyleInstruction(speaker.voice, payload.ttsLang))
    .join('\n');

  return `
    ${nonVerbalCueInstruction}
    SPEAK IN ${payload.ttsLang.toUpperCase()} AS NATIVE SPEAKERS.
    ${voiceInstructions}
    ${speedInstructions[payload.speed]}
    Dialogue Script:
    ${conversationText}
  `;
}

function normalizePayload(rawPayload) {
  if (!rawPayload || typeof rawPayload !== 'object') throw new Error('Invalid request body');
  assertCommon(rawPayload);
  const userApiKey = cleanText(rawPayload.apiKey, 200);

  if (rawPayload.mode === 'single') {
    if (!ALLOWED_VOICES.has(rawPayload.voice)) throw new Error('Invalid voice');
    const text = cleanText(rawPayload.text);
    if (!text) throw new Error('Text is required');
    return { ...rawPayload, text, apiKey: userApiKey };
  }

  if (rawPayload.mode === 'multi') {
    if (!Array.isArray(rawPayload.speakers) || !Array.isArray(rawPayload.dialogue)) {
      throw new Error('Dialogue and speakers are required');
    }

    const speakers = rawPayload.speakers.slice(0, 6).map((speaker, index) => {
      const voice = ALLOWED_VOICES.has(speaker.voice) ? speaker.voice : 'Zephyr';
      const name = cleanText(speaker.name, 80) || `Speaker ${index + 1}`;
      return { id: String(speaker.id), name, voice };
    });

    const speakerIds = new Set(speakers.map((speaker) => speaker.id));
    const dialogue = rawPayload.dialogue
      .filter((item) => speakerIds.has(String(item.speakerId)))
      .slice(0, 80)
      .map((item) => ({ speakerId: String(item.speakerId), text: cleanText(item.text, 1000) }))
      .filter((item) => item.text);

    if (speakers.length === 0 || dialogue.length === 0) throw new Error('Dialogue is empty');
    return { ...rawPayload, speakers, dialogue, apiKey: userApiKey };
  }

  throw new Error('Invalid mode');
}

function classifyServerError(error) {
  const message = String(error?.message ?? error);
  const lower = message.toLowerCase();
  if (lower.includes('api') && lower.includes('key')) {
    return { statusCode: 401, error: 'Gemini API anahtarı sunucuda eksik veya geçersiz.' };
  }
  if (lower.includes('quota') || lower.includes('rate')) {
    return { statusCode: 429, error: 'Gemini kotası doldu veya istek sınırı aşıldı. Biraz sonra tekrar deneyin.' };
  }
  return { statusCode: 500, error: 'Gemini ses üretimi başarısız oldu.' };
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const payload = normalizePayload(JSON.parse(event.body || '{}'));
    const apiKey = payload.apiKey || process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      return json(500, { error: 'Gemini API anahtarı girilmedi ve Netlify ortam değişkeni tanımlı değil.' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = payload.mode === 'single' ? getSinglePrompt(payload) : getMultiPrompt(payload);
    const speechConfig = payload.mode === 'single'
      ? { voiceConfig: { prebuiltVoiceConfig: { voiceName: payload.voice } } }
      : {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: payload.speakers.map((speaker) => ({
              speaker: speaker.name,
              voiceConfig: { prebuiltVoiceConfig: { voiceName: speaker.voice } },
            })),
          },
        };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig,
      },
    });

    const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioBase64) throw new Error('No audio data returned from API');
    return json(200, { audioBase64 });
  } catch (error) {
    if (error instanceof SyntaxError || String(error?.message ?? '').startsWith('Invalid')) {
      return json(400, { error: error.message });
    }

    console.error('Gemini TTS function error:', error);
    const classified = classifyServerError(error);
    return json(classified.statusCode, { error: classified.error });
  }
};
