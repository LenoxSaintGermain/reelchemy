
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect } from 'react';
import { 
    Camera, Sparkles, Loader2, Play, Film, ArrowRight, Upload, Globe, 
    CheckCircle2, AlertCircle, Map as MapIcon, Trash2, Sliders, Layers, 
    Zap, Target, Flag, RefreshCw, Star, Mic, Cloud, Wand2, Image as ImageIcon, Video as VideoIcon, X,
    ChevronRight, Library, Plus, Scissors
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

// Mock Google Photos Albums
const MOCK_ALBUMS = [
    { id: 'alb-1', title: 'Summer in Positano', count: 124, cover: 'https://images.unsplash.com/photo-1533105079780-92b9be482077' },
    { id: 'alb-2', title: 'London Nocturnes', count: 45, cover: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad' },
    { id: 'alb-3', title: 'Nordic Light', count: 89, cover: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4' },
];

function App() {
  const [appState, setAppState] = useState<AppState>(AppState.IMPORTING);
  const [tripTitle, setTripTitle] = useState('REELCHEMY VOYAGE');
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [itinerary, setItinerary] = useState<LocationPoint[]>([]);
  const [story, setStory] = useState<RecallStory | null>(null);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [naturalItinerary, setNaturalItinerary] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showAlbumPicker, setShowAlbumPicker] = useState(false);
  
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
        mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                const base64Audio = (reader.result as string).split(',')[1];
                setIsProcessing(true);
                setLoadingMsg("Alchemy transcribing...");
                try {
                    const text = await transcribeAudio(base64Audio);
                    setNaturalItinerary(prev => prev + " " + text);
                } catch (e) { console.error(e); } finally { setIsProcessing(false); }
            };
        };
        mediaRecorder.start();
        setIsRecording(true);
    } catch (e) { console.error(e); }
  };

  const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); };

  // --- Google Photos Mock ---
  const handleSelectAlbum = (albumId: string) => {
    setIsProcessing(true);
    setLoadingMsg("Synchronizing Cloud Fragments...");
    setShowAlbumPicker(false);
    setTimeout(() => {
        const newMedia: MediaItem[] = [
            { id: `cl-${Date.now()}-1`, url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e", mimeType: "image/jpeg", timestamp: new Date().toISOString(), source: 'cloud' },
            { id: `cl-${Date.now()}-2`, url: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1", mimeType: "image/jpeg", timestamp: new Date().toISOString(), source: 'cloud' }
        ];
        setMedia(prev => [...prev, ...newMedia]);
        setIsProcessing(false);
    }, 2000);
  };

  // --- Asset Generation ---
  const handleGenerateAsset = async () => {
    if (!genPrompt) return;

    // Veo Mandatory Check: Ensure Key Selection
    // Assume window.aistudio.hasSelectedApiKey and openSelectKey are available
    // @ts-ignore
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) {
        // @ts-ignore
        await window.aistudio.openSelectKey();
    }

    setIsProcessing(true);
    setLoadingMsg(genType === 'image' ? "Generating Cinematic Frame..." : "Rendering AI Sequence...");
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
        alert("Studio error: Generation failed. Please select a valid paid API key for Veo.");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleExtractJourney = async () => {
    if (!naturalItinerary.trim()) return;
    setIsProcessing(true);
    setLoadingMsg("Geospatial Synthesis...");
    try {
        const points = await extractItinerary(naturalItinerary);
        setItinerary(prev => [...prev, ...points]);
    } catch (e) { console.error(e); } finally {
        setIsProcessing(false);
        setNaturalItinerary('');
    }
  };

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

  const handleGenerate = async () => {
    setAppState(AppState.ANALYZING);
    setLoadingMsg("Activating Deep Thinking Mode...");
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

        setLoadingMsg("Developing Premiere Cut...");
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContextClass();
        const voice = selectedCutPack.category === 'Moody' ? 'Kore' : 'Puck';

        for (let i = 0; i < generatedStory.beats.length; i++) {
            const beat = generatedStory.beats[i];
            const ab = await generateBeatAudio(beat.text, voice);
            beat.audioBuffer = await ctx.decodeAudioData(ab);
            setLoadingMsg(`Mastering Scene ${i + 1}/${generatedStory.beats.length}...`);
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
      {/* CINEMATIC BG */}
      <div className="fixed inset-0 z-0 opacity-20 grayscale pointer-events-none">
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
                   <Star size={12} className="text-amber-500" />
                   <span>REELCHEMY // STUDIO</span>
                </div>
                <h1 className="text-7xl md:text-9xl font-serif text-gradient leading-[0.9] tracking-tighter">
                   Alchemy <br/><span className="italic font-normal">of the Frame.</span>
                </h1>
                <p className="max-w-md text-white/40 font-light leading-relaxed text-lg">
                   Turn your fragmented travel media into a cohesive cinematic narrative. Connect your library or synthesize new scenes.
                </p>
            </header>

            <div className="grid md:grid-cols-2 gap-8">
                {/* JOURNEY INPUT */}
                <div className="glass p-8 rounded-[2.5rem] studio-border space-y-6">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">The Narrative Route</label>
                        <button 
                            onMouseDown={startRecording}
                            onMouseUp={stopRecording}
                            className={`p-3 rounded-full transition-all ${isRecording ? 'bg-red-500 shadow-xl animate-pulse' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                        >
                            <Mic size={18} />
                        </button>
                    </div>
                    <textarea 
                        value={naturalItinerary}
                        onChange={(e) => setNaturalItinerary(e.target.value)}
                        placeholder="Paste your itinerary or hold the mic to narrate..."
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-xs font-light min-h-[140px] outline-none focus:border-white/30 transition-all resize-none placeholder:text-white/10"
                    />
                    <button 
                        onClick={handleExtractJourney}
                        disabled={!naturalItinerary.trim() || isProcessing}
                        className="w-full bg-white text-black py-4 rounded-full text-[10px] font-bold tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        EXTRACT MARKERS
                    </button>
                </div>

                {/* ASSET IMPORT */}
                <div className="glass p-8 rounded-[2.5rem] studio-border space-y-8 flex flex-col justify-between">
                    <div className="space-y-6">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Import fragments</label>
                        <div className="grid grid-cols-2 gap-4">
                            <button 
                                onClick={() => setShowAlbumPicker(true)}
                                className="flex flex-col items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/5 py-8 rounded-3xl transition-all group"
                            >
                                <Cloud size={24} className="text-white/20 group-hover:text-white" />
                                <span className="text-[9px] font-bold tracking-widest uppercase">Google Photos</span>
                            </button>
                            <button 
                                onClick={() => setAppState(AppState.GENERATING_ASSET)}
                                className="flex flex-col items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/5 py-8 rounded-3xl transition-all group"
                            >
                                <Sparkles size={24} className="text-white/20 group-hover:text-amber-400" />
                                <span className="text-[9px] font-bold tracking-widest uppercase">AI Studio</span>
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="h-[1px] bg-white/5 w-full"></div>
                        <div className="flex items-center justify-between text-[9px] font-bold tracking-widest text-white/20 uppercase">
                            <span>Local Uploads</span>
                            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 text-white/40 hover:text-white transition-all">
                                <Plus size={12} /> SELECT FILES
                            </button>
                        </div>
                        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => processFiles(Array.from(e.target.files || []))} accept="image/*,video/*" />
                    </div>
                </div>
            </div>
          </div>

          {/* VOYAGE VAULT (SIDEBAR) */}
          <div className="w-full lg:w-[400px] flex flex-col">
            <div className="glass p-10 rounded-[2.5rem] studio-border h-full flex flex-col">
                <div className="flex-1 space-y-8">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Voyage Vault</label>
                        <span className="text-[10px] font-mono text-white/20">{media.length} FRAGMENTS</span>
                    </div>

                    {media.length === 0 ? (
                        <div className="flex-1 border border-dashed border-white/10 rounded-[2rem] flex flex-col items-center justify-center p-12 text-center space-y-6 opacity-30">
                            <Library size={48} />
                            <p className="text-[10px] font-bold tracking-[0.2em] uppercase">The vault is waiting for fragments</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-4 gap-3 content-start">
                            {media.map(m => (
                                <div key={m.id} className="aspect-square rounded-xl overflow-hidden border border-white/10 relative group bg-zinc-900">
                                    {m.mimeType.startsWith('video') ? (
                                        <div className="w-full h-full flex items-center justify-center"><Film size={14} className="text-white/30" /></div>
                                    ) : (
                                        <img src={m.url} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                    )}
                                    <button onClick={() => setMedia(prev => prev.filter(x => x.id !== m.id))} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-black/80 p-1 rounded-md transition-all">
                                        <Trash2 size={10} className="text-red-400" />
                                    </button>
                                    {m.source === 'ai' && <div className="absolute bottom-1 left-1 w-1.5 h-1.5 bg-amber-500 rounded-full shadow-[0_0_5px_rgba(245,158,11,0.8)]"></div>}
                                </div>
                            ))}
                            <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-xl border border-dashed border-white/20 flex items-center justify-center text-white/20 hover:text-white transition-all">+</button>
                        </div>
                    )}
                </div>

                <div className="pt-10">
                    <button 
                        disabled={media.length === 0}
                        onClick={() => setAppState(AppState.DESIGNING)}
                        className="w-full bg-white text-black py-7 rounded-full font-bold tracking-[0.2em] flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-20 shadow-2xl"
                    >
                        DESIGN PREMIERE
                        <ArrowRight size={18} />
                    </button>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* ALBUM PICKER MODAL */}
      {showAlbumPicker && (
          <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-fade-in">
              <div className="max-w-4xl w-full glass p-12 rounded-[3.5rem] studio-border space-y-12 relative">
                  <button onClick={() => setShowAlbumPicker(false)} className="absolute top-10 right-10 text-white/40 hover:text-white transition-all"><X size={28}/></button>
                  <header className="space-y-2 text-center">
                      <h2 className="text-5xl font-serif text-gradient">Google Photos</h2>
                      <p className="text-[10px] text-white/40 uppercase tracking-[0.4em]">Connect your fragments for the premiere</p>
                  </header>

                  <div className="grid md:grid-cols-3 gap-8">
                      {MOCK_ALBUMS.map(alb => (
                          <button 
                            key={alb.id}
                            onClick={() => handleSelectAlbum(alb.id)}
                            className="group flex flex-col text-left space-y-6"
                          >
                              <div className="aspect-[4/5] rounded-[2.5rem] overflow-hidden relative border border-white/5 transition-all group-hover:scale-[1.02] group-hover:border-white/20 shadow-2xl">
                                  <img src={alb.cover} className="w-full h-full object-cover grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-1000" />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
                                  <div className="absolute bottom-8 left-8">
                                      <p className="text-[10px] font-bold tracking-widest text-white/50 uppercase">{alb.count} ITEMS</p>
                                  </div>
                              </div>
                              <div className="px-2">
                                  <p className="text-lg font-bold tracking-widest uppercase">{alb.title}</p>
                              </div>
                          </button>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {appState === AppState.GENERATING_ASSET && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-fade-in">
            <div className="max-w-3xl w-full glass p-16 rounded-[4rem] studio-border space-y-12 relative shadow-[0_0_100px_rgba(255,255,255,0.05)]">
                <button onClick={() => setAppState(AppState.IMPORTING)} className="absolute top-12 right-12 text-white/40 hover:text-white transition-all"><X size={28}/></button>
                
                <header className="space-y-4 text-center">
                    <h2 className="text-5xl font-serif text-gradient">AI Studio</h2>
                    <p className="text-[11px] text-white/40 uppercase tracking-[0.4em]">Synthesize cinematic fragments from nothing but thought</p>
                </header>

                <div className="space-y-8">
                    <div className="flex bg-white/5 p-2 rounded-full border border-white/5">
                        <button onClick={() => setGenType('image')} className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-full text-[11px] font-bold tracking-[0.2em] transition-all ${genType === 'image' ? 'bg-white text-black shadow-xl' : 'text-white/40 hover:text-white'}`}>
                            <ImageIcon size={16} /> IMAGE (PRO)
                        </button>
                        <button onClick={() => setGenType('video')} className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-full text-[11px] font-bold tracking-[0.2em] transition-all ${genType === 'video' ? 'bg-white text-black shadow-xl' : 'text-white/40 hover:text-white'}`}>
                            <VideoIcon size={16} /> VIDEO (VEO 3.1)
                        </button>
                    </div>

                    <textarea 
                        value={genPrompt}
                        onChange={(e) => setGenPrompt(e.target.value)}
                        placeholder="Define the vision... e.g., A low-angle drone shot of a misty Nordic fjord at first light, 35mm film grain, moody shadows."
                        className="w-full bg-white/5 border border-white/10 rounded-[2rem] p-8 text-sm font-light min-h-[160px] outline-none focus:border-white/30 transition-all resize-none placeholder:text-white/10"
                    />

                    <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em]">Aspect Ratio</label>
                            <select 
                                value={genType === 'image' ? imageAspectRatio : videoAspectRatio}
                                onChange={(e) => genType === 'image' ? setImageAspectRatio(e.target.value as any) : setVideoAspectRatio(e.target.value as any)}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-xs outline-none focus:border-white/30 appearance-none cursor-pointer"
                            >
                                {genType === 'image' ? (
                                    ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"].map(r => <option key={r} value={r}>{r}</option>)
                                ) : (
                                    ["16:9", "9:16"].map(r => <option key={r} value={r}>{r}</option>)
                                )}
                            </select>
                        </div>
                        {genType === 'image' && (
                             <div className="space-y-4">
                                <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em]">Resolution</label>
                                <select 
                                    value={imageSize}
                                    onChange={(e) => setImageSize(e.target.value as any)}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-xs outline-none focus:border-white/30 appearance-none cursor-pointer"
                                >
                                    {["1K", "2K", "4K"].map(s => <option key={s} value={s}>{s} Master</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                <button 
                    onClick={handleGenerateAsset}
                    disabled={!genPrompt || isProcessing}
                    className="w-full bg-white text-black py-7 rounded-full font-bold tracking-[0.3em] flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-20 shadow-[0_20px_60px_rgba(255,255,255,0.1)]"
                >
                    {isProcessing ? <Loader2 size={24} className="animate-spin" /> : <Scissors size={20} />}
                    SYNTHESIZE FRAGMENT
                </button>
                {genType === 'video' && (
                    <p className="text-center text-[9px] text-white/20 uppercase tracking-[0.2em]">Note: Veo generation requires a paid API key selection.</p>
                )}
            </div>
        </div>
      )}

      {appState === AppState.DESIGNING && (
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-20 animate-fade-in-up">
            <header className="mb-16 space-y-4 text-center">
                <button onClick={() => setAppState(AppState.IMPORTING)} className="text-[10px] font-bold tracking-[0.3em] text-white/30 hover:text-white transition-colors uppercase">← Back to Vault</button>
                <h2 className="text-7xl font-serif text-gradient tracking-tighter">Narrative Control</h2>
            </header>

            <div className="grid lg:grid-cols-3 gap-16">
                <div className="lg:col-span-2 space-y-12">
                    <div className="space-y-8">
                        <h3 className="text-[11px] font-bold tracking-[0.4em] uppercase text-white/40">Select Cut Pack</h3>
                        <div className="grid md:grid-cols-2 gap-6">
                            {CUT_PACKS.map(pack => (
                                <button 
                                    key={pack.id}
                                    onClick={() => setSelectedCutPack(pack)}
                                    className={`p-10 rounded-[3rem] border text-left transition-all relative overflow-hidden group ${selectedCutPack.id === pack.id ? 'bg-white text-black border-white shadow-2xl' : 'glass border-white/10 hover:border-white/30'}`}
                                >
                                    <div className="text-3xl font-serif mb-2">{pack.name}</div>
                                    <div className={`text-xs italic font-medium mb-4 ${selectedCutPack.id === pack.id ? 'text-black/60' : 'text-white/40'}`}>{pack.promise}</div>
                                    <div className={`text-[11px] leading-relaxed ${selectedCutPack.id === pack.id ? 'text-black/40' : 'text-white/20'}`}>{pack.description}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-12">
                    <div className="glass p-10 rounded-[3rem] space-y-10 studio-border shadow-2xl">
                        <h3 className="text-[11px] font-bold tracking-[0.4em] uppercase text-white/40">Synthesis Config</h3>
                        
                        <div className="space-y-10">
                            <div className="space-y-5">
                                <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30">Pace</label>
                                <div className="flex gap-2 p-2 bg-black/40 rounded-full border border-white/5">
                                    {PACE_OPTIONS.map(p => (
                                        <button key={p} onClick={() => setPace(p)} className={`flex-1 py-3 text-[9px] font-bold rounded-full transition-all ${pace === p ? 'bg-white text-black shadow-xl' : 'text-white/30 hover:text-white'}`}>{p.toUpperCase()}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-5">
                                <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30">Focus</label>
                                <div className="flex flex-wrap gap-2">
                                    {FOCUS_OPTIONS.map(f => (
                                        <button key={f} onClick={() => setFocus(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])} className={`px-5 py-3 text-[9px] font-bold rounded-full border transition-all ${focus.includes(f) ? 'bg-white text-black border-white' : 'border-white/10 text-white/30 hover:border-white/20'}`}>{f.toUpperCase()}</button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={handleGenerate}
                            className="w-full bg-white text-black py-8 rounded-full font-bold tracking-[0.3em] flex items-center justify-center gap-4 hover:scale-105 active:scale-95 transition-all shadow-[0_20px_50px_rgba(255,255,255,0.1)]"
                        >
                            <Sparkles size={24} /> PREMIERE FILM
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {appState === AppState.ANALYZING && (
        <div className="min-h-screen flex flex-col items-center justify-center p-10 relative z-20">
            <div className="space-y-16 text-center relative max-w-2xl">
                <div className="flex items-center justify-center gap-2">
                    {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="w-1.5 h-24 bg-white rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }}></div>)}
                </div>
                <div className="space-y-8">
                    <h2 className="text-6xl font-serif italic tracking-wider animate-pulse text-gradient leading-tight">{loadingMsg}</h2>
                    <div className="flex flex-col items-center gap-4">
                         <div className="h-[1px] w-32 bg-white/20"></div>
                         <span className="text-[11px] font-mono tracking-[0.5em] opacity-30 uppercase">Thinking System Active // Multimodal Narrative Alchemy</span>
                    </div>
                </div>
            </div>
        </div>
      )}

      {(appState === AppState.PREMIERE || appState === AppState.PLAYBACK) && story && (
        <ScrollyStory story={story} media={media} onExit={() => setAppState(AppState.IMPORTING)} />
      )}

      {/* GLOBAL LOADING OVERLAY */}
      {isProcessing && appState !== AppState.ANALYZING && (
        <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-xl flex items-center justify-center">
            <div className="flex flex-col items-center gap-10">
                <div className="relative">
                    <Loader2 size={64} className="animate-spin text-white opacity-20" />
                    <Sparkles size={24} className="absolute inset-0 m-auto text-white animate-pulse" />
                </div>
                <p className="text-[11px] font-bold tracking-[0.6em] uppercase text-white/60">{loadingMsg}</p>
            </div>
        </div>
      )}
    </div>
  );
}

export default App;
