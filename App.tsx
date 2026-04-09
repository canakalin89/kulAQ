import React, { useState, useRef, useEffect, useCallback } from 'react';
import { VoiceName, SpeakerConfig, DialogueItem, AudioGenerationHistory, SpeechSpeed, AppLang, VoiceDescriptions } from './types';
import { generateSingleSpeakerAudio, generateMultiSpeakerAudio, audioBufferToWavBlob } from './services/geminiService';
import AudioVisualizer from './components/AudioVisualizer';

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_VOICE_POOL = [
  VoiceName.Zephyr, VoiceName.Fenrir, VoiceName.Kore, VoiceName.Puck, VoiceName.Charon
];

const SPEED_OPTIONS: { id: SpeechSpeed; cefr: string; labelTr: string; labelEn: string }[] = [
  { id: 'v-slow', cefr: 'A1', labelTr: 'Çok Yavaş', labelEn: 'Very Slow' },
  { id: 'slow',   cefr: 'A2', labelTr: 'Yavaş',     labelEn: 'Slow'      },
  { id: 'normal', cefr: 'B1', labelTr: 'Normal',     labelEn: 'Normal'    },
  { id: 'fast',   cefr: 'C1', labelTr: 'Hızlı',      labelEn: 'Fast'      },
];

const PERF_TOOLS = [
  { tag: '...',             labelTr: '⏸ Uzun Es',       labelEn: '⏸ Long Pause'   },
  { tag: ',',               labelTr: '· Kısa Es',        labelEn: '· Short Pause'  },
  { tag: '[breathes in]',   labelTr: '🫁 Nefes',         labelEn: '🫁 Breath'      },
  { tag: '[laughs]',        labelTr: '😄 Güler',          labelEn: '😄 Laugh'       },
  { tag: '[sighs]',         labelTr: '😮‍💨 İçini Çeker',   labelEn: '😮‍💨 Sigh'       },
  { tag: '[clears throat]', labelTr: '🗣 Boğaz',          labelEn: '🗣 Throat'      },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDialogue(text: string): { name: string; line: string }[] {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.includes(':'))
    .map(l => {
      const idx = l.indexOf(':');
      return { name: l.slice(0, idx).trim(), line: l.slice(idx + 1).trim() };
    })
    .filter(d => d.name && d.line);
}

function uniqueNames(items: { name: string }[]): string[] {
  return [...new Set(items.map(i => i.name))];
}

function fmt(s: number): string {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

/** Split long text into sentence-boundary chunks for parallel generation */
function splitIntoChunks(text: string, maxLen = 350): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  // Split at sentence boundaries: . ! ? … followed by space or end
  const sentences = text.match(/[^.!?…\n]+(?:[.!?…]+\s*|\n|$)/g) ?? [text];
  let current = '';
  for (const sentence of sentences) {
    if (current.length + sentence.length > maxLen && current.trim()) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text];
}

/** Concatenate multiple AudioBuffers into one */
function mergeBuffers(buffers: AudioBuffer[], ctx: AudioContext): AudioBuffer {
  const totalLen = buffers.reduce((s, b) => s + b.length, 0);
  const merged   = ctx.createBuffer(1, totalLen, buffers[0].sampleRate);
  const out      = merged.getChannelData(0);
  let offset     = 0;
  for (const buf of buffers) {
    out.set(buf.getChannelData(0), offset);
    offset += buf.length;
  }
  return merged;
}

/** Simple LRU-style cache key */
function cacheKey(text: string, voice: string, speed: string, lang: string): string {
  return `${voice}|${speed}|${lang}|${text}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

const App: React.FC = () => {
  const [lang, setLang]         = useState<AppLang>(() => (localStorage.getItem('kulaq-lang') as AppLang) || 'tr');
  const [ttsLang, setTtsLang]   = useState<AppLang>('en');
  const [theme, setTheme]       = useState<'dark' | 'light'>(() => (localStorage.getItem('kulaq-theme') as 'dark' | 'light') || 'light');
  const [mode, setMode]         = useState<'single' | 'multi'>('single');
  const [text, setText]         = useState('');
  const [voice, setVoice]       = useState<VoiceName>(VoiceName.Zephyr);
  const [speed, setSpeed]       = useState<SpeechSpeed>('normal');
  const [isGenerating, setIsGenerating] = useState(false);
  const [chunkProgress, setChunkProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [history, setHistory]   = useState<AudioGenerationHistory[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [speakerVoices, setSpeakerVoices] = useState<Record<string, VoiceName>>({});

  // Audio
  const [activeBuffer, setActiveBuffer] = useState<AudioBuffer | null>(null);
  const [activeWavUrl, setActiveWavUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying]       = useState(false);
  const [currentTime, setCurrentTime]   = useState(0);
  const [duration, setDuration]         = useState(0);
  const [pausedAt, setPausedAt]         = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef     = useRef<AnalyserNode | null>(null);
  const sourceRef       = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef    = useRef<number>(0);
  const animIdRef       = useRef<number>(0);
  const textareaRef     = useRef<HTMLTextAreaElement>(null);
  const audioCacheRef   = useRef<Map<string, AudioBuffer>>(new Map());

  const isTr = lang === 'tr';

  // ── Theme & persistence ──────────────────────────────────────────────────

  useEffect(() => {
    document.body.className = theme === 'dark' ? 'dark-mode' : 'light-mode';
    localStorage.setItem('kulaq-theme', theme);
  }, [theme]);

  useEffect(() => { localStorage.setItem('kulaq-lang', lang); }, [lang]);

  // ── Auto-assign voices to new speakers ──────────────────────────────────

  const parsed       = mode === 'multi' ? parseDialogue(text) : [];
  const speakerNames = uniqueNames(parsed);

  useEffect(() => {
    if (mode !== 'multi') return;
    setSpeakerVoices(prev => {
      const next = { ...prev };
      speakerNames.forEach((name, i) => {
        if (!next[name]) next[name] = DEFAULT_VOICE_POOL[i % DEFAULT_VOICE_POOL.length];
      });
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speakerNames.join('|'), mode]);

  // ── Audio helpers ────────────────────────────────────────────────────────

  const getCtx = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      const ctx      = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.connect(ctx.destination);
      audioContextRef.current = ctx;
      analyserRef.current     = analyser;
    }
    return { ctx: audioContextRef.current!, analyser: analyserRef.current! };
  }, []);

  const stopAudio = useCallback(() => {
    cancelAnimationFrame(animIdRef.current);
    if (sourceRef.current) { try { sourceRef.current.stop(); } catch { /* ignore */ } sourceRef.current = null; }
    setIsPlaying(false);
  }, []);

  const playBuffer = useCallback((buffer: AudioBuffer, offset = 0) => {
    const { ctx, analyser } = getCtx();
    if (ctx.state === 'suspended') ctx.resume();
    stopAudio();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(analyser);
    src.start(0, offset);
    src.onended = () => { setIsPlaying(false); setCurrentTime(buffer.duration); setPausedAt(0); };
    sourceRef.current  = src;
    startTimeRef.current = ctx.currentTime - offset;
    setIsPlaying(true);
    const tick = () => {
      const elapsed = ctx.currentTime - startTimeRef.current;
      setCurrentTime(Math.min(elapsed, buffer.duration));
      if (elapsed < buffer.duration) animIdRef.current = requestAnimationFrame(tick);
    };
    animIdRef.current = requestAnimationFrame(tick);
  }, [getCtx, stopAudio]);

  // ── Generate ─────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!text.trim() || isGenerating) return;
    setIsGenerating(true);
    setChunkProgress(null);
    setError(null);
    stopAudio();
    setActiveBuffer(null);
    setCurrentTime(0);
    setPausedAt(0);
    setDuration(0);
    try {
      const { ctx } = getCtx();
      let buffer: AudioBuffer;

      if (mode === 'single') {
        const key = cacheKey(text, voice, speed, ttsLang);
        const cached = audioCacheRef.current.get(key);

        if (cached) {
          buffer = cached;
        } else {
          const chunks = splitIntoChunks(text);

          if (chunks.length === 1) {
            // Short text — single call
            buffer = await generateSingleSpeakerAudio(text, voice, speed, ttsLang, ctx);
          } else {
            // Long text — parallel chunk generation
            setChunkProgress({ done: 0, total: chunks.length });
            let done = 0;
            const buffers = await Promise.all(
              chunks.map(chunk =>
                generateSingleSpeakerAudio(chunk, voice, speed, ttsLang, ctx).then(b => {
                  done++;
                  setChunkProgress({ done, total: chunks.length });
                  return b;
                })
              )
            );
            buffer = mergeBuffers(buffers, ctx);
          }

          // Cache result (keep max 20 entries)
          if (audioCacheRef.current.size >= 20) {
            const firstKey = audioCacheRef.current.keys().next().value;
            if (firstKey) audioCacheRef.current.delete(firstKey);
          }
          audioCacheRef.current.set(key, buffer);
        }
      } else {
        const speakers: SpeakerConfig[] = speakerNames.map((name, i) => ({
          id: `s${i}`,
          name,
          voice: speakerVoices[name] ?? DEFAULT_VOICE_POOL[i % DEFAULT_VOICE_POOL.length],
        }));
        const dialogue: DialogueItem[] = parsed.map(p => ({
          speakerId: speakers.find(s => s.name === p.name)!.id,
          text: p.line,
        }));
        buffer = await generateMultiSpeakerAudio(dialogue, speakers, speed, ttsLang, ctx);
      }

      setChunkProgress(null);
      setActiveBuffer(buffer);
      setDuration(buffer.duration);
      const wavBlob = audioBufferToWavBlob(buffer);
      const url     = URL.createObjectURL(wavBlob);
      setActiveWavUrl(url);

      const entry: AudioGenerationHistory = {
        id:        Date.now().toString(),
        text:      text.slice(0, 80),
        audioUrl:  url,
        timestamp: new Date(),
        voice:     mode === 'single' ? voice : speakerNames.join(', '),
        speed,
        lang:      ttsLang,
      };
      setHistory(prev => [entry, ...prev]);
      playBuffer(buffer);
    } catch (e: any) {
      setChunkProgress(null);
      setError(e.message ?? 'Bilinmeyen hata');
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Playback controls ────────────────────────────────────────────────────

  const handlePlayPause = () => {
    if (!activeBuffer) return;
    if (isPlaying) { setPausedAt(currentTime); stopAudio(); }
    else           { playBuffer(activeBuffer, pausedAt); }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeBuffer) return;
    const rect   = e.currentTarget.getBoundingClientRect();
    const seekTo = ((e.clientX - rect.left) / rect.width) * activeBuffer.duration;
    setPausedAt(seekTo);
    setCurrentTime(seekTo);
    if (isPlaying) playBuffer(activeBuffer, seekTo);
  };

  // ── Insert tag at cursor ─────────────────────────────────────────────────

  const insertTag = (tag: string) => {
    const ta = textareaRef.current;
    if (!ta) { setText(p => p + tag); return; }
    const s = ta.selectionStart, e2 = ta.selectionEnd;
    const next = text.slice(0, s) + tag + text.slice(e2);
    setText(next);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + tag.length, s + tag.length); }, 0);
  };

  // ── Colours & CSS vars ───────────────────────────────────────────────────

  const accent  = theme === 'dark' ? '#6366f1' : '#1e1b4b';
  const surface = theme === 'dark' ? '#0f172a' : '#ffffff';
  const surfac2 = theme === 'dark' ? '#1e293b' : '#f1f5f9';
  const border  = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(30,27,75,0.10)';
  const muted   = theme === 'dark' ? '#94a3b8' : '#64748b';

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', color: 'var(--text)', transition: 'background .3s, color .3s' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header style={{ background: surface, borderBottom: `1px solid ${border}`, backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <span style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>
            <span style={{ color: accent }}>kul</span><span style={{ color: '#f97316' }}>AQ</span>
          </span>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* TTS Language */}
            <select
              value={ttsLang}
              onChange={e => setTtsLang(e.target.value as AppLang)}
              style={{ background: surfac2, color: 'var(--text)', border: `1px solid ${border}`, borderRadius: 8, padding: '4px 8px', fontSize: 13, cursor: 'pointer' }}
            >
              <option value="tr">🇹🇷 TR</option>
              <option value="en">🇬🇧 EN</option>
              <option value="de">🇩🇪 DE</option>
            </select>

            {/* UI lang toggle */}
            <button
              onClick={() => setLang(isTr ? 'en' : 'tr')}
              style={{ background: surfac2, border: `1px solid ${border}`, borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: 'var(--text)' }}
            >
              {isTr ? 'EN' : 'TR'}
            </button>

            {/* Theme */}
            <button
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              style={{ background: surfac2, border: `1px solid ${border}`, borderRadius: 8, padding: '4px 8px', fontSize: 15, cursor: 'pointer' }}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 680, margin: '0 auto', padding: '24px 20px 60px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Mode tabs */}
        <div style={{ display: 'inline-flex', background: surfac2, borderRadius: 12, padding: 4, gap: 4, alignSelf: 'flex-start' }}>
          {(['single', 'multi'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: '7px 18px', borderRadius: 9, border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                background: mode === m ? accent : 'transparent',
                color: mode === m ? '#fff' : muted,
                transition: 'all .2s',
              }}
            >
              {m === 'single' ? (isTr ? '🎤 Tek Kişi' : '🎤 Solo') : (isTr ? '💬 Diyalog' : '💬 Dialogue')}
            </button>
          ))}
        </div>

        {/* Text area card */}
        <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: 16 }}>
          {mode === 'multi' && (
            <p style={{ fontSize: 12, color: muted, marginBottom: 8 }}>
              ℹ️ {isTr ? 'Her satırı "Karakter: metin" formatında yazın' : 'Write each line as "Speaker: text"'}
            </p>
          )}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            rows={mode === 'multi' ? 7 : 4}
            placeholder={mode === 'single'
              ? (isTr ? 'Metni buraya yazın...' : 'Type your text here...')
              : (isTr
                  ? 'Anlatıcı: Bugün hava güzel.\nÖğrenci: Gerçekten mi? Harika!'
                  : 'Narrator: Good morning!\nStudent: Good morning! How are you?')
            }
            style={{
              width: '100%', boxSizing: 'border-box', background: surfac2, color: 'var(--text)',
              border: `1px solid ${border}`, borderRadius: 10, padding: '12px 14px',
              fontSize: 15, lineHeight: 1.6, resize: 'vertical', outline: 'none',
              fontFamily: "'Inter', sans-serif",
            }}
          />

          {/* Performance tool chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {PERF_TOOLS.map(pt => (
              <button
                key={pt.tag}
                onClick={() => insertTag(pt.tag)}
                style={{
                  background: surfac2, border: `1px solid ${border}`, borderRadius: 20,
                  padding: '3px 10px', fontSize: 12, cursor: 'pointer', color: muted,
                  transition: 'all .15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#f97316'; (e.currentTarget as HTMLButtonElement).style.color = '#f97316'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = border; (e.currentTarget as HTMLButtonElement).style.color = muted; }}
              >
                {isTr ? pt.labelTr : pt.labelEn}
              </button>
            ))}
          </div>
        </div>

        {/* Detected speakers (dialogue mode) */}
        {mode === 'multi' && speakerNames.length > 0 && (
          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: muted, marginBottom: 12 }}>
              {isTr ? 'Karakterler & Sesler' : 'Speakers & Voices'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {speakerNames.map(name => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ minWidth: 100, fontSize: 14, fontWeight: 600 }}>{name}</span>
                  <span style={{ color: muted, fontSize: 14 }}>→</span>
                  <select
                    value={speakerVoices[name] ?? VoiceName.Zephyr}
                    onChange={e => setSpeakerVoices(prev => ({ ...prev, [name]: e.target.value as VoiceName }))}
                    style={{ flex: 1, background: surfac2, color: 'var(--text)', border: `1px solid ${border}`, borderRadius: 8, padding: '6px 10px', fontSize: 13, cursor: 'pointer' }}
                  >
                    {Object.values(VoiceName).map(v => (
                      <option key={v} value={v}>
                        {VoiceDescriptions[v].gender === 'female' ? '♀' : '♂'} {v} — {isTr ? VoiceDescriptions[v].tr : VoiceDescriptions[v].en}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Voice selector (single mode) */}
        {mode === 'single' && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: muted, marginBottom: 8 }}>
              {isTr ? 'Ses Seç' : 'Voice'}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.values(VoiceName).map(v => {
                const isActive = voice === v;
                return (
                  <button
                    key={v}
                    onClick={() => setVoice(v)}
                    style={{
                      padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${isActive ? accent : border}`,
                      background: isActive ? accent : surface,
                      color: isActive ? '#fff' : 'var(--text)',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
                    }}
                  >
                    <span style={{ opacity: 0.7, marginRight: 4 }}>
                      {VoiceDescriptions[v].gender === 'female' ? '♀' : '♂'}
                    </span>
                    {v}
                    <span style={{ display: 'block', fontSize: 10, opacity: 0.65, fontWeight: 400 }}>
                      {isTr ? VoiceDescriptions[v].tr : VoiceDescriptions[v].en}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Speed selector */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: muted, marginBottom: 8 }}>
            {isTr ? 'Konuşma Hızı' : 'Speed'}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            {SPEED_OPTIONS.map(s => {
              const isActive = speed === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSpeed(s.id)}
                  style={{
                    flex: 1, padding: '9px 4px', borderRadius: 10, border: `1.5px solid ${isActive ? accent : border}`,
                    background: isActive ? accent : surface,
                    color: isActive ? '#fff' : 'var(--text)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .15s', textAlign: 'center',
                  }}
                >
                  <span style={{ display: 'block', fontSize: 15, marginBottom: 2 }}>{s.cefr}</span>
                  <span style={{ fontSize: 10, opacity: 0.75 }}>{isTr ? s.labelTr : s.labelEn}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', color: '#991b1b', fontSize: 14 }}>
            ⚠️ {error}
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !text.trim()}
          style={{
            width: '100%', padding: '16px', borderRadius: 14, border: 'none',
            background: isGenerating || !text.trim()
              ? (theme === 'dark' ? '#1e293b' : '#e2e8f0')
              : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
            color: isGenerating || !text.trim() ? muted : '#fff',
            fontSize: 17, fontWeight: 700, letterSpacing: '0.02em', cursor: isGenerating || !text.trim() ? 'not-allowed' : 'pointer',
            boxShadow: isGenerating || !text.trim() ? 'none' : '0 4px 20px rgba(249,115,22,0.35)',
            transition: 'all .2s',
            fontFamily: "'Instrument Sans', sans-serif",
          }}
        >
          {isGenerating
            ? chunkProgress
              ? `⚡ ${chunkProgress.done}/${chunkProgress.total} ${isTr ? 'parça…' : 'chunks…'}`
              : `⏳ ${isTr ? 'Üretiliyor…' : 'Generating…'}`
            : `🎙️ ${isTr ? 'SESLENDİR' : 'GENERATE'}`
          }
        </button>

        {/* Player */}
        {activeBuffer && (
          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Play/Pause */}
              <button
                onClick={handlePlayPause}
                style={{
                  width: 44, height: 44, borderRadius: '50%', border: 'none',
                  background: accent, color: '#fff', fontSize: 18, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {isPlaying ? '⏸' : '▶'}
              </button>

              {/* Progress */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div
                  onClick={handleSeek}
                  style={{ height: 6, background: surfac2, borderRadius: 99, cursor: 'pointer', overflow: 'hidden' }}
                >
                  <div style={{
                    height: '100%', borderRadius: 99,
                    background: 'linear-gradient(90deg, #f97316, #1e1b4b)',
                    width: `${duration ? (currentTime / duration) * 100 : 0}%`,
                    transition: 'width .1s linear',
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: muted }}>
                  <span>{fmt(currentTime)}</span>
                  <span>{fmt(duration)}</span>
                </div>
              </div>

              {/* Download */}
              {activeWavUrl && (
                <a
                  href={activeWavUrl}
                  download="kulaq.wav"
                  title={isTr ? 'WAV İndir' : 'Download WAV'}
                  style={{
                    width: 44, height: 44, borderRadius: '50%', border: `1.5px solid ${border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, textDecoration: 'none', color: 'var(--text)', flexShrink: 0,
                  }}
                >
                  ⬇️
                </a>
              )}
            </div>

            {/* Waveform */}
            {analyserRef.current && (
              <div style={{ marginTop: 12 }}>
                <AudioVisualizer analyser={analyserRef.current} isPlaying={isPlaying} />
              </div>
            )}
          </div>
        )}

        {/* Library */}
        <div style={{ border: `1px solid ${border}`, borderRadius: 16, overflow: 'hidden' }}>
          <button
            onClick={() => setShowLibrary(p => !p)}
            style={{
              width: '100%', padding: '14px 16px', background: surface, border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'var(--text)',
            }}
          >
            <span>📁 {isTr ? 'Kütüphane' : 'Library'}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {history.length > 0 && (
                <span style={{
                  background: accent, color: '#fff', borderRadius: 99,
                  padding: '1px 8px', fontSize: 12, fontWeight: 700,
                }}>
                  {history.length}
                </span>
              )}
              <span style={{ color: muted, fontSize: 12 }}>{showLibrary ? '▲' : '▼'}</span>
            </span>
          </button>

          {showLibrary && (
            <div style={{ borderTop: `1px solid ${border}` }}>
              {history.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '20px', fontSize: 13, color: muted }}>
                  {isTr ? 'Henüz kayıt yok' : 'No recordings yet'}
                </p>
              ) : (
                <>
                  {history.map(item => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 16px', borderBottom: `1px solid ${border}`,
                        background: surface,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.text}
                        </p>
                        <p style={{ fontSize: 11, color: muted, margin: '2px 0 0' }}>
                          {item.voice} · {item.speed} · {item.lang.toUpperCase()} · {new Date(item.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                      <a href={item.audioUrl} download="kulaq.wav" style={{ fontSize: 18, textDecoration: 'none' }}>⬇️</a>
                      <button
                        onClick={() => setHistory(prev => prev.filter(h => h.id !== item.id))}
                        style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: muted }}
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                  <div style={{ padding: '10px 16px', background: surface }}>
                    <button
                      onClick={() => setHistory([])}
                      style={{
                        background: 'none', border: `1px solid ${border}`, borderRadius: 8,
                        padding: '6px 14px', fontSize: 12, color: muted, cursor: 'pointer',
                      }}
                    >
                      {isTr ? 'Tümünü Temizle' : 'Clear All'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer credit */}
        <p style={{ textAlign: 'center', fontSize: 11, color: muted, marginTop: 8 }}>
          {isTr
            ? 'Can AKALIN tarafından öğretmenler için geliştirildi · Gemini 2.5 Flash TTS'
            : 'Built for educators by Can AKALIN · Powered by Gemini 2.5 Flash TTS'}
        </p>
      </main>
    </div>
  );
};

export default App;
