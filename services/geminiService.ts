
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Modality, Type, GenerateContentResponse } from "@google/genai";
import { CutPack, StoryArc, PaceLevel, FocusTarget, EndingStyle, MediaItem, StoryBeat, RecallStory, LocationPoint, ImageAspectRatio, ImageSize, VideoAspectRatio } from "../types";
import { base64ToArrayBuffer, pcmToWav } from "./audioUtils";

/**
 * Transcribes audio using gemini-3-flash-preview
 */
export const transcribeAudio = async (base64Audio: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
            {
                parts: [
                    { inlineData: { data: base64Audio, mimeType: 'audio/wav' } },
                    { text: "Transcribe this travel narrative accurately. Return only the text." }
                ]
            }
        ]
    });
    return response.text?.trim() || "";
};

/**
 * Generates an image using gemini-3-pro-image-preview
 */
export const generateImage = async (prompt: string, aspectRatio: ImageAspectRatio, size: ImageSize): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: prompt }] },
        config: {
            imageConfig: {
                aspectRatio,
                imageSize: size
            }
        }
    });

    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (!part?.inlineData?.data) throw new Error("Image generation failed");
    return `data:image/png;base64,${part.inlineData.data}`;
};

/**
 * Generates a video using veo-3.1-fast-generate-preview
 */
export const generateVideo = async (prompt: string, aspectRatio: VideoAspectRatio): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt,
        config: {
            numberOfVideos: 1,
            resolution: '720p', // standard for fast-generate
            aspectRatio
        }
    });

    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    const fetchResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const blob = await fetchResponse.blob();
    return URL.createObjectURL(blob);
};

/**
 * Extracts a structured itinerary using gemini-2.5-flash with Google Maps tool.
 */
export const extractItinerary = async (text: string): Promise<LocationPoint[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Extract a list of travel locations from this description: "${text}". 
        Provide estimated latitude and longitude for each.
        Output strictly valid JSON array of objects: [{"name": "string", "lat": number, "lng": number}]`,
        config: { 
            tools: [{ googleMaps: {} }],
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        lat: { type: Type.NUMBER },
                        lng: { type: Type.NUMBER }
                    },
                    required: ["name", "lat", "lng"]
                }
            }
        }
    });
    return JSON.parse(response.text || "[]");
};

/**
 * Core Narrative Engine: Uses gemini-3-pro-preview with thinking budget and search.
 */
export const analyzeTripAndGenerateStory = async (params: { 
    title: string; 
    cutPack: CutPack; 
    arc: StoryArc; 
    pace: PaceLevel;
    focus: FocusTarget[];
    ending: EndingStyle;
    media: MediaItem[]; 
    itinerary: LocationPoint[] 
}): Promise<RecallStory> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const { title, cutPack, arc, pace, focus, media, itinerary } = params;
    
    // Video Understanding: Gemini 3 Pro multimodal processing
    const mediaParts = media.slice(0, 15).map(m => {
        if (m.base64 && m.mimeType.startsWith('image')) {
            return {
                inlineData: {
                    data: m.base64.split(',')[1] || m.base64,
                    mimeType: m.mimeType
                }
            };
        }
        // Videos or missing base64 are handled as references if possible, 
        // but for this implementation we prioritize the visuals we have
        return { text: `[Fragment: ${m.url} - ${m.source} source]` };
    });

    const itineraryContext = itinerary.map(loc => `${loc.name}`).join(" -> ");

    const prompt = {
        parts: [
            ...mediaParts as any,
            { text: `
                System: You are the Lead Narrative Architect at REELCHEMY STUDIO.
                Project: ${title}
                Route: ${itineraryContext}
                
                NARRATIVE DIRECTION:
                - Style: ${cutPack.name} (${cutPack.description})
                - Structure: ${arc.name}
                - Pacing: ${pace}
                - Key Focus: ${focus.join(', ')}

                REQUIREMENTS:
                1. Analyze visual fragments deeply (Video Understanding enabled).
                2. Use Search Grounding to enrich the narration with actual location details.
                3. Weave a cinematic story arc across exactly ${Math.max(4, Math.min(media.length, 10))} beats.
                4. Output only valid JSON.
            `}
        ]
    };

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { 
            tools: [{ googleSearch: {} }],
            thinkingConfig: { thinkingBudget: 32768 },
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    beats: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                index: { type: Type.INTEGER },
                                text: { type: Type.STRING },
                                locationName: { type: Type.STRING },
                                mediaId: { type: Type.STRING }
                            },
                            required: ["index", "text", "locationName"]
                        }
                    }
                }
            }
        }
    });

    const rawJson = JSON.parse(response.text || "{}");
    
    const beatsWithAudio: StoryBeat[] = await Promise.all(
        (rawJson.beats || []).map(async (b: any) => {
            const loc = itinerary.find(l => l.name.toLowerCase().includes(b.locationName.toLowerCase())) || itinerary[b.index % (itinerary.length || 1)];
            return {
                index: b.index,
                text: b.text,
                associatedMediaId: b.mediaId,
                location: loc,
                audioBuffer: null
            };
        })
    );

    return {
        title: rawJson.title || title,
        beats: beatsWithAudio
    };
};

export const generateBeatAudio = async (text: string, voice: string): Promise<ArrayBuffer> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } }
            }
        }
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) throw new Error("Audio generation failed");
    return pcmToWav(base64ToArrayBuffer(audioData), 24000).arrayBuffer();
};
