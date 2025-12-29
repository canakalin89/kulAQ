
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { VoiceName, SpeakerConfig, DialogueItem, AudioGenerationHistory, SpeechSpeed, AppLang, VoiceDescriptions } from './types';
import { generateSingleSpeakerAudio, generateMultiSpeakerAudio, audioBufferToWavBlob } from './services/geminiService';
import AudioVisualizer from './components/AudioVisualizer';

const EXAM_SPEEDS: { id: SpeechSpeed; label: { tr: string, en: string, de: string }; cefr: string }[] = [
  { id: 'v-slow', label: { tr: 'Çok Yavaş', en: 'Very Slow', de: 'Sehr Langsam' }, cefr: 'A1' },
  { id: 'slow', label: { tr: 'Yavaş', en: 'Slow', de: 'Langsam' }, cefr: 'A2' },
  { id: 'normal', label: { tr: 'Normal', en: 'Normal', de: 'Normal' }, cefr: 'B1' },
  { id: 'fast', label: { tr: 'Hızlı', en: 'Fast', de: 'Schnell' }, cefr: 'C1' },
];

const SPEECH_LANGS: { id: AppLang; label: string; flag: string }[] = [
  { id: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { id: 'en', label: 'English', flag: '🇬🇧' },
  { id: 'de', label: 'Deutsch', flag: '🇩🇪' },
];

const EXAMPLE_TEXTS: Record<AppLang, string[]> = {
  tr: [
    "Merhaba! Kulaq Studio'ya hoş geldiniz. [laughs] Bu sistem ile profesyonel seslendirmeler yapabilirsiniz.",
    "Dikkat, dikkat! Uçuşumuz için biniş kapıları kapanmak üzeredir. [clears throat] Lütfen hazırlıklı olun.",
    "Bugün hava çok güzel, değil mi? ... [sighs] Belki biraz yürüyüş yapmalıyız."
  ],
  en: [
    "Hello there! Welcome to Kulaq Studio. [laughs] You can create professional voiceovers with this system.",
    "Attention please! The boarding gates for your flight are about to close. [clears throat] Please be ready.",
    "The weather is lovely today, isn't it? ... [sighs] Maybe we should go for a walk."
  ],
  de: [
    "Hallo! Willkommen im Kulaq Studio. [laughs] Mit diesem System können Sie professionelle Voiceovers erstellen.",
    "Achtung bitte! Die Boarding-Gates für Ihren Flug werden gleich geschlossen. [clears throat] Bitte halten Sie sich bereit.",
    "Das Wetter ist heute herrliches, nicht wahr? ... [sighs] Vielleicht sollten wir einen Spaziergang machen."
  ]
};

const VOCAL_FX = [
  { tag: '[laughs]', label: { tr: 'Gülme', en: 'Laugh', de: 'Lachen' } },
  { tag: '[sighs]', label: { tr: 'İç Çekme', en: 'Sigh', de: 'Seufzen' } },
  { tag: '[clears throat]', label: { tr: 'Öksürük', en: 'Clear', de: 'Hüsteln' } },
  { tag: '[whispers]', label: { tr: 'Fısıltı', en: 'Whisper', de: 'Flüstern' } },
];

const translations = {
  tr: {
    studio: 'Kulaq',
    tagline: 'PROFESYONEL SES STÜDYOSU',
    generate: 'SESLENDİR',
    history: 'KÜTÜPHANE',
    config: 'AYARLAR',
    speakers: 'KARAKTERLER',
    ttsLang: 'SESLETİM DİLİ',
    speed: 'TEMPO',
    download: 'WAV İNDİR',
    single: 'TEK KİŞİ',
    multi: 'DİYALOG',
    placeholder: 'Metni buraya girin veya örneklerden birini seçin...',
    tipsTitle: 'Stüdyo Rehberi',
    tipsDesc: 'Doğallık katmak için bu efektleri metne ekleyin:',
    uppercaseTip: 'Vurgu için KELİMEYİ BÜYÜK YAZIN.',
    pauseTip: 'Daha uzun duraksamalar için "..." kullanın.',
    examples: 'ÖRNEKLER',
    close: 'Kapat'
  },
  en: {
    studio: 'Kulaq',
    tagline: 'PROFESSIONAL AUDIO STUDIO',
    generate: 'GENERATE',
    history: 'LIBRARY',
    config: 'SETTINGS',
    speakers: 'TALENT',
    ttsLang: 'SPEECH LANGUAGE',
    speed: 'TEMPO',
    download: 'EXPORT WAV',
    single: 'SOLO',
    multi: 'DIALOGUE',
    placeholder: 'Enter text here or choose an example...',
    tipsTitle: 'Studio Guide',
    tipsDesc: 'Add these tags for natural performance:',
    uppercaseTip: 'Write words in UPPERCASE for extra stress.',
    pauseTip: 'Use "..." for meaningful silences.',
    examples: 'EXAMPLES',
    close: 'Close'
  },
  de: {
    studio: 'Kulaq',
    tagline: 'PROFI-AUDIO-STUDIO',
    generate: 'GENERIEREN',
    history: 'BIBLIOTHEK',
    config: 'EINSTELLUNGEN',
    speakers: 'TALENTE',
    ttsLang: 'SPRACHE',
    speed: 'TEMPO',
    download: 'EXPORT WAV',
    single: 'SOLO',
    multi: 'DIALOG',
    placeholder: 'Text hier eingeben oder Beispiel wählen...',
    tipsTitle: 'Studio Guide',
    tipsDesc: 'Fügen Sie Tags für eine natürliche Performance hinzu:',
    uppercaseTip: 'Schreiben Sie Wörter GROSS für zusätzliche Betonung.',
    pauseTip: 'Verwenden Sie "..." für Pausen.',
    examples: 'BEISPIELE',
    close: 'Schließen'
  }
};

const App: React.FC = () => {
  const [lang, setLang] = useState<AppLang>('tr');
  const [ttsLang, setTtsLang] = useState<AppLang>('tr');
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [mode, setMode] = useState<'single' | 'multi'>('single');
  const [showTips, setShowTips] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const t = translations[lang];

  // States
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>(VoiceName.Zephyr);
  const [speed, setSpeed] = useState<SpeechSpeed>('normal');
  const [history, setHistory] = useState<AudioGenerationHistory[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Multi-Speaker States
  const [speakers, setSpeakers] = useState<SpeakerConfig[]>([
    { id: 's1', name: 'Anlatıcı', voice: VoiceName.Zephyr },
    { id: 's2', name: 'Karakter 1', voice: VoiceName.Fenrir }
  ]);
  const [dialogue, setDialogue] = useState<DialogueItem[]>([
    { speakerId: 's1', text: "Kulaq Studio'ya hoş geldiniz." },
    { speakerId: 's2', text: "[breathes in] Bu ses gerçekten harika!" }
  ]);

  // Audio Control States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [pausedAt, setPausedAt] = useState(0);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  
  const [activeBuffer, setActiveBuffer] = useState<AudioBuffer | null>(null);
  const [activeWavUrl, setActiveWavUrl] = useState<string | null>(null);

  useEffect(() => {
    document.body.className = theme === 'light' ? 'light-mode' : 'dark-mode';
  }, [theme]);

  const updateProgress = useCallback(() => {
    if (!audioContextRef.current || !isPlaying) return;
    const now = audioContextRef.current.currentTime;
    const elapsed = now - startTimeRef.current + pausedAt;
    
    if (elapsed >= duration) {
      setIsPlaying(false);
      setCurrentTime(duration);
      setPausedAt(0);
    } else {
      setCurrentTime(elapsed);
      requestAnimationFrame(updateProgress);
    }
  }, [isPlaying, duration, pausedAt]);

  useEffect(() => {
    if (isPlaying) requestAnimationFrame(updateProgress);
  }, [isPlaying, updateProgress]);

  const togglePlayback = () => {
    if (isPlaying) {
      pauseAudio();
    } else {
      if (activeBuffer) {
        const startFrom = currentTime >= duration ? 0 : currentTime;
        playBuffer(activeBuffer, activeWavUrl || undefined, startFrom);
      }
    }
  };

  const stopAudio = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch (e) {}
      sourceRef.current = null;
    }
    setIsPlaying(false);
    setPausedAt(0);
    setCurrentTime(0);
  }, []);

  const pauseAudio = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch (e) {}
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      const elapsedSinceStart = audioContextRef.current.currentTime - startTimeRef.current;
      setPausedAt(prev => prev + elapsedSinceStart);
    }
    setIsPlaying(false);
  }, []);

  const playBuffer = (buffer: AudioBuffer, url?: string, offset: number = 0) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.connect(audioContextRef.current.destination);
    }
    
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch (e) {}
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(analyserRef.current!);
    
    startTimeRef.current = audioContextRef.current.currentTime;
    setPausedAt(offset);
    source.start(0, offset);
    sourceRef.current = source;
    
    setIsPlaying(true);
    setActiveBuffer(buffer);
    setDuration(buffer.duration);
    setCurrentTime(offset);
    if (url) setActiveWavUrl(url);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    setPausedAt(newTime);
    
    if (activeBuffer) {
      if (isPlaying) {
        playBuffer(activeBuffer, activeWavUrl || undefined, newTime);
      } else {
        setPausedAt(newTime);
      }
    }
  };

  const skip = (seconds: number) => {
    if (!activeBuffer) return;
    let newTime = currentTime + seconds;
    if (newTime < 0) newTime = 0;
    if (newTime > duration) newTime = duration;
    
    setCurrentTime(newTime);
    setPausedAt(newTime);
    
    if (isPlaying) {
      playBuffer(activeBuffer, activeWavUrl || undefined, newTime);
    }
  };

  const handleGenerate = async () => {
    const input = mode === 'single' ? text : dialogue.map(d => d.text).join(' ');
    if (!input.trim()) return;
    setIsGenerating(true);
    try {
      let buffer: AudioBuffer;
      if (mode === 'single') {
        buffer = await generateSingleSpeakerAudio(text, selectedVoice, speed, ttsLang);
      } else {
        buffer = await generateMultiSpeakerAudio(dialogue, speakers, speed, ttsLang);
      }
      const blob = audioBufferToWavBlob(buffer);
      const url = URL.createObjectURL(blob);
      setHistory(prev => [{
        id: Math.random().toString(36).substr(2, 9),
        text: input.slice(0, 30) + '...',
        audioUrl: url,
        timestamp: new Date(),
        voice: mode === 'single' ? selectedVoice : 'Multi',
        speed,
        lang: ttsLang
      }, ...prev]);
      
      setPausedAt(0);
      setCurrentTime(0);
      playBuffer(buffer, url, 0);
    } catch (e) { console.error(e); } finally { setIsGenerating(false); }
  };

  const insertFx = (fx: string) => {
    if (mode === 'single') {
      setText(prev => prev + ' ' + fx + ' ');
    } else {
      const n = [...dialogue];
      if (n.length > 0) {
        n[n.length - 1].text += ' ' + fx + ' ';
        setDialogue(n);
      }
    }
  };

  const loadExample = (ex: string) => {
    if (mode === 'single') {
      setText(ex);
    } else {
      const n = [...dialogue];
      if (n.length > 0) {
        n[0].text = ex;
        setDialogue(n);
      }
    }
  };

  const generateDownloadName = () => {
    const voicePart = mode === 'single' ? selectedVoice : 'multi';
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `kulaq_${voicePart}_${ttsLang}_${speed}_${date}.wav`;
  };

  const toggleLibrary = () => setIsLibraryOpen(!isLibraryOpen);
  const toggleSettings = () => setIsSettingsOpen(!isSettingsOpen);

  const libraryPanel = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase">{t.history}</h2>
        <button onClick={() => setIsLibraryOpen(false)} className="lg:hidden text-slate-400"><i className="fa-solid fa-xmark"></i></button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar">
        {history.length === 0 ? (
          <div className="h-32 flex flex-col items-center justify-center opacity-10">
            <i className="fa-solid fa-folder-open mb-2 text-indigo-900"></i>
            <span className="text-[9px] uppercase font-bold text-indigo-900">{lang === 'tr' ? 'BOŞ' : 'EMPTY'}</span>
          </div>
        ) : (
          history.map(item => (
            <div key={item.id} className={`p-4 border rounded-2xl transition-all cursor-pointer card-shadow ${theme === 'dark' ? 'bg-white/[0.02] border-white/[0.03] hover:bg-white/[0.05]' : 'bg-white border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30'}`} onClick={() => { fetch(item.audioUrl).then(r => r.arrayBuffer()).then(ab => audioContextRef.current?.decodeAudioData(ab)).then(b => b && playBuffer(b, item.audioUrl, 0)); setIsLibraryOpen(false); }}>
               <div className="flex justify-between items-start mb-2">
                 <span className="text-[9px] font-mono text-indigo-600 font-bold">{item.voice} ({item.lang})</span>
                 <span className="text-[8px] text-slate-400 font-mono">{item.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
               </div>
               <p className={`text-[11px] line-clamp-1 italic ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>"{item.text}"</p>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const settingsPanel = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-10">
        <h2 className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase">{t.config}</h2>
        <button onClick={() => setIsSettingsOpen(false)} className="lg:hidden text-slate-400"><i className="fa-solid fa-xmark"></i></button>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-12 pr-1 no-scrollbar pb-10">
        <div className="space-y-4">
           <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t.ttsLang}</label>
           <div className="grid grid-cols-1 gap-3">
              {SPEECH_LANGS.map(l => (
                <button key={l.id} onClick={() => setTtsLang(l.id)} className={`px-5 py-4 rounded-2xl border transition-all flex items-center gap-4 ${ttsLang === l.id ? 'bg-[#0ea5e9]/10 border-[#0ea5e9] text-[#0ea5e9] shadow-sm' : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-100'}`}>
                   <span className="text-xl">{l.flag}</span>
                   <span className="text-[11px] font-bold uppercase tracking-widest">{l.label}</span>
                   {ttsLang === l.id && <i className="fa-solid fa-check ml-auto text-xs"></i>}
                </button>
              ))}
           </div>
        </div>

        <div className="space-y-4">
           <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t.speed}</label>
           <div className="grid grid-cols-2 gap-2">
              {EXAM_SPEEDS.map(s => (
                <button key={s.id} onClick={() => setSpeed(s.id)} className={`px-4 py-3 rounded-xl border transition-all flex flex-col gap-1 items-start ${speed === s.id ? 'bg-[#1e1b4b] border-[#1e1b4b] text-white shadow-lg' : 'bg-white border-slate-100 text-slate-600 hover:bg-indigo-50'}`}>
                  <span className="text-[10px] font-bold">{s.label[lang]}</span>
                  <span className="text-[8px] font-mono opacity-60 uppercase">{s.cefr}</span>
                </button>
              ))}
           </div>
        </div>

        <div className="space-y-4">
           <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t.speakers}</label>
           <div className="space-y-3">
             {mode === 'single' ? (
               Object.values(VoiceName).map(v => (
                 <button key={v} onClick={() => setSelectedVoice(v)} className={`w-full p-4 rounded-2xl border transition-all flex items-center gap-4 card-shadow ${selectedVoice === v ? 'bg-indigo-50 border-indigo-200 text-indigo-900 ring-1 ring-indigo-200' : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-100'}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${VoiceDescriptions[v].gender === 'male' ? 'bg-blue-500/10 text-blue-600' : 'bg-pink-500/10 text-pink-600'}`}>
                       <i className={`fa-solid ${VoiceDescriptions[v].gender === 'male' ? 'fa-mars' : 'fa-venus'} text-[10px]`}></i>
                    </div>
                    <div className="text-left">
                       <span className={`block text-[12px] font-extrabold ${theme === 'dark' ? 'text-white' : 'text-[#1e1b4b]'}`}>{v}</span>
                       <span className="text-[9px] text-slate-400 font-bold uppercase">{VoiceDescriptions[v][lang]}</span>
                    </div>
                 </button>
               ))
             ) : (
               speakers.map((s, idx) => (
                 <div key={s.id} className={`p-4 border rounded-2xl space-y-4 bg-white border-slate-100 card-shadow`}>
                    <div className="flex items-center gap-2">
                      <input value={s.name} onChange={e => {const n=[...speakers]; n[idx].name=e.target.value; setSpeakers(n);}} className="bg-transparent border-none p-0 text-xs font-bold focus:ring-0 w-full uppercase text-[#1e1b4b]" placeholder="İSİM" />
                      {speakers.length > 2 && (
                        <button onClick={() => setSpeakers(speakers.filter(sp => sp.id !== s.id))} className="text-red-300 hover:text-red-500 transition-all"><i className="fa-solid fa-circle-xmark"></i></button>
                      )}
                    </div>
                    <select value={s.voice} onChange={e => {const n=[...speakers]; n[idx].voice=e.target.value as VoiceName; setSpeakers(n);}} className="w-full border border-slate-100 bg-slate-50 rounded-xl px-3 py-2 text-[10px] font-bold outline-none uppercase text-indigo-600 cursor-pointer">
                       {Object.values(VoiceName).map(v => <option key={v} value={v}>{v} ({VoiceDescriptions[v].gender === 'male' ? 'M' : 'F'})</option>)}
                    </select>
                 </div>
               ))
             )}
             {mode === 'multi' && speakers.length < 5 && (
               <button onClick={() => setSpeakers([...speakers, { id: Date.now().toString(), name: `Karakter ${speakers.length + 1}`, voice: VoiceName.Puck }])} className="w-full py-3 border-2 border-dashed border-slate-100 rounded-2xl text-[9px] font-bold text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all">+ KARAKTER EKLE</button>
             )}
           </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`flex flex-col h-screen overflow-hidden ${theme === 'dark' ? 'bg-[#020617] text-slate-200' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Header */}
      <header className={`h-14 lg:h-16 flex items-center justify-between px-4 lg:px-8 border-b ${theme === 'dark' ? 'bg-[#0f172a] border-white/5' : 'bg-[#1e1b4b] border-indigo-900'} premium-blur z-[60] shadow-md shrink-0`}>
        <div className="flex items-center gap-3 lg:gap-6">
          <button onClick={toggleLibrary} className="lg:hidden w-10 h-10 flex items-center justify-center text-white/80"><i className="fa-solid fa-folder-tree"></i></button>
          <div className="flex items-center gap-2 group cursor-pointer">
            <div className={`relative w-7 h-7 lg:w-8 lg:h-8 rounded-lg flex items-center justify-center shadow-lg overflow-hidden ${theme === 'dark' ? 'bg-indigo-600' : 'bg-orange-500'}`}>
               <svg viewBox="0 0 100 100" className="w-4 h-4 lg:w-5 lg:h-5 text-white relative z-10">
                 <rect x="20" y="40" width="8" height="20" rx="4" fill="currentColor" />
                 <rect x="35" y="25" width="8" height="50" rx="4" fill="currentColor" />
                 <rect x="50" y="15" width="8" height="70" rx="4" fill="currentColor" />
                 <rect x="65" y="30" width="8" height="40" rx="4" fill="currentColor" />
                 <rect x="80" y="45" width="8" height="10" rx="4" fill="currentColor" />
               </svg>
            </div>
            <div className="flex flex-col">
              <h1 className="text-base lg:text-xl font-extrabold tracking-tighter font-display leading-none text-white">
                {t.studio}<span className="text-orange-500">.</span>
              </h1>
              <span className="hidden lg:block text-[8px] font-mono tracking-[0.3em] uppercase mt-0.5 leading-none text-indigo-300">{t.tagline}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 lg:gap-6">
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={`w-8 h-8 lg:w-10 lg:h-10 rounded-full border flex items-center justify-center transition-all ${theme === 'dark' ? 'border-white/10 text-slate-400 hover:text-white' : 'border-white/20 text-indigo-200 hover:text-white hover:bg-white/10'}`}>
            <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'} text-xs lg:text-base`}></i>
          </button>
          
          <button onClick={() => setShowTips(true)} className={`text-[9px] lg:text-[10px] font-bold tracking-widest transition-all border px-2.5 lg:px-4 py-1.5 lg:py-2 rounded-full flex items-center gap-2 ${theme === 'dark' ? 'text-slate-400 border-white/5 hover:text-white' : 'text-indigo-200 border-white/10 hover:text-white'}`}>
            <i className="fa-solid fa-lightbulb text-orange-400"></i> <span className="hidden sm:inline">{lang === 'tr' ? 'REHBER' : 'GUIDE'}</span>
          </button>
          
          <div className={`hidden sm:flex items-center gap-2 p-1 border rounded-full ${theme === 'dark' ? 'bg-white/[0.03] border-white/5' : 'bg-black/[0.1] border-white/10'}`}>
            <button onClick={() => setLang('tr')} className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-all ${lang === 'tr' ? 'bg-orange-500 text-white shadow-sm' : 'text-indigo-300'}`}>TR</button>
            <button onClick={() => setLang('en')} className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-all ${lang === 'en' ? 'bg-orange-500 text-white shadow-sm' : 'text-indigo-300'}`}>EN</button>
          </div>

          <button onClick={toggleSettings} className="lg:hidden w-10 h-10 flex items-center justify-center text-white/80"><i className="fa-solid fa-sliders"></i></button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        
        {/* Left Library (Desktop Sidebar / Mobile Drawer) */}
        <aside className={`fixed inset-y-0 left-0 w-80 lg:relative lg:w-64 lg:translate-x-0 z-50 transform transition-transform duration-300 ease-in-out border-r p-6 flex flex-col ${isLibraryOpen ? 'translate-x-0' : '-translate-x-full'} ${theme === 'dark' ? 'bg-[#0f172a] border-white/[0.04]' : 'bg-white lg:bg-transparent border-indigo-100'}`}>
          {libraryPanel}
        </aside>

        {/* Center Stage */}
        <section className="flex-1 flex flex-col overflow-hidden canvas-bg w-full">
          {/* Editor Header */}
          <div className="flex items-center justify-between px-4 lg:px-10 py-3 lg:py-6 shrink-0 overflow-x-auto no-scrollbar gap-4">
             <div className={`flex p-1 rounded-xl border shrink-0 ${theme === 'dark' ? 'bg-white/[0.04] border-white/5' : 'bg-indigo-50/50 border-indigo-100'}`}>
                <button onClick={() => setMode('single')} className={`px-4 lg:px-6 py-2 rounded-lg text-[10px] font-bold transition-all ${mode === 'single' ? (theme === 'dark' ? 'bg-white text-black' : 'bg-[#1e1b4b] text-white shadow-sm') : 'text-indigo-400'}`}>{t.single}</button>
                <button onClick={() => setMode('multi')} className={`px-4 lg:px-6 py-2 rounded-lg text-[10px] font-bold transition-all ${mode === 'multi' ? (theme === 'dark' ? 'bg-white text-black' : 'bg-[#1e1b4b] text-white shadow-sm') : 'text-indigo-400'}`}>{t.multi}</button>
             </div>

             <div className="flex items-center gap-3 lg:gap-4 overflow-x-auto no-scrollbar pb-1">
               <div className="flex items-center gap-1.5 shrink-0">
                 {VOCAL_FX.map(fx => (
                   <button key={fx.tag} onClick={() => insertFx(fx.tag)} className={`px-2.5 py-1.5 border rounded-lg text-[9px] font-bold text-indigo-500 transition-all shrink-0 ${theme === 'dark' ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-white border-indigo-100 hover:bg-indigo-50'}`}>
                     {fx.label[lang]}
                   </button>
                 ))}
               </div>
               
               <div className="h-4 w-[1px] bg-indigo-100 shrink-0"></div>
               <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[9px] font-bold text-slate-400 uppercase shrink-0">{t.examples}:</span>
                  {EXAMPLE_TEXTS[ttsLang].map((ex, i) => (
                    <button key={i} onClick={() => loadExample(ex)} className={`px-2.5 py-1.5 border rounded-lg text-[9px] font-bold shrink-0 transition-all ${theme === 'dark' ? 'bg-white/5 border-white/5 text-slate-400 hover:text-white' : 'bg-[#0ea5e9]/5 border-[#0ea5e9]/20 text-[#0ea5e9] hover:bg-[#0ea5e9]/10'}`}>
                      #{i+1}
                    </button>
                  ))}
               </div>
             </div>
          </div>

          {/* Main Area: Flex container to manage Editor vs Controls */}
          <div className="flex-1 px-4 lg:px-10 pb-3 lg:pb-8 overflow-hidden flex flex-col min-h-0">
            {/* Editor Box */}
            <div className={`flex-1 border rounded-[1.5rem] lg:rounded-[2.5rem] p-4 lg:p-12 overflow-hidden flex flex-col card-shadow relative min-h-0 ${theme === 'dark' ? 'bg-white/[0.02] border-white/[0.05]' : 'bg-white border-indigo-50'}`}>
              {mode === 'single' ? (
                <textarea 
                  value={text} 
                  onChange={e => setText(e.target.value)} 
                  placeholder={t.placeholder}
                  className={`w-full h-full bg-transparent border-none outline-none focus:ring-0 text-base lg:text-3xl font-light leading-relaxed custom-scrollbar resize-none ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}
                />
              ) : (
                <div className="h-full overflow-y-auto space-y-6 lg:space-y-8 pr-2 custom-scrollbar">
                  {dialogue.map((item, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row gap-2 sm:gap-10 group animate-in fade-in slide-in-from-bottom-2">
                      <div className="shrink-0 flex flex-row sm:flex-col gap-3 items-center sm:items-stretch">
                        <div className={`px-3 lg:px-4 py-1.5 lg:py-2 border rounded-xl text-[9px] lg:text-[10px] font-bold uppercase min-w-[70px] lg:min-w-[100px] text-center ${theme === 'dark' ? 'bg-white/[0.03] border-white/[0.08] text-slate-400' : 'bg-indigo-50/50 border-indigo-100 text-indigo-600'}`}>
                          {speakers.find(s => s.id === item.speakerId)?.name || 'Anonim'}
                        </div>
                        <button onClick={() => setDialogue(dialogue.filter((_, i) => i !== idx))} className="sm:opacity-0 group-hover:opacity-100 transition-all text-slate-400 hover:text-red-500 text-xs text-center"><i className="fa-solid fa-trash"></i></button>
                      </div>
                      <textarea 
                        value={item.text} 
                        onChange={e => { const n = [...dialogue]; n[idx].text = e.target.value; setDialogue(n); }}
                        className={`flex-1 bg-transparent border-none outline-none focus:ring-0 text-sm lg:text-xl font-light pt-1 resize-none ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}
                        rows={1}
                        onInput={(e: any) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                      />
                    </div>
                  ))}
                  <button onClick={() => setDialogue([...dialogue, { speakerId: speakers[0].id, text: '' }])} className="w-full py-4 lg:py-6 border-2 border-dashed rounded-2xl lg:rounded-3xl text-indigo-300 hover:text-indigo-600 hover:border-indigo-300 transition-all text-[10px] lg:text-[11px] font-bold uppercase tracking-widest">+ Satır Ekle</button>
                </div>
              )}
            </div>

            {/* Playback Controls & Timeline Area - Fixed size to prevent push-out */}
            <div className="mt-3 lg:mt-6 shrink-0 space-y-3 lg:space-y-6">
               <div className="flex flex-col gap-1.5">
                 <div className="flex justify-between px-1">
                   <span className="text-[8px] lg:text-[9px] font-mono text-slate-400 font-bold">{currentTime.toFixed(1)}s</span>
                   <span className="text-[8px] lg:text-[9px] font-mono text-slate-400 font-bold">{duration.toFixed(1)}s</span>
                 </div>
                 <div className="relative h-1 w-full group">
                   <input 
                    type="range"
                    min="0"
                    max={duration || 0}
                    step="0.1"
                    value={currentTime}
                    onChange={handleSeek}
                    className="absolute inset-0 w-full h-1 appearance-none bg-transparent cursor-pointer z-20 seek-slider"
                   />
                   <div className="absolute inset-0 h-1 bg-indigo-50 border border-indigo-100 rounded-full z-0 overflow-hidden">
                     <div 
                        className="h-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all duration-100 ease-linear" 
                        style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                      ></div>
                   </div>
                 </div>
               </div>

               <AudioVisualizer analyser={analyserRef.current} isPlaying={isPlaying} />
               
               <div className="flex flex-col sm:flex-row items-center gap-3 lg:gap-10">
                  <div className="flex items-center gap-3 lg:gap-4 w-full sm:w-auto justify-between sm:justify-start">
                    <div className="flex items-center gap-1 lg:gap-2 p-1 bg-slate-100/50 rounded-2xl border border-slate-200/50">
                      <button onClick={() => skip(-5)} className={`w-8 h-8 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center transition-all ${!activeBuffer ? 'text-slate-300' : 'text-[#1e1b4b] hover:bg-white hover:shadow-sm'}`} title="-5s"><i className="fa-solid fa-backward-step text-[10px] lg:text-base"></i></button>
                      <button onClick={stopAudio} className={`w-8 h-8 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center transition-all ${!activeBuffer ? 'text-slate-300' : 'text-red-500 hover:bg-white hover:shadow-sm'}`} title="Stop"><i className="fa-solid fa-stop text-[10px] lg:text-base"></i></button>
                      <button onClick={togglePlayback} className={`w-10 h-10 lg:w-14 lg:h-14 rounded-xl flex items-center justify-center transition-all ${!activeBuffer ? 'bg-slate-200 text-slate-400' : 'bg-[#1e1b4b] text-white shadow-lg hover:scale-105 active:scale-95'}`}><i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} text-sm lg:text-lg`}></i></button>
                      <button onClick={() => skip(5)} className={`w-8 h-8 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center transition-all ${!activeBuffer ? 'text-slate-300' : 'text-[#1e1b4b] hover:bg-white hover:shadow-sm'}`} title="+5s"><i className="fa-solid fa-forward-step text-[10px] lg:text-base"></i></button>
                    </div>

                    <div className="flex flex-col gap-0 ml-1">
                      <span className={`font-mono text-[10px] lg:text-sm font-bold tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-[#1e1b4b]'}`}>
                        {Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(1).padStart(4, '0')}
                      </span>
                      <span className="text-[7px] lg:text-[9px] text-slate-400 font-bold uppercase">Zaman</span>
                    </div>
                  </div>

                  <div className="flex gap-2 w-full sm:flex-1">
                    <button onClick={handleGenerate} disabled={isGenerating} className={`flex-1 h-11 lg:h-14 rounded-xl lg:rounded-2xl font-bold text-[9px] lg:text-xs tracking-[0.2em] lg:tracking-[0.4em] uppercase text-white transition-all btn-orange active:scale-[0.98]`}>
                      {isGenerating ? <i className="fa-solid fa-circle-notch fa-spin mr-2 lg:mr-3"></i> : <i className="fa-solid fa-bolt mr-2 lg:mr-3"></i>}
                      {isGenerating ? '...' : t.generate}
                    </button>

                    {activeWavUrl && (
                      <a href={activeWavUrl} download={generateDownloadName()} className={`h-11 lg:h-14 px-3 lg:px-8 border rounded-xl lg:rounded-2xl flex items-center justify-center lg:justify-start gap-2 lg:gap-3 transition-all ${theme === 'dark' ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' : 'border-emerald-500/20 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                         <i className="fa-solid fa-cloud-arrow-down text-xs lg:text-base"></i>
                         <span className="hidden sm:inline text-[9px] lg:text-[10px] font-bold uppercase tracking-widest">{t.download}</span>
                      </a>
                    )}
                  </div>
               </div>
            </div>
          </div>
        </section>

        {/* Right Sidebar (Desktop Sidebar / Mobile Drawer) */}
        <aside className={`fixed inset-y-0 right-0 w-80 lg:relative lg:w-80 lg:translate-x-0 transform transition-transform duration-300 ease-in-out border-l p-8 flex flex-col z-50 ${isSettingsOpen ? 'translate-x-0' : 'translate-x-full'} ${theme === 'dark' ? 'bg-[#0f172a] border-white/[0.04]' : 'bg-white lg:bg-transparent border-indigo-100'}`}>
           {settingsPanel}
        </aside>

        {/* Mobile Backdrop for Drawers */}
        {(isLibraryOpen || isSettingsOpen) && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden" onClick={() => { setIsLibraryOpen(false); setIsSettingsOpen(false); }}></div>
        )}

      </main>

      {/* Guide Modal */}
      {showTips && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#1e1b4b]/80 backdrop-blur-md" onClick={() => setShowTips(false)}></div>
          <div className={`w-full max-w-md border rounded-[1.5rem] lg:rounded-[2rem] p-6 lg:p-10 relative z-10 shadow-2xl max-h-[90vh] overflow-y-auto ${theme === 'dark' ? 'bg-[#0f172a] border-white/10' : 'bg-white border-white/10'}`}>
            <h3 className={`text-lg lg:text-xl font-extrabold mb-6 flex items-center gap-3 ${theme === 'dark' ? 'text-white' : 'text-[#1e1b4b]'}`}>{t.tipsTitle}</h3>
            <p className="text-xs lg:text-sm text-slate-400 mb-6 lg:mb-8 leading-relaxed">{t.tipsDesc}</p>
            <div className="grid grid-cols-2 gap-2 lg:gap-3 mb-8">
              {VOCAL_FX.map(fx => (
                <div key={fx.tag} className={`p-3 lg:p-4 rounded-xl lg:rounded-2xl border ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-indigo-50 border-indigo-50'}`}>
                  <span className="block text-orange-500 font-mono text-[10px] lg:text-[11px] mb-1 font-bold">{fx.tag}</span>
                  <span className="text-[8px] lg:text-[10px] text-slate-400 uppercase font-bold">{fx.label[lang]}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2 lg:space-y-3 mb-8">
               <div className="flex gap-4 items-center p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-xs font-bold text-[#1e1b4b] w-8">ABC</span>
                  <p className="text-[10px] lg:text-[11px] text-slate-500 font-medium">{t.uppercaseTip}</p>
               </div>
               <div className="flex gap-4 items-center p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-xs font-bold text-[#1e1b4b] w-8">...</span>
                  <p className="text-[10px] lg:text-[11px] text-slate-500 font-medium">{t.pauseTip}</p>
               </div>
            </div>
            <button onClick={() => setShowTips(false)} className={`w-full py-4 font-bold text-xs uppercase tracking-widest rounded-2xl transition-all shadow-md ${theme === 'dark' ? 'bg-white text-black' : 'bg-[#1e1b4b] text-white hover:bg-indigo-900'}`}>
              {t.close}
            </button>
          </div>
        </div>
      )}

      <style>{`
        .seek-slider::-webkit-slider-thumb {
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #f97316;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.2);
        }
        .seek-slider::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #f97316;
          cursor: pointer;
          border: 2px solid white;
        }
        @media (max-width: 1024px) {
          .canvas-bg {
            background-image: none;
            background-color: var(--bg);
          }
        }
        @media (max-height: 600px) {
           .header-studio { display: none; }
        }
      `}</style>

    </div>
  );
};

export default App;
