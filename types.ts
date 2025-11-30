
export interface Shot {
  id: number;
  description: string;
  imageUrl: string | null;
  videoUrl: string | null;
  shotType: string;
  cameraMovement: string;
  cameraType: string;
  lensType: string;
  lensBlur: string;
  atmosphere: string;
  lighting: string;
  style: string;
  technicalNotes: string;
  colorGrade: string;
  filmGrain: string;
  filmStock: string;
  duration: number;
  soundFx: string;
  notes: string;
  subplot?: string;
}

export interface Scene {
  id: number;
  title: string;
  characters: string;
  setting: string;
  location: string;
  dialogueType: 'dialogue' | 'mos';
  dialogue: string;
  shots: Shot[];
  transitionType: string;
  musicPrompt: string;
  keyObjects: string;
  actions: string;
  tone: string;
  notes: string;
  narrativeArc?: ArcPoint[];
}

export interface Episode {
  id: number;
  title: string;
  synopsis: string;
  scenes: Scene[];
  narrativeArc?: ArcPoint[];
}

export interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
}

export interface Character {
  id: number;
  name: string;
  role: string;
  personality: string;
  appearance: string;
  outfit: string;
  behavior: string;
  images: string[];
}

export interface Reference {
  title: string;
  uri: string;
  description: string;
  details?: string;
}

export type StoryboardStyle = 'Cinematic' | 'Sketch' | 'ComicBook' | 'Anime' | 'FilmNoir' | 'LineDrawing' | 'QuickLineDrawing' | 'LowPoly' | 'StylizedVideoGame' | 'Solarpunk' | 'Cyberpunk' | 'Sepia' | 'Custom';

export interface ArcPoint {
  id: number;
  label: string; // "Episode 1", "Scene 1", etc.
  x?: number; // Horizontal position 0-100
  tension: number; // 0-10
  emotion: number; // 0-10
  conflict: number; // 0-10
  modifiedCurves?: ('tension' | 'emotion' | 'conflict')[]; // Tracks which curves have active nodes at this point
  isEpisodeAnchor?: boolean; // True if this point represents a fixed episode/structural anchor
}

export interface Author {
  id: number;
  name: string;
  role: string;
  participation: number; // 0-100
  email: string;
}

export interface ProjectState {
  seriesTitle: string;
  authorName: string;
  storyboardStyle: StoryboardStyle;
  aspectRatio: string;

  // Series Bible Data
  logline: string;
  structuralAnalysis: string; // Series Arc
  treatment: string; // Series Overview
  subplots: string;
  soundtrackPrompt: string;
  references: Reference[];
  narrativeArc: ArcPoint[];
  authors: Author[];
  creativeProfiles: CreativeProfile[]; // New field
  activeProfileId?: string; // New field

  // Content
  episodes: Episode[];
  characters: Character[];
}

export interface CreativeProfile {
  id: string;
  name: string;
  role: string;
  personality: string;
  references: string[];
  background: string;
  mood: string;
  imageUrl: string | null;
}

export interface ProjectMeta {
  id: number;
  name: string;
  modified: Date;
}

export interface CustomStyleImage {
  data: string; // base64
  mimeType: string;
}

export interface CustomStyle {
  id?: number;
  name: string;
  images: CustomStyleImage[];
  prompt: string;
}
