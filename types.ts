
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
}

export interface Episode {
  id: number;
  title: string;
  synopsis: string;
  scenes: Scene[];
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
  description:string;
  details?: string;
}

export type StoryboardStyle = 'Cinematic' | 'Sketch' | 'ComicBook' | 'Anime' | 'FilmNoir' | 'LineDrawing' | 'QuickLineDrawing' | 'LowPoly' | 'StylizedVideoGame' | 'Solarpunk' | 'Cyberpunk' | 'Sepia' | 'Custom';

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
  
  // Content
  episodes: Episode[];
  characters: Character[];
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