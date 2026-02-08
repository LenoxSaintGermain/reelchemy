
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Modality, Type, GenerateContentResponse } from "@google/genai";
import { CutPack, StoryArc, PaceLevel, FocusTarget, EndingStyle, MediaItem, StoryBeat, RecallStory, LocationPoint, ImageAspectRatio, ImageSize, VideoAspectRatio } from "../types";
import { base64ToArrayBuffer, pcmToWav } from "./audioUtils";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Transcribes audio using gemini-3-flash-preview
 */
export const transcribeAudio = async (base64Audio: string): Promise<string> => {
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
    let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt,
        config: {
            numberOfVideos: 1,
            resolution: '720p',
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
 * Extracts a structured itinerary from natural language using Maps Grounding.
 */
export const extractItinerary = async (text: string): Promise<LocationPoint[]> => {
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
 * Analyzes trip and generates story using gemini-3-pro-preview with Thinking Mode.
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
    const { title, cutPack, arc, pace, focus, ending, media, itinerary } = params;
    
    // Explicit Video Understanding: Gemini 3 Pro handles video natively in multimodal prompts.
    const mediaParts = media.slice(0, 15).map(m => {
        if (m.base64) {
            return {
                inlineData: {
                    data: m.base64.split(',')[1] || m.base64,
                    mimeType: m.mimeType
                }
            };
        }
        return { text: `[Fragment: ${m.url}]` };
    });

    const itineraryContext = itinerary.map(loc => `${loc.name}`).join(" -> ");

    const prompt = {
        parts: [
            ...mediaParts as any,
            { text: `
                You are the Principal Director at REELCHEMY STUDIO.
                Task: Turn these fragments (images and videos) into a cinematic Premiere.
                
                Voyage Title: ${title}
                Route: ${itineraryContext || 'Not specified'}
                
                NARRATIVE CONFIGURATION:
                - Cut Pack (Style): ${cutPack.name}
                - Story Arc (Structure): ${arc.name}
                - Pace: ${pace}
                - Focus Elements: ${focus.join(', ')}
                - Ending Style: ${ending}

                INSTRUCTIONS:
                - Analyze the visual content of all videos and images deeply.
                - Use Search Grounding to find interesting facts about the locations in the route.
                - Create narrative "Beats" that weave these elements together.
                - Return only valid JSON.
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
        rawJson.beats.map(async (b: any) => {
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
