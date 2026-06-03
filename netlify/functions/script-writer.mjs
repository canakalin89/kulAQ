import { GoogleGenAI } from '@google/genai';

const ALLOWED_LANGS = new Set(['tr', 'en', 'de']);
const ALLOWED_MODES = new Set(['single', 'multi']);

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

function cleanText(value, maxLength = 500) {
  if (typeof value !== 'string') return '';
  return value.replace(/\0/g, '').trim().slice(0, maxLength);
}

function buildPrompt(topic, ttsLang, mode) {
  const langLabel = ttsLang === 'tr' ? 'Turkish' : ttsLang === 'de' ? 'German' : 'English';

  const performanceRules = `
PERFORMANCE WRITING RULES:
- Use "..." for long, meaningful pauses.
- Use "," for short, natural breathing pauses.
- Use "[breathes in]" to indicate a natural intake of breath before important sentences.
- Write key words in UPPERCASE to indicate strong vocal emphasis and higher pitch.
- Write in a natural, conversational tone suitable for high-quality educational audio.
- The script should sound professional when read aloud.
- Do NOT include any stage directions other than the bracketed cues listed above.
- Do NOT include any markdown formatting, headers, or meta-commentary — output ONLY the script text.
`;

  if (mode === 'multi') {
    return `You are a professional script writer for educational audio content.
Write a natural dialogue script in ${langLabel} about the following topic: "${topic}"

${performanceRules}

FORMAT: Each line must follow "CharacterName: spoken text" format. Use 2-3 characters.
Example format:
Teacher: Good morning, everyone, [breathes in] today we will talk about something VERY important...
Student: What is it?
Teacher: It's about...

Write the full dialogue script now (in ${langLabel}):`;
  }

  return `You are a professional script writer for educational audio content.
Write a single-speaker narration script in ${langLabel} about the following topic: "${topic}"

${performanceRules}

Write the full narration script now (in ${langLabel}):`;
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  let rawPayload;
  try {
    rawPayload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const topic = cleanText(rawPayload.topic);
  if (!topic) {
    return json(400, { error: 'Topic is required' });
  }

  const ttsLang = rawPayload.ttsLang || 'en';
  if (!ALLOWED_LANGS.has(ttsLang)) {
    return json(400, { error: 'Invalid language' });
  }

  const mode = rawPayload.mode || 'single';
  if (!ALLOWED_MODES.has(mode)) {
    return json(400, { error: 'Invalid mode' });
  }

  const apiKey = cleanText(rawPayload.apiKey, 200) || process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    return json(500, { error: 'Gemini API anahtarı girilmedi ve Netlify ortam değişkeni tanımlı değil.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = buildPrompt(topic, ttsLang, mode);

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [{ parts: [{ text: prompt }] }],
    });

    const script = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!script) throw new Error('No script returned from API');

    return json(200, { script: script.trim() });
  } catch (error) {
    const message = String(error?.message ?? error).toLowerCase();
    console.error('Script writer function error:', error);

    if (message.includes('api') && message.includes('key')) {
      return json(401, { error: 'Gemini API anahtarı eksik veya geçersiz.' });
    }
    if (message.includes('quota') || message.includes('rate')) {
      return json(429, { error: 'Gemini kotası doldu. Biraz sonra tekrar deneyin.' });
    }
    return json(500, { error: 'Senaryo üretimi başarısız oldu.' });
  }
};
