
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export type CutPackCategory = 'Moody' | 'Bright' | 'Epic' | 'Artsy';

export interface CutPack {
    id: string;
    category: CutPackCategory;
    name: string;
    promise: string;
    description: string;
}

export interface StoryArc {
    id: string;
    name: string;
    structure: string;
    bestFor: string;
}

export type PaceLevel = 'Slow Burn' | 'Balanced' | 'Hypercut';
export type FocusTarget = 'People' | 'Places' | 'Food' | 'Motion' | 'Details' | 'Vistas';
export type EndingStyle = 'Mic Drop' | 'Soft Landing' | 'Cliffhanger';

export interface LocationPoint {
    name: string;
    lat: number;
    lng: number;
    description?: string;
}

export interface MediaItem {
    id: string;
    url: string;
    mimeType: string;
    description?: string;
    location?: LocationPoint;
    timestamp: string;
    base64?: string;
    source?: 'upload' | 'cloud' | 'ai';
}

export interface StoryBeat {
    index: number;
    text: string;
    associatedMediaId?: string;
    location?: LocationPoint;
    audioBuffer: AudioBuffer | null;
}

export interface RecallStory {
    title: string;
    beats: StoryBeat[];
}

export enum AppState {
    IMPORTING,
    ROUTE_CONFIRMED,
    DESIGNING,
    ANALYZING,
    PREMIERE,
    PLAYBACK,
    GENERATING_ASSET
}

export type ImageAspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "9:16" | "16:9" | "21:9";
export type ImageSize = "1K" | "2K" | "4K";
export type VideoAspectRatio = "16:9" | "9:16";

/**
 * Additional types required by specific cinematic and mapping components
 */
export type StoryStyle = 'NOIR' | 'CHILDREN' | 'HISTORICAL' | 'FANTASY';

export interface RouteDetails {
  startAddress: string;
  endAddress: string;
  distance: string;
  duration: string;
  durationSeconds: number;
  travelMode: 'WALKING' | 'DRIVING';
  voiceName: string;
  storyStyle: StoryStyle;
}

export interface StorySegment {
  index: number;
  text: string;
  audioBuffer: AudioBuffer | null;
}

export interface AudioStory {
  segments: StorySegment[];
  totalSegmentsEstimate: number;
}
