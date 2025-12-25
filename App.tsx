
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { VoiceName, SpeakerConfig, DialogueItem, AudioGenerationHistory, SpeechSpeed, AppLang, VoiceDescriptions } from './types';
import { generateSingleSpeakerAudio, generateMultiSpeakerAudio, audioBufferToWavBlob, enrichTextWithAI, EmotionVibe } from './services/geminiService';
import AudioVisualizer from './components/AudioVisualizer';

const EXAM_SPEEDS: { id: SpeechSpeed; label: string; cefr: string }[] = [
  { id: 'v-slow', label: 'Very Slow', cefr: 'A1 Dictation' },
  { id: 'slow', label: 'Slow', cefr: 'A2 Learner' },
  { id: 'normal', label: 'Normal', cefr: 'B1 Native' },
  { id: 'fast', label: 'Fast', cefr: 'C1 Fluent' },
];

const EMOTION_CHIPS: { id: EmotionVibe; label: { tr: string, en: string }; icon: string }[] = [
  { id: 'natural', label: { tr: 'Doğal', en: 'Natural' }, icon: 'fa-wave-square' },
  { id: 'friendly', label: { tr: 'Sıcak', en: 'Warm' }, icon: 'fa-heart' },
  { id: 'tense', label: { tr: 'Gergin', en: 'Tense' }, icon: 'fa-bolt' },
  { id: 'dramatic', label: { tr: 'Drama', en: 'Dramatic' }, icon: 'fa-masks-theater' },
];

const VOCAL_FX = [
  { tag: '[laughs]', label: 'Laugh' },
  { tag: '[sighs]', label: 'Sigh' },
  { tag: '[clears throat]', label: 'Clear' },
  { tag: '[breathes in]', label: 'Inhale' },
  { tag: '[whispers]', label: 'Whisper' },
  { tag: '[hesitates]', label: 'Pause' },
];

const translations = {
  tr: {
    studio: 'Kulaq',
    tagline: 'MASTER GRADE AI AUDIO',
    generate: 'SESLENDİR',
    history: 'KÜTÜPHANE',
    config: 'MÜHENDİSLİK',
    speakers: 'KARAKTERLER',
    vibe: 'DUYGU MODU',
    speed: 'TEMPO',
    enrich: 'YAPAY ZEKA DOKUNUŞU',
    download: 'WAV İNDİR',
    single: 'SOLO SCRIPT',
    multi: 'DİYALOG MODU',
    placeholder: 'Metni buraya girin veya diyalog ekleyin...',
    tipsTitle: 'Stüdyo Rehberi',
    tipsDesc: 'Seslendirmeye doğallık katmak için bu efektleri metne ekleyin:',
    uppercaseTip: 'Vurgu için KELİMEYİ BÜYÜK YAZIN.',
    pauseTip: 'Daha uzun duraksamalar için "..." kullanın.',
    close: 'Kapat'
  },
  en: {
    studio: 'Kulaq',
    tagline: 'MASTER GRADE AI AUDIO',
    generate: 'GENERATE',
    history: 'LIBRARY',
    config: 'ENGINEERING',
    speakers: 'TALENT',
    vibe: 'EMOTION',
    speed: 'TEMPO',
    enrich: 'ENRICH AI',
    download: 'EXPORT WAV',
    single: 'SOLO SCRIPT',
    multi: 'MULTI SPEAKER',
    placeholder: 'Type your script or add dialogue lines...',
    tipsTitle: 'Studio Guide',
    tipsDesc: 'Add these tags into your text for natural performance:',
    uppercaseTip: 'Write words in UPPERCASE for extra stress.',
    pauseTip: 'Use "..." for meaningful silences.',
    close: 'Close'
  }
};

const App: React.FC = () => {
  const [lang, setLang] = useState<AppLang>('tr');
  const [mode, setMode] = useState<'single' | 'multi'>('single');
  const [selectedVibe, setSelectedVibe] = useState<EmotionVibe>('natural');
  const [showTips, setShowTips] = useState(false);
  const t = translations[lang];

  // States
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>(VoiceName.Zephyr);
  const [speed, setSpeed] = useState<SpeechSpeed>('normal');
  const [history, setHistory] = useState<AudioGenerationHistory[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  
  // Multi-Speaker States
  const [speakers, setSpeakers] = useState<SpeakerConfig[]>([
    { id: 's1', name: 'Narrator', voice: VoiceName.Zephyr },
    { id: 's2', name: 'Student', voice: VoiceName.Puck }
  ]);
  const [dialogue, setDialogue] = useState<DialogueItem[]>([
    { speakerId: 's1', text: "Welcome to Kulaq Studio." },
    { speakerId: 's2', text: "[breathes in] I am so excited to be here!" }
  ]);

  // Audio Control States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [activeBuffer, setActiveBuffer] = useState<AudioBuffer | null>(null);
  const [activeWavUrl, setActiveWavUrl] = useState<string | null>(null);

  const updateProgress = useCallback(() => {
    if (!audioContextRef.current || !isPlaying) return;
    const now = audioContextRef.current.currentTime;
    const elapsed = now - (window as any).startTime || 0;
    if (elapsed >= duration) {
      setIsPlaying(false);
      setCurrentTime(duration);
    } else {
      setCurrentTime(elapsed);
      requestAnimationFrame(updateProgress);
    }
  }, [isPlaying, duration]);

  useEffect(() => {
    if (isPlaying) requestAnimationFrame(updateProgress);
  }, [isPlaying, updateProgress]);

  const stopAudio = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch (e) {}
      sourceRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const playBuffer = (buffer: AudioBuffer, url?: string) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.connect(audioContextRef.current.destination);
    }
    stopAudio();
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(analyserRef.current!);
    source.onended = () => setIsPlaying(false);
    
    (window as any).startTime = audioContextRef.current.currentTime;
    source.start(0);
    sourceRef.current = source;
    setIsPlaying(true);
    setActiveBuffer(buffer);
    setDuration(buffer.duration);
    if (url) setActiveWavUrl(url);
  };

  const handleGenerate = async () => {
    const input = mode === 'single' ? text : dialogue.map(d => d.text).join(' ');
    if (!input.trim()) return;
    setIsGenerating(true);
    try {
      let buffer: AudioBuffer;
      if (mode === 'single') {
        buffer = await generateSingleSpeakerAudio(text, selectedVoice, "", speed);
      } else {
        buffer = await generateMultiSpeakerAudio(dialogue, speakers, speed);
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
        lang
      }, ...prev]);
      playBuffer(buffer, url);
    } catch (e) { console.error(e); } finally { setIsGenerating(false); }
  };

  const handleEnrich = async () => {
    setIsEnriching(true);
    try {
      if (mode === 'single') {
        setText(await enrichTextWithAI(text, selectedVibe));
      } else {
        const enriched = await Promise.all(dialogue.map(async d => ({
          ...d, text: d.text.trim() ? await enrichTextWithAI(d.text, selectedVibe) : ""
        })));
        setDialogue(enriched);
      }
    } catch (e) { console.error(e); } finally { setIsEnriching(false); }
  };

  const insertFx = (fx: string) => {
    if (mode === 'single') {
      setText(prev => prev + ' ' + fx + ' ');
    } else {
      const n = [...dialogue];
      n[n.length - 1].text += ' ' + fx + ' ';
      setDialogue(n);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-black text-slate-200">
      
      {/* Premium Header with Logo */}
      <header className="h-16 flex items-center justify-between px-8 border-b border-white/[0.06] premium-blur z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 group cursor-pointer">
            <div className="relative w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 overflow-hidden">
               {/* Minimalist Logo Icon */}
               <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent"></div>
               <svg viewBox="0 0 100 100" className="w-5 h-5 text-white relative z-10">
                 <rect x="20" y="40" width="8" height="20" rx="4" fill="currentColor" />
                 <rect x="35" y="25" width="8" height="50" rx="4" fill="currentColor" />
                 <rect x="50" y="15" width="8" height="70" rx="4" fill="currentColor" />
                 <rect x="65" y="30" width="8" height="40" rx="4" fill="currentColor" />
                 <rect x="80" y="45" width="8" height="10" rx="4" fill="currentColor" />
               </svg>
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-extrabold tracking-tighter text-white font-display leading-none">
                {t.studio}<span className="text-indigo-500">.</span>
              </h1>
              <span className="text-[8px] font-mono tracking-[0.3em] text-slate-600 uppercase mt-0.5 leading-none">{t.tagline}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <button 
            onClick={() => setShowTips(true)}
            className="text-[10px] font-bold tracking-widest text-slate-500 hover:text-white transition-all border border-white/5 px-4 py-2 rounded-full flex items-center gap-2"
          >
            <i className="fa-solid fa-lightbulb text-indigo-400"></i> TIPS
          </button>
          <div className="flex items-center gap-2 p-1 bg-white/[0.03] border border-white/5 rounded-full">
            <button onClick={() => setLang('tr')} className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-all ${lang === 'tr' ? 'bg-white text-black' : 'text-slate-500 hover:text-white'}`}>TR</button>
            <button onClick={() => setLang('en')} className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-all ${lang === 'en' ? 'bg-white text-black' : 'text-slate-500 hover:text-white'}`}>EN</button>
          </div>
          <a href="https://instagram.com/can_akalin" target="_blank" className="text-[10px] font-bold tracking-widest text-slate-500 hover:text-indigo-400 transition-all">@CAN_AKALIN</a>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Left: Library */}
        <aside className="w-64 border-r border-white/[0.04] flex flex-col p-6 overflow-hidden">
          <h2 className="text-[10px] font-bold text-slate-500 tracking-[0.2em] mb-6 uppercase font-display">{t.history}</h2>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 no-scrollbar">
            {history.length === 0 ? (
              <div className="h-32 flex flex-col items-center justify-center opacity-10">
                <i className="fa-solid fa-folder-open mb-2"></i>
                <span className="text-[9px] uppercase font-bold">Empty</span>
              </div>
            ) : (
              history.map(item => (
                <div key={item.id} className="group relative p-4 bg-white/[0.02] border border-white/[0.03] rounded-2xl hover:bg-white/[0.05] transition-all cursor-pointer" onClick={() => fetch(item.audioUrl).then(r => r.arrayBuffer()).then(ab => audioContextRef.current?.decodeAudioData(ab)).then(b => b && playBuffer(b, item.audioUrl))}>
                   <div className="flex justify-between items-start mb-2">
                     <span className="text-[9px] font-mono text-indigo-400">{item.voice}</span>
                     <span className="text-[8px] text-slate-600 uppercase font-mono">{item.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                   </div>
                   <p className="text-[11px] text-slate-400 line-clamp-1 italic font-light">"{item.text}"</p>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Center: Stage */}
        <section className="flex-1 flex flex-col overflow-hidden canvas-bg">
          <div className="flex items-center justify-between px-10 py-6 shrink-0">
             <div className="flex bg-white/[0.04] p-1 rounded-xl border border-white/5">
                <button onClick={() => setMode('single')} className={`px-6 py-2 rounded-lg text-[10px] font-bold transition-all ${mode === 'single' ? 'bg-white text-black' : 'text-slate-500'}`}>{t.single}</button>
                <button onClick={() => setMode('multi')} className={`px-6 py-2 rounded-lg text-[10px] font-bold transition-all ${mode === 'multi' ? 'bg-white text-black' : 'text-slate-500'}`}>{t.multi}</button>
             </div>

             {/* Quick Vocal FX Toolbar */}
             <div className="flex items-center gap-2">
               {VOCAL_FX.map(fx => (
                 <button key={fx.tag} onClick={() => insertFx(fx.tag)} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-[9px] font-bold text-slate-400 transition-all">
                   {fx.label}
                 </button>
               ))}
               <div className="w-[1px] h-4 bg-white/10 mx-2"></div>
               <button onClick={handleEnrich} disabled={isEnriching} className="px-6 py-2 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-xl text-[10px] font-bold hover:bg-indigo-600/20 transition-all flex items-center gap-2">
                 {isEnriching ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-sparkles"></i>}
                 {t.enrich}
               </button>
             </div>
          </div>

          <div className="flex-1 px-10 pb-10 overflow-hidden flex flex-col">
            <div className="flex-1 bg-white/[0.02] border border-white/[0.05] rounded-[2.5rem] p-12 overflow-hidden flex flex-col shadow-2xl relative">
              {mode === 'single' ? (
                <textarea 
                  value={text} 
                  onChange={e => setText(e.target.value)} 
                  placeholder={t.placeholder}
                  className="w-full h-full bg-transparent border-none outline-none focus:ring-0 text-3xl font-light leading-relaxed placeholder:text-white/[0.05] custom-scrollbar resize-none"
                />
              ) : (
                <div className="h-full overflow-y-auto space-y-8 pr-4 custom-scrollbar">
                  {dialogue.map((item, idx) => (
                    <div key={idx} className="flex gap-10 group animate-in fade-in slide-in-from-bottom-2">
                      <div className="shrink-0 flex flex-col gap-3">
                        <div className="px-4 py-2 bg-white/[0.03] border border-white/[0.08] rounded-xl text-[10px] font-bold text-slate-400 uppercase min-w-[100px] text-center">
                          {speakers.find(s => s.id === item.speakerId)?.name || 'Guest'}
                        </div>
                        <button onClick={() => setDialogue(dialogue.filter((_, i) => i !== idx))} className="opacity-0 group-hover:opacity-100 transition-all text-slate-600 hover:text-red-500 text-xs text-center"><i className="fa-solid fa-trash"></i></button>
                      </div>
                      <textarea 
                        value={item.text} 
                        onChange={e => { const n = [...dialogue]; n[idx].text = e.target.value; setDialogue(n); }}
                        className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-xl font-light leading-snug pt-1 resize-none"
                        rows={1}
                        onInput={(e: any) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                      />
                    </div>
                  ))}
                  <button onClick={() => setDialogue([...dialogue, { speakerId: speakers[0].id, text: '' }])} className="w-full py-8 border-2 border-dashed border-white/[0.03] rounded-3xl text-slate-700 hover:text-indigo-400 hover:border-indigo-500/20 transition-all text-[11px] font-bold uppercase tracking-widest">+ Add New Line</button>
                </div>
              )}
            </div>

            {/* Global Playback Bar */}
            <div className="mt-10 shrink-0">
               <AudioVisualizer analyser={analyserRef.current} isPlaying={isPlaying} />
               <div className="mt-8 flex items-center gap-10">
                  <div className="flex items-center gap-6">
                    <button onClick={isPlaying ? stopAudio : () => activeBuffer && playBuffer(activeBuffer)} className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${!activeBuffer ? 'bg-white/5 text-slate-800' : 'bg-white text-black hover:scale-105 active:scale-95 shadow-xl shadow-white/10'}`}>
                      <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} text-xl`}></i>
                    </button>
                    <div className="flex flex-col gap-1">
                      <span className="text-white font-mono text-sm font-bold">{currentTime.toFixed(1)}s</span>
                      <span className="text-[10px] text-slate-600 font-mono tracking-tighter uppercase">/ {duration.toFixed(1)}s Total</span>
                    </div>
                  </div>

                  <button onClick={handleGenerate} disabled={isGenerating} className={`flex-1 h-16 rounded-2xl font-bold text-xs tracking-[0.4em] uppercase text-white transition-all shadow-lg overflow-hidden relative ${isGenerating ? 'bg-slate-900' : 'bg-gradient-to-r from-indigo-700 to-indigo-500 hover:shadow-indigo-500/20 hover:-translate-y-0.5'}`}>
                    {isGenerating && <div className="absolute inset-0 bg-white/10 animate-pulse"></div>}
                    <span className="relative z-10">
                      {isGenerating ? <i className="fa-solid fa-circle-notch fa-spin mr-3"></i> : <i className="fa-solid fa-bolt mr-3"></i>}
                      {isGenerating ? 'Processing...' : t.generate}
                    </span>
                  </button>

                  {activeWavUrl && (
                    <a href={activeWavUrl} download="kulaq-master.wav" className="h-16 px-10 border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center gap-3 transition-all">
                       <i className="fa-solid fa-cloud-arrow-down"></i>
                       <span className="text-[10px] font-bold uppercase tracking-widest">{t.download}</span>
                    </a>
                  )}
               </div>
            </div>
          </div>
        </section>

        {/* Right: Controls */}
        <aside className="w-80 border-l border-white/[0.04] flex flex-col p-8 overflow-hidden">
           <h2 className="text-[10px] font-bold text-slate-500 tracking-[0.2em] mb-10 uppercase font-display">{t.config}</h2>
           
           <div className="flex-1 overflow-y-auto space-y-12 pr-1 no-scrollbar pb-10">
              
              {/* Emotion Section */}
              <div className="space-y-4">
                 <label className="text-[9px] font-bold text-slate-600 uppercase tracking-widest ml-1">{t.vibe}</label>
                 <div className="grid grid-cols-2 gap-3">
                    {EMOTION_CHIPS.map(v => (
                      <button key={v.id} onClick={() => setSelectedVibe(v.id)} className={`p-4 rounded-2xl border transition-all text-center flex flex-col items-center gap-3 ${selectedVibe === v.id ? 'bg-indigo-600 border-indigo-500 shadow-xl shadow-indigo-500/10' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                        <i className={`fa-solid ${v.icon} text-sm ${selectedVibe === v.id ? 'text-white' : 'text-indigo-400'}`}></i>
                        <span className={`text-[10px] font-bold uppercase tracking-tighter ${selectedVibe === v.id ? 'text-white' : 'text-slate-500'}`}>{v.label[lang]}</span>
                      </button>
                    ))}
                 </div>
              </div>

              {/* Tempo Section */}
              <div className="space-y-4">
                 <label className="text-[9px] font-bold text-slate-600 uppercase tracking-widest ml-1">{t.speed}</label>
                 <div className="grid grid-cols-1 gap-3">
                    {EXAM_SPEEDS.map(s => (
                      <button key={s.id} onClick={() => setSpeed(s.id)} className={`px-5 py-4 rounded-2xl border transition-all flex justify-between items-center ${speed === s.id ? 'bg-white border-white' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                        <span className={`text-[11px] font-bold ${speed === s.id ? 'text-black' : 'text-slate-300'}`}>{s.label}</span>
                        <span className={`text-[9px] font-mono font-bold uppercase ${speed === s.id ? 'text-black/40' : 'text-slate-600'}`}>{s.cefr}</span>
                      </button>
                    ))}
                 </div>
              </div>

              {/* Talent Section */}
              <div className="space-y-4">
                 <div className="flex justify-between items-center px-1">
                    <label className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">{t.speakers}</label>
                    {mode === 'multi' && <button onClick={() => setSpeakers([...speakers, {id: Date.now().toString(), name: 'Extra', voice: VoiceName.Kore}])} className="text-[9px] font-bold text-indigo-400 hover:text-white transition-all">+ ADD</button>}
                 </div>
                 
                 <div className="space-y-3">
                   {mode === 'single' ? (
                     Object.values(VoiceName).map(v => (
                       <button key={v} onClick={() => setSelectedVoice(v)} className={`w-full p-4 rounded-2xl border transition-all flex items-center justify-between group ${selectedVoice === v ? 'bg-indigo-600/10 border-indigo-500/40' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                         <div className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${VoiceDescriptions[v].gender === 'male' ? 'bg-blue-600/10 text-blue-400' : 'bg-pink-600/10 text-pink-400'}`}>
                               <i className={`fa-solid ${VoiceDescriptions[v].gender === 'male' ? 'fa-mars' : 'fa-venus'} text-[10px]`}></i>
                            </div>
                            <div className="text-left">
                               <span className="block text-[12px] font-bold tracking-tight text-white">{v}</span>
                               <span className="text-[9px] text-slate-500 uppercase font-bold">{VoiceDescriptions[v][lang]}</span>
                            </div>
                         </div>
                         {selectedVoice === v && <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>}
                       </button>
                     ))
                   ) : (
                     speakers.map((s, idx) => (
                       <div key={s.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-4 group transition-all hover:bg-white/[0.08]">
                          <div className="flex items-center gap-3">
                             <input value={s.name} onChange={e => {const n=[...speakers]; n[idx].name=e.target.value; setSpeakers(n);}} className="bg-transparent border-none p-0 text-xs font-bold focus:ring-0 w-full uppercase text-white placeholder:text-slate-800" placeholder="NAME" />
                             {speakers.length > 1 && <button onClick={() => setSpeakers(speakers.filter(sp => sp.id !== s.id))} className="text-slate-800 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><i className="fa-solid fa-circle-xmark"></i></button>}
                          </div>
                          <select value={s.voice} onChange={e => {const n=[...speakers]; n[idx].voice=e.target.value as VoiceName; setSpeakers(n);}} className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-bold outline-none cursor-pointer uppercase text-slate-500">
                             {Object.values(VoiceName).map(v => <option key={v} value={v} className="bg-slate-900">{v} ({VoiceDescriptions[v].gender === 'male' ? 'M' : 'F'})</option>)}
                          </select>
                       </div>
                     ))
                   )}
                 </div>
              </div>

           </div>
        </aside>

      </main>

      {/* Quick Guide Modal */}
      {showTips && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowTips(false)}></div>
          <div className="w-full max-w-md bg-[#0A0A0B] border border-white/10 rounded-[2rem] p-10 relative z-10 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold font-display text-white mb-6 flex items-center gap-3">
              <i className="fa-solid fa-wand-magic-sparkles text-indigo-500"></i>
              {t.tipsTitle}
            </h3>
            
            <p className="text-sm text-slate-400 mb-8 leading-relaxed">{t.tipsDesc}</p>
            
            <div className="grid grid-cols-2 gap-3 mb-10">
              {VOCAL_FX.map(fx => (
                <div key={fx.tag} className="bg-white/5 p-4 rounded-2xl border border-white/5">
                  <span className="block text-indigo-400 font-mono text-[11px] mb-1 font-bold">{fx.tag}</span>
                  <span className="text-[10px] text-slate-500 uppercase font-bold">{fx.label}</span>
                </div>
              ))}
            </div>

            <div className="space-y-4 mb-10 border-t border-white/5 pt-8">
              <div className="flex items-center gap-4 text-xs">
                <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 font-bold uppercase text-[8px]">AA</div>
                <p className="text-slate-300 font-medium">{t.uppercaseTip}</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 font-bold text-[10px]">...</div>
                <p className="text-slate-300 font-medium">{t.pauseTip}</p>
              </div>
            </div>

            <button 
              onClick={() => setShowTips(false)}
              className="w-full py-4 bg-white text-black font-bold text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-200 transition-all"
            >
              {t.close}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
