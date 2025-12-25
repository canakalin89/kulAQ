
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { VoiceName, SpeakerConfig, DialogueItem, AudioGenerationHistory, SpeechSpeed, AppLang, VoiceDescriptions } from './types';
import { generateSingleSpeakerAudio, generateMultiSpeakerAudio, audioBufferToWavBlob, enrichTextWithAI, EmotionVibe } from './services/geminiService';
import AudioVisualizer from './components/AudioVisualizer';

const EXAM_SPEEDS: { id: SpeechSpeed; label: string; cefr: string }[] = [
  { id: 'v-slow', label: 'V. Slow', cefr: 'A1 Beginner' },
  { id: 'slow', label: 'Slow', cefr: 'A2 Elementary' },
  { id: 'normal', label: 'Normal', cefr: 'B1-B2 Intermediate' },
  { id: 'fast', label: 'Native', cefr: 'C1-C2 Advanced' },
];

const FX_CATALOG = [
  { tag: '[laughs]', icon: 'fa-face-laugh-beam', label: 'Laugh' },
  { tag: '[sighs]', icon: 'fa-wind', label: 'Sigh' },
  { tag: '[clears throat]', icon: 'fa-comment-slash', label: 'Clear' },
  { tag: '[breathes in]', icon: 'fa-lungs', label: 'Inhale' },
  { tag: '[whispers]', icon: 'fa-volume-off', label: 'Whisper' },
  { tag: '[hesitates]', icon: 'fa-pause', label: 'Pause' },
  { tag: '[sniffles]', icon: 'fa-nose-glow', label: 'Sniff' },
];

const EMOTION_CHIPS: { id: EmotionVibe; label: { tr: string, en: string }; icon: string }[] = [
  { id: 'natural', label: { tr: 'Doğal', en: 'Natural' }, icon: 'fa-leaf' },
  { id: 'friendly', label: { tr: 'Sempatik', en: 'Friendly' }, icon: 'fa-face-smile-beam' },
  { id: 'tense', label: { tr: 'Gergin', en: 'Tense' }, icon: 'fa-face-grimace' },
  { id: 'dramatic', label: { tr: 'Dramatik', en: 'Dramatic' }, icon: 'fa-masks-theater' },
];

const translations = {
  tr: {
    studioName: 'Kulaq Studio',
    tagline: 'Eğitim İçin Profesyonel Ses Tasarımı',
    singleMode: 'Tekil Metin',
    multiMode: 'Diyalog Modu',
    generate: 'SESİ OLUŞTUR',
    generating: 'İşleniyor...',
    config: 'Stüdyo Ayarları',
    speed: 'Konuşma Hızı',
    speakers: 'Karakterler',
    addSpeaker: '+ Karakter Ekle',
    savedAssets: 'Kayıt Arşivi',
    noAssets: 'Kayıt bulunamadı',
    replay: 'Oynat',
    autoEnrich: 'Duygu Kat',
    enriching: 'Düzenleniyor',
    downloadWav: 'WAV İndir',
    hqBadge: 'HQ AUDIO',
    fxBar: 'Vokal Efektler',
    activeVoice: 'Ses',
    selectVibe: 'Duygu Modu'
  },
  en: {
    studioName: 'Kulaq Studio',
    tagline: 'Professional Audio for Education',
    singleMode: 'Solo Script',
    multiMode: 'Dialogue Mode',
    generate: 'GENERATE AUDIO',
    generating: 'Processing...',
    config: 'Studio Config',
    speed: 'Speech Speed',
    speakers: 'Voice Talent',
    addSpeaker: '+ Add Talent',
    savedAssets: 'Recent Masterings',
    noAssets: 'Archive empty',
    replay: 'Play',
    autoEnrich: 'Add Emotion',
    enriching: 'Enriching',
    downloadWav: 'Download WAV',
    hqBadge: 'HQ AUDIO',
    fxBar: 'Vocal FX',
    activeVoice: 'Voice',
    selectVibe: 'Select Vibe'
  }
};

const App: React.FC = () => {
  const [lang, setLang] = useState<AppLang>('tr');
  const [mode, setMode] = useState<'single' | 'multi'>('single');
  const [selectedVibe, setSelectedVibe] = useState<EmotionVibe>('natural');
  const t = translations[lang];

  // Audio States
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const seekOffsetRef = useRef<number>(0);

  // Content States
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>(VoiceName.Zephyr);
  const [speed, setSpeed] = useState<SpeechSpeed>('normal');

  const [speakers, setSpeakers] = useState<SpeakerConfig[]>([
    { id: 's1', name: lang === 'tr' ? 'Anlatıcı' : 'Narrator', voice: VoiceName.Zephyr },
    { id: 's2', name: lang === 'tr' ? 'Öğrenci' : 'Student', voice: VoiceName.Puck }
  ]);
  const [dialogue, setDialogue] = useState<DialogueItem[]>([
    { speakerId: 's1', text: "Hello! Welcome to our new English class." },
    { speakerId: 's2', text: "Hi teacher, [breathes in] I am so excited to be here!" }
  ]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [history, setHistory] = useState<AudioGenerationHistory[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [activeBuffer, setActiveBuffer] = useState<AudioBuffer | null>(null);
  const [activeWavUrl, setActiveWavUrl] = useState<string | null>(null);

  const updateProgress = useCallback(() => {
    if (!audioContextRef.current || !isPlaying) return;
    const now = audioContextRef.current.currentTime;
    const elapsed = now - startTimeRef.current + seekOffsetRef.current;
    
    if (elapsed >= duration) {
      setCurrentTime(duration);
      setIsPlaying(false);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    } else {
      setCurrentTime(elapsed);
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    }
  }, [isPlaying, duration]);

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, updateProgress]);

  const handleAutoEnrich = async () => {
    if ((mode === 'single' && !text.trim()) || (mode === 'multi' && dialogue.every(d => !d.text.trim()))) return;
    setIsEnriching(true);
    try {
      if (mode === 'single') {
        const enriched = await enrichTextWithAI(text, selectedVibe);
        setText(enriched);
      } else {
        const enrichedDialogue = await Promise.all(
          dialogue.map(async (item) => ({
            ...item,
            text: item.text.trim() ? await enrichTextWithAI(item.text, selectedVibe) : item.text
          }))
        );
        setDialogue(enrichedDialogue);
      }
    } catch (err) { console.error(err); } 
    finally { setIsEnriching(false); }
  };

  const insertFx = (tag: string) => {
    if (mode === 'single') {
      setText(prev => prev + ' ' + tag + ' ');
    } else {
      const newDialogue = [...dialogue];
      newDialogue[newDialogue.length - 1].text += ' ' + tag + ' ';
      setDialogue(newDialogue);
    }
  };

  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.connect(audioContextRef.current.destination);
    }
  };

  const stopActivePlayback = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch (e) {}
      sourceRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const handlePlay = useCallback((bufferToPlay?: AudioBuffer, offset: number = 0, wavUrl?: string) => {
    const buffer = bufferToPlay || activeBuffer;
    if (!buffer) return;
    initAudio();
    stopActivePlayback();
    
    const source = audioContextRef.current!.createBufferSource();
    source.buffer = buffer;
    source.connect(analyserRef.current!);
    
    source.onended = () => { if (sourceRef.current === source) setIsPlaying(false); };

    startTimeRef.current = audioContextRef.current!.currentTime;
    seekOffsetRef.current = offset;
    
    source.start(0, offset);
    sourceRef.current = source;
    setIsPlaying(true);
    setActiveBuffer(buffer);
    if (wavUrl) setActiveWavUrl(wavUrl);
    setDuration(buffer.duration);
    if (offset === 0) setCurrentTime(0);
  }, [activeBuffer, stopActivePlayback]);

  const handleGenerate = async () => {
    const contentToGen = mode === 'single' ? text : dialogue.map(d => d.text).join(' ');
    if (!contentToGen.trim()) return;
    
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
        text: contentToGen.slice(0, 40) + '...',
        audioUrl: url,
        timestamp: new Date(),
        voice: mode === 'single' ? selectedVoice : 'Multi',
        speed,
        lang
      }, ...prev]);
      handlePlay(buffer, 0, url);
    } catch (err) { console.error(err); } 
    finally { setIsGenerating(false); }
  };

  return (
    <div className="min-h-screen flex flex-col overflow-hidden">
      
      {/* Fixed Navbar */}
      <nav className="h-20 flex items-center justify-between px-10 border-b border-white/5 bg-black/40 backdrop-blur-xl z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <i className="fa-solid fa-microphone-lines text-white"></i>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white font-heading">
              {t.studioName}
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{t.tagline}</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex bg-white/5 rounded-full p-1 border border-white/10">
            <button onClick={() => setLang('tr')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${lang === 'tr' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>TR</button>
            <button onClick={() => setLang('en')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${lang === 'en' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>EN</button>
          </div>
          <a href="https://instagram.com/can_akalin" target="_blank" className="text-xs font-semibold text-slate-500 hover:text-white transition-all">
            @can_akalin
          </a>
        </div>
      </nav>

      {/* Main Grid Onarılmış Layout */}
      <main className="flex-1 p-8 grid grid-cols-12 gap-8 h-[calc(100vh-5rem)] overflow-hidden">
        
        {/* Left Archive */}
        <aside className="col-span-2 flex flex-col h-full overflow-hidden">
          <div className="flex-1 glass-card p-6 flex flex-col overflow-hidden">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center justify-between font-heading">
              {t.savedAssets}
              <span className="font-technical bg-white/5 text-slate-400 px-2 py-0.5 rounded">{history.length}</span>
            </h3>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20 text-center">
                  <i className="fa-solid fa-cloud-moon text-3xl mb-4"></i>
                  <p className="text-[10px] font-bold uppercase tracking-widest">{t.noAssets}</p>
                </div>
              ) : (
                history.map(item => (
                  <div key={item.id} onClick={() => fetch(item.audioUrl).then(r => r.arrayBuffer()).then(ab => audioContextRef.current?.decodeAudioData(ab)).then(b => b && handlePlay(b, 0, item.audioUrl))} className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/[0.05] hover:border-indigo-500/30 transition-all cursor-pointer group">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[9px] font-bold text-indigo-400 uppercase">{item.voice}</span>
                      <span className="text-[8px] text-slate-600 font-technical">{item.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-1 italic mb-3">"{item.text}"</p>
                    <a href={item.audioUrl} download={`kulaq-${item.id}.wav`} className="block text-center py-2 bg-indigo-600/10 text-indigo-400 rounded-lg text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-all" onClick={e => e.stopPropagation()}>
                      <i className="fa-solid fa-download mr-1"></i> {t.downloadWav}
                    </a>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>

        {/* Center Stage */}
        <div className="col-span-7 flex flex-col gap-6 h-full overflow-hidden">
          {/* FX Quick Bar */}
          <div className="glass-card p-3 flex items-center gap-3 overflow-x-auto no-scrollbar shrink-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-r border-white/10 pr-4 ml-2 whitespace-nowrap font-heading">{t.fxBar}</span>
            {FX_CATALOG.map(fx => (
              <button key={fx.tag} onClick={() => insertFx(fx.tag)} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-indigo-600/20 rounded-xl border border-white/5 transition-all whitespace-nowrap group">
                <i className={`fa-solid ${fx.icon} text-indigo-400 group-hover:scale-110 transition-transform`}></i>
                <span className="text-xs font-semibold text-slate-300">{fx.label}</span>
              </button>
            ))}
          </div>

          {/* Master Canvas */}
          <div className="flex-1 glass-card p-10 flex flex-col relative overflow-hidden">
            <div className="absolute top-8 right-8 flex gap-4 z-20">
              <div className="flex bg-black/60 rounded-xl p-1 border border-white/10">
                <button onClick={() => setMode('single')} className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'single' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>{t.singleMode}</button>
                <button onClick={() => setMode('multi')} className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'multi' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>{t.multiMode}</button>
              </div>
              <button onClick={handleAutoEnrich} disabled={isEnriching} className="px-6 py-2 bg-gradient-to-r from-indigo-700 to-indigo-500 hover:from-indigo-600 hover:to-indigo-400 text-white rounded-xl text-xs font-bold shadow-xl transition-all">
                {isEnriching ? <i className="fa-solid fa-spinner fa-spin mr-2"></i> : <i className="fa-solid fa-magic-wand-sparkles mr-2"></i>}
                {isEnriching ? t.enriching : t.autoEnrich}
              </button>
            </div>

            <div className="flex-1 mt-12 overflow-hidden flex flex-col">
              {mode === 'single' ? (
                <textarea 
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Metninizi buraya yazın..."
                  className="w-full h-full bg-transparent border-none focus:ring-0 outline-none text-2xl font-light leading-relaxed text-slate-100 placeholder:text-slate-800 resize-none custom-scrollbar"
                />
              ) : (
                <div className="flex-1 overflow-y-auto space-y-6 pr-4 custom-scrollbar">
                  {dialogue.map((item, idx) => (
                    <div key={idx} className="flex gap-6 p-6 bg-white/[0.02] rounded-3xl border border-white/5 hover:border-indigo-500/20 transition-all group">
                      <div className="flex flex-col gap-3">
                        <select 
                          value={item.speakerId} 
                          onChange={e => { const n = [...dialogue]; n[idx].speakerId = e.target.value; setDialogue(n); }}
                          className="bg-indigo-600/10 border border-indigo-500/20 rounded-xl px-4 py-2 text-[10px] text-indigo-400 font-bold outline-none uppercase"
                        >
                          {speakers.map(s => <option key={s.id} value={s.id} className="bg-slate-900">{s.name}</option>)}
                        </select>
                        <button onClick={() => setDialogue(dialogue.filter((_, i) => i !== idx))} className="opacity-0 group-hover:opacity-100 text-slate-700 hover:text-red-500 transition-all"><i className="fa-solid fa-trash-can"></i></button>
                      </div>
                      <textarea 
                        value={item.text} 
                        onChange={e => { const n = [...dialogue]; n[idx].text = e.target.value; setDialogue(n); }}
                        className="flex-1 bg-transparent text-xl font-light outline-none resize-none pt-1" 
                        rows={1}
                        onInput={(e: any) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                      />
                    </div>
                  ))}
                  <button onClick={() => setDialogue([...dialogue, { speakerId: speakers[0].id, text: '' }])} className="w-full py-6 border-2 border-dashed border-white/10 rounded-3xl text-slate-600 hover:text-indigo-400 hover:border-indigo-500/30 transition-all text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-3">
                    <i className="fa-solid fa-circle-plus"></i> Diyalog Ekle
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Console */}
            <div className="mt-8 pt-8 border-t border-white/5 shrink-0">
              <AudioVisualizer analyser={analyserRef.current} isPlaying={isPlaying} />
              
              <div className="mt-8 flex items-center gap-8">
                <div className="flex items-center gap-4">
                  <button onClick={isPlaying ? stopActivePlayback : () => handlePlay()} className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${!activeBuffer ? 'bg-white/5 text-slate-800' : 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 active:scale-95'}`}>
                    <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} text-xl`}></i>
                  </button>
                  <div className="text-[10px] font-technical text-slate-500 uppercase">
                    <span className="text-white font-bold">{currentTime.toFixed(1)}s</span> / {duration.toFixed(1)}s
                  </div>
                </div>

                <button onClick={handleGenerate} disabled={isGenerating} className={`flex-1 h-16 rounded-2xl font-bold text-sm tracking-widest uppercase text-white transition-all shadow-xl ${isGenerating ? 'bg-slate-800' : 'bg-gradient-to-r from-indigo-700 to-indigo-500 hover:shadow-indigo-600/40 active:translate-y-0.5'}`}>
                  {isGenerating ? <><i className="fa-solid fa-circle-notch fa-spin mr-3"></i> {t.generating}</> : <><i className="fa-solid fa-bolt-lightning mr-3"></i> {t.generate}</>}
                </button>

                {activeWavUrl && (
                  <a href={activeWavUrl} download="kulaq-export.wav" className="h-16 px-8 bg-emerald-600 hover:bg-emerald-500 rounded-2xl flex items-center gap-3 text-white transition-all shadow-xl shadow-emerald-600/10">
                    <i className="fa-solid fa-download"></i>
                    <span className="text-[10px] font-bold uppercase tracking-widest">Mastering</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Controls */}
        <aside className="col-span-3 flex flex-col h-full overflow-hidden">
          <div className="flex-1 glass-card p-8 flex flex-col overflow-hidden">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-10 flex items-center gap-3 font-heading">
              <i className="fa-solid fa-sliders text-indigo-500"></i> {t.config}
            </h3>

            <div className="space-y-10 flex-1 overflow-y-auto pr-2 custom-scrollbar no-scrollbar">
              <div className="space-y-4">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-60 ml-1">{t.selectVibe}</label>
                <div className="grid grid-cols-2 gap-3">
                  {EMOTION_CHIPS.map(v => (
                    <button key={v.id} onClick={() => setSelectedVibe(v.id)} className={`p-4 rounded-2xl border transition-all text-left ${selectedVibe === v.id ? 'bg-indigo-600 border-indigo-500 shadow-xl' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                      <i className={`fa-solid ${v.icon} mb-3 text-sm ${selectedVibe === v.id ? 'text-white' : 'text-indigo-400'}`}></i>
                      <span className={`block text-[10px] font-bold uppercase ${selectedVibe === v.id ? 'text-white' : 'text-slate-400'}`}>{v.label[lang]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-60 ml-1">{t.speed}</label>
                <div className="grid grid-cols-2 gap-3">
                  {EXAM_SPEEDS.map(s => (
                    <button key={s.id} onClick={() => setSpeed(s.id)} className={`p-4 rounded-2xl border transition-all text-left ${speed === s.id ? 'bg-indigo-600 border-indigo-500 shadow-xl' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                      <span className={`block text-xs font-bold ${speed === s.id ? 'text-white' : 'text-slate-200'}`}>{s.label}</span>
                      <span className={`text-[8px] font-technical uppercase block mt-1 ${speed === s.id ? 'text-indigo-200' : 'text-slate-500'}`}>{s.cefr}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center mb-1">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-60 ml-1">{t.speakers}</label>
                   {mode === 'multi' && <button onClick={() => setSpeakers([...speakers, {id: Date.now().toString(), name: 'Yeni Ses', voice: VoiceName.Puck}])} className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{t.addSpeaker}</button>}
                </div>
                <div className="space-y-3 pb-12">
                  {mode === 'single' ? (
                    Object.values(VoiceName).map(v => (
                      <button key={v} onClick={() => setSelectedVoice(v)} className={`w-full p-4 rounded-2xl border flex items-center justify-between transition-all ${selectedVoice === v ? 'bg-indigo-600/20 border-indigo-500 shadow-lg' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                        <div className="flex items-center gap-4 text-left">
                           <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${VoiceDescriptions[v].gender === 'male' ? 'bg-blue-600/10 text-blue-400' : 'bg-pink-600/10 text-pink-400'}`}>
                              <i className={`fa-solid ${VoiceDescriptions[v].gender === 'male' ? 'fa-mars' : 'fa-venus'} text-xs`}></i>
                           </div>
                           <div>
                              <span className="block text-xs font-bold tracking-tight">{v}</span>
                              <span className="text-[9px] text-slate-500 uppercase font-semibold">{VoiceDescriptions[v][lang]}</span>
                           </div>
                        </div>
                        {selectedVoice === v && <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></div>}
                      </button>
                    ))
                  ) : (
                    speakers.map((s, idx) => (
                      <div key={s.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-4 group/speaker transition-all hover:bg-white/[0.08]">
                        <div className="flex items-center gap-4">
                           <input value={s.name} onChange={e => {const n=[...speakers]; n[idx].name=e.target.value; setSpeakers(n);}} className="bg-transparent border-none p-0 text-xs font-bold focus:ring-0 w-full uppercase text-white" />
                           <button onClick={() => setSpeakers(speakers.filter(sp => sp.id !== s.id))} className="text-slate-800 hover:text-red-500 transition-all opacity-0 group-hover/speaker:opacity-100"><i className="fa-solid fa-circle-xmark"></i></button>
                        </div>
                        <select value={s.voice} onChange={e => {const n=[...speakers]; n[idx].voice=e.target.value as VoiceName; setSpeakers(n);}} className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-bold outline-none cursor-pointer uppercase text-slate-400">
                           {Object.values(VoiceName).map(v => <option key={v} value={v} className="bg-slate-900">{v} ({VoiceDescriptions[v].gender === 'male' ? 'M' : 'F'})</option>)}
                        </select>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        textarea, input, select { font-smoothing: antialiased; }
        ::placeholder { opacity: 0.2 !important; }
      `}} />
    </div>
  );
};

export default App;
