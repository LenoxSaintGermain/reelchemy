
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useState } from 'react';
import { RecallStory, MediaItem, StoryBeat } from '../types';
import { X, Volume2, VolumeX, ArrowDown, MapPin, Maximize2, Globe, Film } from 'lucide-react';

interface Props {
  story: RecallStory;
  media: MediaItem[];
  onExit: () => void;
}

const ScrollyStory: React.FC<Props> = ({ story, media, onExit }) => {
  const [muted, setMuted] = useState(false);
  const [activeBeatIndex, setActiveBeatIndex] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioContextRef.current = new AudioContextClass();
    return () => {
        audioContextRef.current?.close();
    };
  }, []);

  const playBeatAudio = (beat: StoryBeat) => {
    if (!audioContextRef.current || muted || !beat.audioBuffer) return;

    if (currentSourceRef.current) {
        try { currentSourceRef.current.stop(); } catch (e) {}
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = beat.audioBuffer;
    source.connect(audioContextRef.current.destination);
    source.start();
    currentSourceRef.current = source;
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const progress = scrollTop / (scrollHeight - clientHeight);
    setScrollProgress(progress);

    const windowHeight = window.innerHeight;
    const newIndex = Math.round(scrollTop / windowHeight);
    
    if (newIndex !== activeBeatIndex && newIndex < story.beats.length) {
        setActiveBeatIndex(newIndex);
        playBeatAudio(story.beats[newIndex]);
    }
  };

  const activeBeat = story.beats[activeBeatIndex];
  const activeMedia = media.find(m => m.id === activeBeat?.associatedMediaId) || media[0];

  return (
    <div className="fixed inset-0 bg-black text-white z-50 overflow-hidden flex flex-col md:flex-row font-sans animate-fade-in">
      
      {/* CINEMATIC CANVAS */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-black/60 z-10 transition-opacity duration-1000"></div>
        
        <div className="absolute inset-0 transform transition-transform duration-[2000ms] ease-out scale-110" style={{ transform: `scale(${1.1 + scrollProgress * 0.1})` }}>
            {activeMedia ? (
                <img src={activeMedia.url} className="w-full h-full object-cover filter brightness-[0.7] contrast-[1.1] blur-sm" alt="Scene" />
            ) : (
                <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                    <Globe size={100} className="text-white/10 animate-pulse" />
                </div>
            )}
        </div>

        <div className="absolute inset-0 pointer-events-none z-20 opacity-20 mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')]"></div>
        <div className="absolute inset-0 z-15 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)]"></div>
      </div>

      {/* INTERFACE OVERLAY */}
      <div className="absolute top-10 left-10 right-10 z-50 flex items-start justify-between">
         <div className="flex items-center gap-10">
            <button 
                onClick={onExit} 
                className="w-12 h-12 bg-white/5 hover:bg-white text-white hover:text-black backdrop-blur-3xl rounded-full transition-all flex items-center justify-center border border-white/10"
            >
                <X size={20} />
            </button>
            <div className="hidden md:block">
                <h3 className="text-[10px] font-bold tracking-[0.4em] text-white/30 uppercase mb-1 flex items-center gap-2">
                    <Film size={12}/> Reelchemy Studio
                </h3>
                <h4 className="font-serif italic text-2xl text-gradient">{story.title}</h4>
            </div>
         </div>

         {activeBeat?.location && (
             <div className="flex flex-col items-end gap-1">
                 <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full backdrop-blur-3xl animate-fade-in">
                    <MapPin size={12} className="text-white/40" />
                    <span className="text-[10px] font-bold tracking-widest">{activeBeat.location.name.toUpperCase()}</span>
                 </div>
             </div>
         )}
      </div>

      {/* STORY PROGRESS */}
      <div className="absolute bottom-10 right-10 z-50 flex items-center gap-4 group">
          <div className="text-right">
              <div className="text-[10px] font-bold tracking-[0.2em] text-white/30 uppercase">Beat</div>
              <div className="text-xl font-mono font-light">{activeBeatIndex + 1} / {story.beats.length}</div>
          </div>
          <div className="relative w-16 h-16">
              <svg className="w-full h-full transform -rotate-90">
                  <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="1" fill="transparent" className="text-white/10" />
                  <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="2" fill="transparent" className="text-white" 
                          strokeDasharray={176} strokeDashoffset={176 - (176 * scrollProgress)} />
              </svg>
          </div>
      </div>

      {/* SCROLL ENGINE */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="relative z-30 h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
      >
        {story.beats.map((beat, idx) => (
          <div key={idx} className="h-screen w-full snap-start flex flex-col items-center justify-center p-12 md:p-24 text-center">
            <div className={`max-w-4xl space-y-12 transition-all duration-1000 ${activeBeatIndex === idx ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
               <div className="flex items-center justify-center gap-6">
                  <div className="w-12 h-[1px] bg-white/10"></div>
                  <span className="text-[10px] font-bold tracking-[0.5em] text-white/30 uppercase">Beat {idx + 1}</span>
                  <div className="w-12 h-[1px] bg-white/10"></div>
               </div>
               
               <p className="text-4xl md:text-7xl font-serif leading-[1.1] tracking-tight text-white drop-shadow-[0_5px_30px_rgba(0,0,0,0.5)]">
                  {beat.text}
               </p>

               {idx === 0 && (
                   <div className="pt-20 flex flex-col items-center gap-4 text-white/20 animate-bounce">
                      <span className="text-[10px] uppercase tracking-[0.3em] font-bold">Scroll to navigate the memory</span>
                      <ArrowDown size={20} />
                   </div>
               )}
            </div>
          </div>
        ))}

        {/* FINALE SCREEN */}
        <div className="h-screen w-full snap-start flex flex-col items-center justify-center bg-black/95 backdrop-blur-3xl">
            <div className="text-center space-y-12 max-w-2xl px-6 animate-fade-in-up">
                <div className="space-y-4">
                    <div className="text-white/30 font-serif italic text-3xl">Fin.</div>
                    <h4 className="text-7xl md:text-9xl font-serif text-gradient leading-none">{story.title}</h4>
                </div>
                
                <div className="h-[1px] w-40 bg-white/10 mx-auto"></div>

                <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                    <button 
                        onClick={onExit}
                        className="w-full md:w-auto px-12 py-6 bg-white text-black rounded-full font-bold tracking-widest hover:scale-105 transition-all shadow-[0_0_40px_rgba(255,255,255,0.1)]"
                    >
                        RETURN TO STUDIO
                    </button>
                    <button className="w-full md:w-auto px-12 py-6 bg-white/5 border border-white/10 text-white rounded-full font-bold tracking-widest hover:bg-white/10 transition-all">
                        SHARE PREMIERE
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* CINEMATIC LETTERBOXING */}
      <div className="fixed inset-x-0 top-0 h-14 bg-black z-[60] pointer-events-none opacity-50"></div>
      <div className="fixed inset-x-0 bottom-0 h-14 bg-black z-[60] pointer-events-none opacity-50"></div>

    </div>
  );
};

export default ScrollyStory;
