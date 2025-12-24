
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { VoiceName, SpeakerConfig, DialogueItem, AudioGenerationHistory, SpeechSpeed, AppLang, VoiceDescriptions } from './types';
import { generateSingleSpeakerAudio, generateMultiSpeakerAudio, audioBufferToWavBlob, enrichTextWithAI } from './services/geminiService';
import AudioVisualizer from './components/AudioVisualizer';

const TONE_PRESETS = [
  { id: 'exam-formal', tr: 'Sınav (Resmi)', en: 'Exam (Formal)', tone: 'clear, formal, exam-style delivery' },
  { id: 'storytelling', tr: 'Hikaye Anlatımı', en: 'Storytelling', tone: 'expressive, engaging for narrations' },
  { id: 'casual', tr: 'Günlük Konuşma', en: 'Casual', tone: 'natural, relaxed for dialogues' },
];

const EXAM_SPEEDS: { id: SpeechSpeed; label: string; cefr: string }[] = [
  { id: 'v-slow', label: 'V. Slow', cefr: 'A1 Beginner' },
  { id: 'slow', label: 'Slow', cefr: 'A2 Elementary' },
  { id: 'normal', label: 'Normal', cefr: 'B1-B2 Intermediate' },
  { id: 'fast', label: 'Native', cefr: 'C1-C2 Advanced' },
];

const EXAM_TEMPLATES = {
  tr: [
    { label: 'Sınav Başlangıcı', text: 'Welcome to the English Listening Examination. Please listen carefully to the instructions.' },
    { label: 'Yönerge (Part 1)', text: 'Part One. You will hear some short conversations. You will hear each conversation twice.' },
    { label: 'Soru Arası Boşluk', text: '... Now you have thirty seconds to look at the questions for Part Two.' },
  ],
  en: [
    { label: 'Exam Intro', text: 'Welcome to the English Listening Examination. Please listen carefully to the instructions.' },
    { label: 'Part 1 Instructions', text: 'Part One. You will hear some short conversations. You will hear each conversation twice.' },
    { label: 'Question Gap', text: '... Now you have thirty seconds to look at the questions for Part Two.' },
  ]
};

const translations = {
  tr: {
    studioName: 'Kulaq',
    tagline: 'İngilizce Dinleme Sınavı Hazırlama Platformu',
    singleMode: 'Tekil Metin (Monolog)',
    multiMode: 'Diyalog Stüdyosu',
    lessonContent: 'Sınav Metni / Senaryo',
    passagePlaceholder: 'Sınavda okunacak İngilizce metni buraya yazın veya yapıştırın...',
    smartSets: 'Hızlı Şablonlar',
    addEntry: 'Yeni Konuşma Satırı Ekle',
    generate: 'SINAV SESİNİ OLUŞTUR',
    generating: 'Yapay Zeka Seslendiriyor...',
    config: 'Sınav Ayarları',
    speed: 'Zorluk Seviyesi (CEFR)',
    speakers: 'Sınav Karakterleri',
    addSpeaker: '+ Karakter Ekle',
    savedAssets: 'Arşivim',
    noAssets: 'Henüz bir sınav kaydı oluşturmadınız',
    replay: 'TEKRAR OYNAT',
    tipsTitle: 'Kusursuz Seslendirme İçin İpuçları',
    tip1: 'Duraklamalar: Virgül kısa, nokta orta, üç nokta (...) ise uzun es verir. Cümle aralarına koymayı unutmayın.',
    tip2: 'Duygular: Metin içine [laughs], [sighs], [coughs] gibi ifadeler ekleyerek karakteri canlandırabilirsiniz.',
    tip3: 'Vurgular: Önemli kelimeleri BÜYÜK HARFLE yazmak, AI\'nın o kelimeye baskı yapmasını sağlar.',
    tip4: 'Dudak Payı: Cümlenin en sonuna "..." eklemek, sesin aniden kesilmesini önler ve doğal bir bitiş sağlar.',
    tip5: 'Soru Tonu: Soru işaretlerini (?) cümlenin sonuna mutlaka ekleyin; intonasyon otomatik olarak yükselir.',
    tip6: 'Doğal Dolgu: "Um...", "Uh...", "Well," gibi ifadeler diyaloğun daha insansı duyulmasını sağlar.',
    tip7: 'Karakter Farkı: Diyaloglarda bir sesi "Fast", diğerini "Slow" yaparak hiyerarşi oluşturabilirsiniz.',
    tip8: 'Tereddüt: Kelime aralarına tire (-) koyarak (Örn: I- I don\'t know) kekeleme efekti verebilirsiniz.',
    footerNote: 'ELT Materyal Geliştirme Aracı',
    male: 'Erkek',
    female: 'Kadın',
    developedBy: 'Tarafından Geliştirildi',
    clearAll: 'Tümünü Sil',
    autoEnrich: 'AI Duygu Ekle',
    enriching: 'Analiz Ediliyor...',
    proTips: 'Öğretmen İpuçları',
    techNote: 'Nasıl Yapıldı: Kulaq, Google Gemini 2.5 Flash TTS API ve React kullanılarak Can AKALIN tarafından geliştirilmiştir. Sesler gerçek zamanlı olarak yapay zeka tarafından sentezlenir.'
  },
  en: {
    studioName: 'Kulaq',
    tagline: 'English Listening Exam Preparation Platform',
    singleMode: 'Solo Passage (Monologue)',
    multiMode: 'Dialogue Studio',
    lessonContent: 'Exam Script / Scenario',
    passagePlaceholder: 'Paste or type the English exam script here...',
    smartSets: 'Quick Templates',
    addEntry: 'Add Dialogue Line',
    generate: 'GENERATE EXAM AUDIO',
    generating: 'AI is Synchronizing...',
    config: 'Exam Configuration',
    speed: 'Difficulty Level (CEFR)',
    speakers: 'Exam Characters',
    addSpeaker: '+ Add Speaker',
    savedAssets: 'Asset Library',
    noAssets: 'No exam assets generated yet',
    replay: 'RE-PLAY',
    tipsTitle: 'Pro Tips for Perfect Audio',
    tip1: 'Pauses: Commas are short, periods medium, and ellipses (...) give long pauses. Vital for clarity.',
    tip2: 'Emotions: Insert [laughs], [sighs], or [coughs] in square brackets to make characters feel alive.',
    tip3: 'Emphasis: Write critical words in UPPERCASE to make the AI stress those specific terms.',
    tip4: 'Tail: Adding "..." at the very end prevents abrupt audio cuts and creates a natural fade-out.',
    tip5: 'Intonation: Always use question marks (?) to ensure the voice rises naturally at the end of queries.',
    tip6: 'Fillers: Use "Um...", "Uh...", or "Well," to create a more realistic, human-like conversation flow.',
    tip7: 'Dynamics: In dialogues, try setting one voice to "Fast" and another to "Slow" for social contrast.',
    tip8: 'Hesitation: Use hyphens (e.g., I- I don\'t know) between repeated words to simulate a stutter.',
    footerNote: 'ELT Material Design Tool',
    male: 'Male',
    female: 'Female',
    developedBy: 'Developed by',
    clearAll: 'Clear All',
    autoEnrich: 'AI Auto-Enrich',
    enriching: 'Analyzing Context...',
    proTips: 'Pro Teacher Tips',
    techNote: 'How it works: Kulaq is built using Google Gemini 2.5 Flash TTS API and React. Audio is synthesized in real-time using advanced neural models.'
  }
};

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const App: React.FC = () => {
  const [lang, setLang] = useState<AppLang>('tr');
  const [mode, setMode] = useState<'single' | 'multi'>('single');
  const t = translations[lang];

  // Audio Playback State
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const seekOffsetRef = useRef<number>(0);

  // Single Speaker State
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>(VoiceName.Zephyr);
  const [selectedTone, setSelectedTone] = useState(TONE_PRESETS[0].tone);
  const [speed, setSpeed] = useState<SpeechSpeed>('normal');

  // Multi Speaker State
  const [speakers, setSpeakers] = useState<SpeakerConfig[]>([
    { id: 's1', name: lang === 'tr' ? 'Öğretmen' : 'Teacher', voice: VoiceName.Zephyr },
    { id: 's2', name: lang === 'tr' ? 'Öğrenci' : 'Student', voice: VoiceName.Puck }
  ]);
  const [dialogue, setDialogue] = useState<DialogueItem[]>([
    { speakerId: 's1', text: "Hello! Can you tell me your name?" },
    { speakerId: 's2', text: "My name is John. I am a student at the University." }
  ]);

  // UI State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [history, setHistory] = useState<AudioGenerationHistory[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTips, setShowTips] = useState(true);

  // Audio Context and Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [activeBuffer, setActiveBuffer] = useState<AudioBuffer | null>(null);

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

  // AI Enrichment Logic
  const handleAutoEnrich = async () => {
    setIsEnriching(true);
    try {
      if (mode === 'single') {
        const enriched = await enrichTextWithAI(text);
        setText(enriched);
      } else {
        const enrichedDialogue = await Promise.all(
          dialogue.map(async (item) => ({
            ...item,
            text: await enrichTextWithAI(item.text)
          }))
        );
        setDialogue(enrichedDialogue);
      }
    } catch (err) {
      console.error("Enrichment failed:", err);
    } finally {
      setIsEnriching(false);
    }
  };

  // Archive Management Logic
  const deleteHistoryItem = useCallback((id: string) => {
    setHistory(prev => {
      const item = prev.find(h => h.id === id);
      if (item?.audioUrl) {
        URL.revokeObjectURL(item.audioUrl);
      }
      return prev.filter(h => h.id !== id);
    });
  }, []);

  const clearAllHistory = useCallback(() => {
    history.forEach(item => {
      if (item.audioUrl) URL.revokeObjectURL(item.audioUrl);
    });
    setHistory([]);
  }, [history]);

  // Speaker Management Logic
  const addSpeaker = useCallback(() => {
    if (speakers.length >= 6) return;
    const nextId = `s${Date.now()}`;
    setSpeakers(prev => [...prev, { 
      id: nextId, 
      name: lang === 'tr' ? `Karakter ${prev.length + 1}` : `Character ${prev.length + 1}`, 
      voice: VoiceName.Kore 
    }]);
  }, [speakers.length, lang]);

  const removeSpeaker = useCallback((id: string) => {
    if (speakers.length <= 1) return;
    setSpeakers(prev => prev.filter(s => s.id !== id));
    setDialogue(prev => prev.filter(d => d.speakerId !== id));
  }, [speakers.length]);

  const updateSpeaker = useCallback((id: string, updates: Partial<SpeakerConfig>) => {
    setSpeakers(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.connect(audioContextRef.current.destination);
    }
  };

  const stopActivePlayback = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current = null;
    }
    setIsPlaying(false);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  }, []);

  const handlePlay = useCallback((bufferToPlay?: AudioBuffer, offset: number = 0) => {
    const buffer = bufferToPlay || activeBuffer;
    if (!buffer) return;
    initAudio();
    stopActivePlayback();
    
    const source = audioContextRef.current!.createBufferSource();
    source.buffer = buffer;
    source.connect(analyserRef.current!);
    
    source.onended = () => { 
      if (sourceRef.current === source) {
        setIsPlaying(false);
      }
    };

    const playStartTime = audioContextRef.current!.currentTime;
    startTimeRef.current = playStartTime;
    seekOffsetRef.current = offset;
    
    source.start(0, offset);
    sourceRef.current = source;
    setIsPlaying(true);
    setActiveBuffer(buffer);
    setDuration(buffer.duration);
    if (offset === 0) setCurrentTime(0);
  }, [activeBuffer, stopActivePlayback]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeBuffer) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    handlePlay(activeBuffer, newTime);
    setCurrentTime(newTime);
  };

  const handleGenerate = async () => {
    const contentToGen = mode === 'single' ? text : dialogue.map(d => d.text).join(' ');
    if (!contentToGen.trim()) return;
    
    setIsGenerating(true);
    try {
      let buffer: AudioBuffer;
      if (mode === 'single') {
        buffer = await generateSingleSpeakerAudio(text, selectedVoice, selectedTone, speed);
      } else {
        buffer = await generateMultiSpeakerAudio(dialogue, speakers, speed);
      }
      const blob = audioBufferToWavBlob(buffer);
      const url = URL.createObjectURL(blob);
      setHistory(prev => [{
        id: Math.random().toString(36).substr(2, 9),
        text: contentToGen.slice(0, 50) + '...',
        audioUrl: url,
        timestamp: new Date(),
        voice: mode === 'single' ? selectedVoice : 'Dialogue',
        speed,
        lang
      }, ...prev]);
      handlePlay(buffer);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8 bg-[#050810] text-slate-200">
      {/* Header */}
      <header className="w-full max-w-6xl flex flex-col md:flex-row justify-between items-center mb-8 gap-6 border-b border-slate-800/40 pb-6">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-gradient-to-tr from-indigo-600 to-blue-500 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/20">
            <i className="fa-solid fa-ear-listen text-white text-2xl"></i>
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-2">
              {t.studioName} <span className="text-indigo-400 font-bold text-xs bg-indigo-500/10 px-2 py-1 rounded-md">ELT EDITION</span>
            </h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">{t.tagline}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800 shadow-inner">
            <button onClick={() => setLang('tr')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${lang === 'tr' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>TR 🇹🇷</button>
            <button onClick={() => setLang('en')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${lang === 'en' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>EN 🇬🇧</button>
          </div>
          
          {/* Prominent Pro Tips Button */}
          <button 
            onClick={() => setShowTips(!showTips)} 
            className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-black text-xs tracking-widest transition-all border shadow-lg ${showTips ? 'bg-indigo-600 border-indigo-400 text-white shadow-indigo-600/20' : 'bg-slate-900 border-slate-800 text-indigo-400 hover:border-indigo-500/40 hover:bg-slate-800'}`}
          >
            <i className={`fa-solid ${showTips ? 'fa-circle-xmark' : 'fa-lightbulb-on'} text-sm`}></i>
            {t.proTips}
          </button>
        </div>
      </header>

      {/* Quick Guide */}
      {showTips && (
        <div className="w-full max-w-6xl mb-8 bg-indigo-600/5 border border-indigo-500/20 rounded-3xl p-6 relative overflow-hidden group">
          <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-all"></div>
          <h3 className="text-sm font-black text-indigo-400 uppercase tracking-widest mb-6 flex items-center gap-3">
             <i className="fa-solid fa-wand-magic-sparkles text-indigo-400 animate-pulse"></i> {t.tipsTitle}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[t.tip1, t.tip2, t.tip3, t.tip4, t.tip5, t.tip6, t.tip7, t.tip8].map((tip, idx) => (
              <div key={idx} className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/40 hover:border-indigo-500/30 transition-all relative z-10 group/tip">
                <span className="text-[9px] font-black text-indigo-500 mb-1.5 block opacity-50 group-hover/tip:opacity-100">PRO TIP #{idx+1}</span>
                <p className="text-[10px] leading-relaxed text-slate-400 font-medium">{tip}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Workspace */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Editor Area */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-slate-900/40 border border-slate-800 rounded-[2.5rem] p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
            <div className="flex justify-between items-center mb-8">
              <div className="flex bg-slate-950/50 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
                 <button onClick={() => setMode('single')} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${mode === 'single' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>{t.singleMode}</button>
                 <button onClick={() => setMode('multi')} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${mode === 'multi' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>{t.multiMode}</button>
              </div>
              
              <button 
                onClick={handleAutoEnrich} 
                disabled={isEnriching || (mode === 'single' && !text.trim())}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-black text-[10px] tracking-widest transition-all shadow-md group ${isEnriching ? 'bg-slate-800 border-slate-700 text-slate-500' : 'bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border-indigo-500/30 text-indigo-400 hover:border-indigo-500/60 hover:from-purple-600/30 hover:to-indigo-600/30'}`}
              >
                <i className={`fa-solid ${isEnriching ? 'fa-spinner fa-spin' : 'fa-sparkles group-hover:rotate-12'} transition-transform`}></i>
                {isEnriching ? t.enriching : t.autoEnrich}
              </button>
            </div>

            {mode === 'single' ? (
              <div className="space-y-8">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={t.passagePlaceholder}
                  className="w-full h-72 bg-slate-950/40 border border-slate-800/50 rounded-3xl p-8 text-slate-100 placeholder-slate-700 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none text-xl leading-relaxed"
                />
                <div className="space-y-4">
                   <label className="text-[11px] text-slate-500 font-black uppercase tracking-widest ml-1">{t.smartSets}</label>
                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {EXAM_TEMPLATES[lang].map((tpl, i) => (
                        <button key={i} onClick={() => setText(tpl.text)} className="group bg-slate-950/50 hover:bg-indigo-600/10 border border-slate-800 hover:border-indigo-500/30 p-4 rounded-2xl text-left transition-all">
                           <span className="text-[9px] font-black text-indigo-400 block mb-1 uppercase tracking-tighter">{tpl.label}</span>
                           <p className="text-[10px] text-slate-500 line-clamp-1 italic">"{tpl.text}"</p>
                        </button>
                      ))}
                   </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-h-[550px] overflow-y-auto pr-3 custom-scrollbar">
                 {dialogue.map((item, idx) => (
                   <div key={idx} className="flex gap-5 p-5 bg-slate-950/40 rounded-[2rem] border border-slate-800/50 group transition-all hover:bg-slate-900/40">
                      <div className="flex flex-col gap-3 min-w-[120px]">
                        <select
                          value={item.speakerId}
                          onChange={(e) => { const n = [...dialogue]; n[idx].speakerId = e.target.value; setDialogue(n); }}
                          className="bg-indigo-600/10 border border-indigo-500/20 rounded-xl px-3 py-2 text-[10px] text-indigo-400 font-black focus:outline-none cursor-pointer"
                        >
                          {speakers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <button onClick={() => setDialogue(dialogue.filter((_, i) => i !== idx))} className="text-slate-700 hover:text-red-500 transition-all text-[10px] font-bold opacity-0 group-hover:opacity-100 flex items-center gap-2 justify-center">
                          <i className="fa-solid fa-trash-can"></i> REMOVE
                        </button>
                      </div>
                      <textarea
                        value={item.text}
                        onChange={(e) => { const n = [...dialogue]; n[idx].text = e.target.value; setDialogue(n); }}
                        className="flex-1 bg-transparent text-slate-200 focus:outline-none resize-none text-base pt-1.5 font-medium"
                        rows={1}
                        onInput={(e: any) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                      />
                   </div>
                 ))}
                 <button onClick={() => setDialogue([...dialogue, { speakerId: speakers[0].id, text: '' }])} className="w-full py-6 border-2 border-dashed border-slate-800 rounded-[2rem] text-slate-500 hover:text-indigo-400 hover:border-indigo-500/30 transition-all text-sm font-black bg-slate-950/20 flex items-center justify-center gap-3 group">
                   <i className="fa-solid fa-circle-plus group-hover:rotate-90 transition-transform"></i> {t.addEntry}
                 </button>
              </div>
            )}
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-[2.5rem] p-8 backdrop-blur-xl shadow-2xl">
             <AudioVisualizer analyser={analyserRef.current} isPlaying={isPlaying} />
             
             {/* Player Timeline */}
             <div className="mt-8 space-y-3">
               <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 tracking-widest px-1">
                 <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-indigo-400">{formatTime(currentTime)}</span>
                 <span className="opacity-40">{formatTime(duration)}</span>
               </div>
               <div 
                 className="relative h-2.5 w-full bg-slate-950 rounded-full border border-slate-800/50 cursor-pointer group/timeline overflow-hidden"
                 onClick={handleSeek}
               >
                 <div 
                   className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-100 relative shadow-[0_0_15px_rgba(79,70,229,0.3)]"
                   style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                 >
                   <div className="absolute right-0 top-0 h-full w-1 bg-white/40 blur-[2px]"></div>
                 </div>
                 <div className="absolute top-0 left-0 w-full h-full opacity-0 group-hover/timeline:opacity-100 bg-white/5 transition-opacity pointer-events-none"></div>
               </div>
             </div>

             <div className="flex flex-col md:flex-row items-center gap-8 mt-6">
                <div className="flex items-center gap-4">
                   <button 
                    onClick={isPlaying ? stopActivePlayback : () => handlePlay()} 
                    disabled={!activeBuffer || isGenerating} 
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${!activeBuffer ? 'bg-slate-800 text-slate-700' : 'bg-indigo-600 text-white hover:scale-105 shadow-xl shadow-indigo-600/20 active:scale-95'}`}
                   >
                      <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} text-2xl`}></i>
                   </button>
                </div>
                <button
                  disabled={isGenerating || (mode === 'single' && !text.trim())}
                  onClick={handleGenerate}
                  className={`flex-1 h-16 rounded-2xl font-black text-sm tracking-widest text-white transition-all relative overflow-hidden active:scale-[0.98] group ${isGenerating ? 'bg-slate-800 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:shadow-indigo-500/30 shadow-lg'}`}
                >
                  {isGenerating ? (
                    <span className="flex items-center justify-center gap-3"><i className="fa-solid fa-circle-notch fa-spin"></i> {t.generating}</span>
                  ) : (
                    <span className="flex items-center justify-center gap-3"><i className="fa-solid fa-wand-magic-sparkles"></i> {t.generate}</span>
                  )}
                </button>
             </div>
          </div>
        </div>

        {/* Sidebar Controls */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-7 backdrop-blur-xl shadow-2xl">
            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-8 flex items-center gap-3">
              <i className="fa-solid fa-sliders text-indigo-400"></i> {t.config}
            </h3>
            
            <div className="space-y-10">
              {/* Exam Level Selector */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.speed}</label>
                <div className="grid grid-cols-2 gap-3">
                  {EXAM_SPEEDS.map(s => (
                    <button 
                      key={s.id} 
                      onClick={() => setSpeed(s.id)} 
                      className={`p-4 rounded-2xl border text-center transition-all ${speed === s.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-600 hover:border-slate-700'}`}
                    >
                      <span className="text-xs font-black block">{s.label}</span>
                      <span className="text-[9px] opacity-60 font-bold uppercase tracking-tighter">{s.cefr}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Characters */}
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.speakers}</label>
                  {mode === 'multi' && speakers.length < 6 && (
                    <button onClick={addSpeaker} className="text-[9px] font-black text-indigo-400 hover:text-indigo-300 transition-colors">{t.addSpeaker}</button>
                  )}
                </div>

                <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                   {mode === 'single' ? (
                     <div className="grid grid-cols-1 gap-3">
                       {Object.values(VoiceName).map(v => (
                         <button
                           key={v}
                           onClick={() => setSelectedVoice(v)}
                           className={`flex items-center justify-between px-5 py-4 rounded-2xl border transition-all ${selectedVoice === v ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400 shadow-[0_0_20px_rgba(79,70,229,0.1)]' : 'bg-slate-950 border-slate-800 text-slate-600 hover:bg-slate-900'}`}
                         >
                           <div className="flex flex-col items-start">
                             <div className="flex items-center gap-2">
                               <span className="text-sm font-black tracking-tight">{v}</span>
                               <i className={`fa-solid ${VoiceDescriptions[v].gender === 'male' ? 'fa-mars text-blue-400' : 'fa-venus text-pink-400'} text-[10px]`}></i>
                             </div>
                             <span className="text-[9px] font-bold opacity-40 uppercase tracking-tighter">{VoiceDescriptions[v][lang]}</span>
                           </div>
                           <i className={`fa-solid ${selectedVoice === v ? 'fa-circle-check' : 'fa-circle-play opacity-20'}`}></i>
                         </button>
                       ))}
                     </div>
                   ) : (
                     speakers.map((s, idx) => (
                       <div key={s.id} className="p-5 bg-slate-950/60 border border-slate-800 rounded-3xl space-y-4 relative group/speaker">
                         {speakers.length > 1 && (
                           <button onClick={() => removeSpeaker(s.id)} className="absolute top-4 right-4 text-slate-800 hover:text-red-500 opacity-0 group-hover/speaker:opacity-100 transition-opacity"><i className="fa-solid fa-circle-xmark"></i></button>
                         )}
                         <div className="flex flex-col gap-2">
                            <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">Role #{idx+1} (Click to Name)</span>
                            <div className="flex items-center gap-2">
                              <i className={`fa-solid ${VoiceDescriptions[s.voice].gender === 'male' ? 'fa-mars text-blue-400' : 'fa-venus text-pink-400'} text-[12px]`}></i>
                              <input 
                                className="bg-transparent text-white text-xs font-black w-full outline-none focus:text-indigo-400 transition-colors border-b border-indigo-500/10 focus:border-indigo-500/40 pb-1" 
                                value={s.name} 
                                onChange={(e) => updateSpeaker(s.id, { name: e.target.value })} 
                                placeholder="Speaker Name"
                              />
                            </div>
                         </div>
                         <select
                           value={s.voice}
                           onChange={(e) => updateSpeaker(s.id, { voice: e.target.value as VoiceName })}
                           className="w-full bg-slate-900/50 border border-slate-800 rounded-xl p-2.5 text-[10px] text-slate-400 font-black outline-none cursor-pointer"
                         >
                           {Object.values(VoiceName).map(v => (
                             <option key={v} value={v}>
                               {v} ({VoiceDescriptions[v].gender === 'male' ? t.male : t.female}) - {VoiceDescriptions[v][lang]}
                             </option>
                           ))}
                         </select>
                       </div>
                     ))
                   )}
                </div>
              </div>
            </div>
          </div>

          {/* History / Archive */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-7 backdrop-blur-xl shadow-2xl h-[380px] flex flex-col">
            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center justify-between">
              <span>{t.savedAssets}</span>
              <div className="flex items-center gap-3">
                {history.length > 0 && (
                  <button 
                    onClick={clearAllHistory}
                    className="text-[9px] text-red-500 hover:text-red-400 transition-colors uppercase font-black"
                  >
                    {t.clearAll}
                  </button>
                )}
                <span className="bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full text-[9px]">{history.length} FILES</span>
              </div>
            </h3>
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
              {history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-800 opacity-30 text-center px-4">
                   <i className="fa-solid fa-box-archive text-4xl mb-4"></i>
                   <p className="text-[10px] font-black uppercase tracking-widest leading-loose">{t.noAssets}</p>
                </div>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="p-5 bg-slate-950/40 border border-slate-800/60 rounded-3xl hover:border-indigo-500/40 transition-all group relative overflow-hidden">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex flex-col">
                         <span className="text-[9px] text-indigo-400 font-black uppercase tracking-tighter">{item.voice} • {item.speed.toUpperCase()}</span>
                         <span className="text-[8px] text-slate-700 font-mono mt-1">{item.timestamp.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <a href={item.audioUrl} download={`kulaq-exam-${item.id}.wav`} className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 hover:text-indigo-400 transition-all">
                          <i className="fa-solid fa-cloud-arrow-down text-xs"></i>
                        </a>
                        <button 
                          onClick={() => deleteHistoryItem(item.id)}
                          className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 hover:text-red-500 transition-all"
                        >
                          <i className="fa-solid fa-trash-can text-xs"></i>
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 italic font-medium mb-4">"{item.text}"</p>
                    <button 
                      onClick={() => { setActiveBuffer(null); fetch(item.audioUrl).then(r => r.arrayBuffer()).then(ab => audioContextRef.current?.decodeAudioData(ab)).then(b => b && handlePlay(b))}}
                      className="w-full py-2.5 bg-slate-900 hover:bg-indigo-600/10 rounded-xl text-[9px] font-black text-slate-500 hover:text-indigo-400 transition-all uppercase tracking-widest"
                    >
                      {t.replay}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-20 w-full max-w-6xl border-t border-slate-800/40 py-12 px-6">
        <div className="flex flex-col items-center text-center gap-8">
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-12 text-[10px] font-black uppercase tracking-[0.5em] text-slate-600">
            <span className="flex items-center gap-3"><i className="fa-solid fa-bolt-lightning text-indigo-500"></i> KULAQ STUDIO</span>
            <span className="hidden md:block w-2 h-2 bg-slate-800 rounded-full"></span>
            <span className="flex items-center gap-3">{t.footerNote}</span>
            <span className="hidden md:block w-2 h-2 bg-slate-800 rounded-full"></span>
            <span className="flex items-center gap-3 whitespace-nowrap">
              {t.developedBy}{' '}
              <a 
                href="https://instagram.com/can_akalin" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-white transition-all underline underline-offset-8 decoration-indigo-500/30 hover:decoration-indigo-400"
              >
                Can AKALIN
              </a>
            </span>
          </div>

          <div className="max-w-2xl bg-slate-900/20 p-6 rounded-3xl border border-slate-800/30">
            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
              <i className="fa-solid fa-circle-info text-indigo-500/60 mr-2"></i>
              {t.techNote}
            </p>
          </div>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #334155; }
      `}} />
    </div>
  );
};

export default App;
