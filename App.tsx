
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect } from 'react';
import { 
    Camera, Sparkles, Loader2, Play, Film, ArrowRight, Upload, Globe, 
    CheckCircle2, AlertCircle, Map as MapIcon, Trash2, Sliders, Layers, 
    Zap, Target, Flag, RefreshCw, Star, Mic, Cloud, Wand2, Image as ImageIcon, Video as VideoIcon, X
} from 'lucide-react';
import { 
    AppState, RecallStory, MediaItem, LocationPoint, CutPack, StoryArc, 
    PaceLevel, FocusTarget, EndingStyle, CutPackCategory, ImageAspectRatio, ImageSize, VideoAspectRatio 
} from './types';
import { analyzeTripAndGenerateStory, generateBeatAudio, extractItinerary, transcribeAudio, generateImage, generateVideo } from './services/geminiService';
import ScrollyStory from './components/ScrollyStory';

// --- Constants ---
const CUT_PACKS: CutPack[] = [
    { id: 'neon-noir', category: 'Moody', name: 'Neon Noir', promise: 'Gritty & Cynical', description: 'Rain-slicked streets, high contrast, and whispered secrets.' },
    { id: 'postcard-pop', category: 'Bright', name: 'Postcard Pop', promise: 'Vibrant Optimism', description: 'Saturated colors and deadpan joy, inspired by the 1960s.' },
    { id: 'a24-drift', category: 'Artsy', name: 'A24 Drift', promise: 'Subversive & Detail-rich', description: 'Slow pans on strange details. Atmospheric and unconventional.' },
    { id: 'mythic-odyssey', category: 'Epic', name: 'Mythic Odyssey', promise: 'Heroic & Grand', description: 'A legendary trial of spirit against vast horizons.' },
];

const STORY_ARCS: StoryArc[] = [
    { id: 'journey', name: 'The Journey', structure: 'Linear Chronological', bestFor: 'Road trips and long cruises' },
    { id: 'love-letter', name: 'The Love Letter', structure: 'Emotional Crescendo', bestFor: 'Couples and quiet getaways' },
];

const PACE_OPTIONS: PaceLevel[] = ['Slow Burn', 'Balanced', 'Hypercut'];
const FOCUS_OPTIONS: FocusTarget[] = ['People', 'Places', 'Food', 'Motion', 'Details', 'Vistas'];
const ENDING_OPTIONS: EndingStyle[] = ['Mic Drop', 'Soft Landing', 'Cliffhanger'];

function App() {
  const [appState, setAppState] = useState<AppState>(AppState.IMPORTING);
  const [tripTitle, setTripTitle] = useState('REELCHEMY VOYAGE');
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [itinerary, setItinerary] = useState<LocationPoint[]>([]);
  const [story, setStory] = useState<RecallStory | null>(null);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [naturalItinerary, setNaturalItinerary] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [cloudLink, setCloudLink] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  
  // AI Asset Generation State
  const [genPrompt, setGenPrompt] = useState('');
  const [genType, setGenType] = useState<'image' | 'video'>('image');
  const [imageAspectRatio, setImageAspectRatio] = useState<ImageAspectRatio>('16:9');
  const [imageSize, setImageSize] = useState<ImageSize>('1K');
  const [videoAspectRatio, setVideoAspectRatio] = useState<VideoAspectRatio>('16:9');

  // Narrative Levers
  const [selectedCutPack, setSelectedCutPack] = useState<CutPack>(CUT_PACKS[0]);
  const [selectedArc, setSelectedArc] = useState<StoryArc>(STORY_ARCS[0]);
  const [pace, setPace] = useState<PaceLevel>('Balanced');
  const [focus, setFocus] = useState<FocusTarget[]>(['Vistas', 'Details']);
  const [ending, setEnding] = useState<EndingStyle>('Soft Landing');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // --- Audio Transcription ---
  const startRecording = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                const base64Audio = (reader.result as string).split(',')[1];
                setIsProcessing(true);
                setLoadingMsg("Transcribing your vision...");
                try {
                    const text = await transcribeAudio(base64Audio);
                    setNaturalItinerary(prev => prev + " " + text);
                } catch (e) {
                    console.error(e);
                } finally {
                    setIsProcessing(false);
                }
            };
        };

        mediaRecorder.start();
        setIsRecording(true);
    } catch (e) {
        console.error("Mic error:", e);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  // --- Cloud Sync Mock ---
  const handleCloudSync = () => {
    if (!cloudLink) return;
    setIsProcessing(true);
    setLoadingMsg("Synchronizing Cloud Album...");
    // Mocking cloud import: In real app, this would use Google Photos API
    setTimeout(() => {
        setMedia(prev => [
            ...prev,
            { id: `cloud-${Date.now()}`, url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e", mimeType: "image/jpeg", timestamp: new Date().toISOString(), source: 'cloud' },
            { id: `cloud-${Date.now() + 1}`, url: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1", mimeType: "image/jpeg", timestamp: new Date().toISOString(), source: 'cloud' }
        ]);
        setIsProcessing(false);
        setCloudLink('');
    }, 2000);
  };

  // --- Asset Generation ---
  const handleGenerateAsset = async () => {
    if (!genPrompt) return;
    setIsProcessing(true);
    setLoadingMsg(genType === 'image' ? "Generating High-Quality Image..." : "Synthesizing AI Video...");
    try {
        if (genType === 'image') {
            const url = await generateImage(genPrompt, imageAspectRatio, imageSize);
            setMedia(prev => [...prev, { id: `ai-${Date.now()}`, url, mimeType: 'image/png', timestamp: new Date().toISOString(), source: 'ai', base64: url }]);
        } else {
            const url = await generateVideo(genPrompt, videoAspectRatio);
            setMedia(prev => [...prev, { id: `ai-${Date.now()}`, url, mimeType: 'video/mp4', timestamp: new Date().toISOString(), source: 'ai' }]);
        }
        setAppState(AppState.IMPORTING);
        setGenPrompt('');
    } catch (e) {
        console.error(e);
        alert("Generation failed. Check console.");
    } finally {
        setIsProcessing(false);
    }
  };

  // --- Itinerary Extraction ---
  const handleExtractJourney = async () => {
    if (!naturalItinerary.trim()) return;
    setIsProcessing(true);
    setLoadingMsg("Geospatial Synthesis...");
    try {
        const points = await extractItinerary(naturalItinerary);
        setItinerary(prev => [...prev, ...points]);
    } catch (e) {
        alert("Studio connection failed.");
    } finally {
        setIsProcessing(false);
        setNaturalItinerary('');
    }
  };

  // --- Media Processing ---
  const processFiles = (files: File[]) => {
    setIsProcessing(true);
    const newMedia: MediaItem[] = [];
    let processedCount = 0;
    files.forEach((file: File, idx: number) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            newMedia.push({
                id: `media-${Date.now()}-${idx}`,
                url: URL.createObjectURL(file),
                mimeType: file.type,
                timestamp: new Date().toISOString(),
                base64: reader.result as string,
                source: 'upload'
            });
            processedCount++;
            if (processedCount === files.length) {
                setMedia(prev => [...prev, ...newMedia]);
                setIsProcessing(false);
            }
        };
        reader.readAsDataURL(file);
    });
  };

  // --- Main Narrative Synthesis ---
  const handleGenerate = async () => {
    setAppState(AppState.ANALYZING);
    setLoadingMsg("Activating Thinking Mode...");

    try {
        const generatedStory = await analyzeTripAndGenerateStory({
            title: tripTitle,
            cutPack: selectedCutPack,
            arc: selectedArc,
            pace,
            focus,
            ending,
            media,
            itinerary
        });

        setLoadingMsg("Developing Final Premiere...");
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContextClass();

        const voice = selectedCutPack.category === 'Moody' ? 'Kore' : 
                      selectedCutPack.category === 'Epic' ? 'Fenrir' : 
                      selectedCutPack.category === 'Bright' ? 'Puck' : 'Charon';

        for (let i = 0; i < generatedStory.beats.length; i++) {
            const beat = generatedStory.beats[i];
            const ab = await generateBeatAudio(beat.text, voice);
            beat.audioBuffer = await ctx.decodeAudioData(ab);
            setLoadingMsg(`Mastering Beat ${i + 1}/${generatedStory.beats.length}...`);
        }
        await ctx.close();

        setStory(generatedStory);
        setAppState(AppState.PREMIERE);
    } catch (err) {
        console.error(err);
        setAppState(AppState.IMPORTING);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black overflow-hidden relative">
      
      {/* BACKGROUND VIDEO */}
      <div className="fixed inset-0 z-0 overflow-hidden opacity-20 grayscale pointer-events-none">
        <video autoPlay muted loop playsInline className="w-full h-full object-cover scale-110 animate-slow-pan">
            <source src="https://assets.mixkit.co/videos/preview/mixkit-clouds-and-sun-at-sunset-from-above-the-clouds-40291-large.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black"></div>
      </div>

      {appState === AppState.IMPORTING && (
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 flex flex-col lg:flex-row gap-20 animate-fade-in">
          <div className="flex-1 space-y-12">
            <header className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] tracking-[0.3em] font-bold text-white/40 uppercase">
                   <Wand2 size={12} />
                   <span>Reelchemy Studio // Cinematic AI</span>
                </div>
                <h1 className="text-7xl md:text-9xl font-serif text-gradient leading-[0.9] tracking-tighter">
                   Alchemy <br/><span className="italic font-normal">of Memory.</span>
                </h1>
                <p className="max-w-md text-white/40 font-light leading-relaxed text-lg">
                   Turn your digital chaos—Photos, Videos, or raw Narrative—into a high-fidelity cinematic masterpiece.
                </p>
            </header>

            {/* QUICK ACTIONS */}
            <div className="grid md:grid-cols-2 gap-6">
                <div className="glass p-8 rounded-[2rem] studio-border space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Journey Map</label>
                        <button 
                            onMouseDown={startRecording}
                            onMouseUp={stopRecording}
                            className={`p-2 rounded-full transition-all ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                        >
                            <Mic size={16} />
                        </button>
                    </div>
                    <textarea 
                        value={naturalItinerary}
                        onChange={(e) => setNaturalItinerary(e.target.value)}
                        placeholder="Paste route or hold mic to narrate..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-light min-h-[100px] outline-none focus:border-white/30 transition-all resize-none"
                    />
                    <button 
                        onClick={handleExtractJourney}
                        disabled={!naturalItinerary.trim() || isProcessing}
                        className="w-full bg-white text-black py-3 rounded-full text-[10px] font-bold tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        EXTRACT MARKERS
                    </button>
                </div>

                <div className="glass p-8 rounded-[2rem] studio-border space-y-4">
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Cloud Sync</label>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={cloudLink}
                            onChange={(e) => setCloudLink(e.target.value)}
                            placeholder="Paste Google Photos/Drive link..."
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 text-xs outline-none focus:border-white/30 transition-all"
                        />
                        <button 
                            onClick={handleCloudSync}
                            className="bg-white/5 hover:bg-white/10 p-4 rounded-xl transition-all"
                        >
                            <Cloud size={16} />
                        </button>
                    </div>
                    <div className="flex gap-4">
                        <button 
                            onClick={() => setAppState(AppState.GENERATING_ASSET)}
                            className="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 py-3 rounded-xl text-[10px] font-bold tracking-widest transition-all"
                        >
                            <Sparkles size={12} /> CREATE ASSET
                        </button>
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 py-3 rounded-xl text-[10px] font-bold tracking-widest transition-all"
                        >
                            <Upload size={12} /> UPLOAD
                        </button>
                    </div>
                    <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => processFiles(Array.from(e.target.files || []))} accept="image/*,video/*" />
                </div>
            </div>

            {itinerary.length > 0 && (
                <div className="flex flex-wrap gap-2 animate-fade-in">
                    {itinerary.map((loc, i) => (
                        <div key={i} className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-[10px] flex items-center gap-2 group">
                            <MapIcon size={10} className="text-white/40" />
                            <span>{loc.name.toUpperCase()}</span>
                            <button onClick={() => setItinerary(prev => prev.filter((_, idx) => idx !== i))}><Trash2 size={10} className="text-red-400 opacity-0 group-hover:opacity-100 transition-all" /></button>
                        </div>
                    ))}
                </div>
            )}
          </div>

          <div className="w-full lg:w-[400px] space-y-6">
            <div className="glass p-10 rounded-[2.5rem] studio-border space-y-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Voyage Vault</label>
                    <div className="grid grid-cols-4 gap-2">
                        {media.map(m => (
                            <div key={m.id} className="aspect-square rounded-lg overflow-hidden border border-white/10 relative group">
                                {m.mimeType.startsWith('video') ? (
                                    <div className="w-full h-full bg-zinc-800 flex items-center justify-center"><Film size={12} /></div>
                                ) : (
                                    <img src={m.url} className="w-full h-full object-cover" />
                                )}
                                <button onClick={() => setMedia(prev => prev.filter(x => x.id !== m.id))} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-all"><X size={8}/></button>
                            </div>
                        ))}
                        <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-lg border border-dashed border-white/20 flex items-center justify-center text-white/20 hover:text-white transition-all">+</button>
                    </div>
                </div>

                <div className="space-y-4 pt-4">
                    <button 
                        disabled={media.length === 0}
                        onClick={() => setAppState(AppState.DESIGNING)}
                        className="w-full bg-white text-black py-6 rounded-full font-bold tracking-[0.2em] flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-20 shadow-2xl"
                    >
                        DESIGN PREMIERE
                        <ArrowRight size={18} />
                    </button>
                </div>
            </div>
          </div>
        </div>
      )}

      {appState === AppState.GENERATING_ASSET && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-fade-in">
            <div className="max-w-2xl w-full glass p-12 rounded-[3rem] studio-border space-y-10 relative">
                <button onClick={() => setAppState(AppState.IMPORTING)} className="absolute top-8 right-8 text-white/40 hover:text-white transition-all"><X size={24}/></button>
                
                <header className="space-y-2 text-center">
                    <h2 className="text-4xl font-serif text-gradient">AI Asset Studio</h2>
                    <p className="text-[10px] text-white/40 uppercase tracking-[0.3em]">Generate custom fragments for your film</p>
                </header>

                <div className="space-y-6">
                    <div className="flex bg-white/5 p-1 rounded-full">
                        <button onClick={() => setGenType('image')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full text-[10px] font-bold tracking-widest transition-all ${genType === 'image' ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white'}`}>
                            <ImageIcon size={14} /> IMAGE
                        </button>
                        <button onClick={() => setGenType('video')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full text-[10px] font-bold tracking-widest transition-all ${genType === 'video' ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white'}`}>
                            <VideoIcon size={14} /> VIDEO (VEO 3.1)
                        </button>
                    </div>

                    <textarea 
                        value={genPrompt}
                        onChange={(e) => setGenPrompt(e.target.value)}
                        placeholder="Describe the fragment... e.g., A vintage drone shot of the Amalfi coast at sunset, cinematic lighting."
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-sm font-light min-h-[150px] outline-none focus:border-white/30 transition-all resize-none"
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Aspect Ratio</label>
                            <select 
                                value={genType === 'image' ? imageAspectRatio : videoAspectRatio}
                                onChange={(e) => genType === 'image' ? setImageAspectRatio(e.target.value as any) : setVideoAspectRatio(e.target.value as any)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs outline-none"
                            >
                                {genType === 'image' ? (
                                    ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"].map(r => <option key={r} value={r}>{r}</option>)
                                ) : (
                                    ["16:9", "9:16"].map(r => <option key={r} value={r}>{r}</option>)
                                )}
                            </select>
                        </div>
                        {genType === 'image' && (
                             <div className="space-y-2">
                                <label className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Resolution</label>
                                <select 
                                    value={imageSize}
                                    onChange={(e) => setImageSize(e.target.value as any)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs outline-none"
                                >
                                    {["1K", "2K", "4K"].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                <button 
                    onClick={handleGenerateAsset}
                    disabled={!genPrompt || isProcessing}
                    className="w-full bg-white text-black py-6 rounded-full font-bold tracking-[0.2em] flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-20"
                >
                    {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                    GENERATE ASSET
                </button>
            </div>
        </div>
      )}

      {appState === AppState.DESIGNING && (
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-20 animate-fade-in-up">
            <header className="mb-16 space-y-4">
                <button onClick={() => setAppState(AppState.IMPORTING)} className="text-[10px] font-bold tracking-[0.2em] text-white/30 hover:text-white transition-colors uppercase">← Back to Imports</button>
                <h2 className="text-6xl font-serif text-gradient tracking-tighter">Narrative Control</h2>
            </header>

            <div className="grid lg:grid-cols-3 gap-12">
                <div className="lg:col-span-2 space-y-10">
                    <div className="space-y-6">
                        <h3 className="text-[10px] font-bold tracking-[0.3em] uppercase text-white/40">Director Cut Packs</h3>
                        <div className="grid md:grid-cols-2 gap-4">
                            {CUT_PACKS.map(pack => (
                                <button 
                                    key={pack.id}
                                    onClick={() => setSelectedCutPack(pack)}
                                    className={`p-6 rounded-3xl border text-left transition-all relative overflow-hidden group ${selectedCutPack.id === pack.id ? 'bg-white text-black border-white' : 'glass border-white/10 hover:border-white/30'}`}
                                >
                                    <div className="text-xl font-serif mb-1">{pack.name}</div>
                                    <div className={`text-[10px] italic font-medium mb-3 ${selectedCutPack.id === pack.id ? 'text-black/60' : 'text-white/40'}`}>{pack.promise}</div>
                                    <div className={`text-[9px] leading-relaxed ${selectedCutPack.id === pack.id ? 'text-black/40' : 'text-white/20'}`}>{pack.description}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-12">
                    <div className="glass p-8 rounded-[2rem] space-y-8 studio-border">
                        <h3 className="text-[10px] font-bold tracking-[0.3em] uppercase text-white/40">Synthesis Config</h3>
                        
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <label className="text-[9px] font-bold uppercase tracking-widest text-white/30">Pace</label>
                                <div className="flex gap-2">
                                    {PACE_OPTIONS.map(p => (
                                        <button key={p} onClick={() => setPace(p)} className={`flex-1 py-2 text-[8px] font-bold rounded-full border transition-all ${pace === p ? 'bg-white text-black border-white' : 'border-white/10 text-white/40 hover:border-white/20'}`}>{p.toUpperCase()}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[9px] font-bold uppercase tracking-widest text-white/30">Focus</label>
                                <div className="flex flex-wrap gap-2">
                                    {FOCUS_OPTIONS.map(f => (
                                        <button key={f} onClick={() => setFocus(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])} className={`px-3 py-1.5 text-[8px] font-bold rounded-full border transition-all ${focus.includes(f) ? 'bg-white text-black border-white' : 'border-white/10 text-white/40 hover:border-white/20'}`}>{f.toUpperCase()}</button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={handleGenerate}
                            className="w-full bg-white text-black py-6 rounded-full font-bold tracking-[0.2em] flex items-center justify-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-[0_0_50px_rgba(255,255,255,0.1)]"
                        >
                            <Sparkles size={18} /> PREMIERE FILM
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {appState === AppState.ANALYZING && (
        <div className="min-h-screen flex flex-col items-center justify-center p-10 relative z-20">
            <div className="space-y-12 text-center relative">
                <div className="flex items-center justify-center gap-1">
                    {[1,2,3,4,5,6].map(i => <div key={i} className="w-1 h-20 bg-white rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }}></div>)}
                </div>
                <div className="space-y-6">
                    <h2 className="text-5xl font-serif italic tracking-wider animate-pulse text-gradient">{loadingMsg}</h2>
                    <span className="text-[10px] font-mono tracking-[0.3em] opacity-30 uppercase">Thinking Mode: Active // Deep Narrative Analysis</span>
                </div>
            </div>
        </div>
      )}

      {(appState === AppState.PREMIERE || appState === AppState.PLAYBACK) && story && (
        <ScrollyStory story={story} media={media} onExit={() => setAppState(AppState.IMPORTING)} />
      )}

      {/* GLOBAL LOADING OVERLAY */}
      {isProcessing && appState !== AppState.ANALYZING && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center">
            <div className="flex flex-col items-center gap-6">
                <Loader2 size={48} className="animate-spin text-white" />
                <p className="text-sm font-bold tracking-widest uppercase">{loadingMsg}</p>
            </div>
        </div>
      )}
    </div>
  );
}

export default App;
