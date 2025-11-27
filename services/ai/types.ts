import { GenerateContentResponse, Chat, Part } from "@google/genai";
import { Character, Scene, Shot, StoryboardStyle, ArcPoint } from '../../types';
import { Language } from "../../lib/translations";

export interface AIProviderConfig {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
}

export interface TextGenerationProvider {
    generateContent(prompt: string, systemInstruction?: string, options?: any): Promise<string>;
    generateJSON<T>(prompt: string, schema: any, systemInstruction?: string, options?: any): Promise<T>;
    createChat(systemInstruction: string, tools?: any[]): Promise<any>; // Abstracting Chat type might be complex, keeping it generic for now
    sendMessage(chat: any, message: string | Part[]): Promise<string>;
}

export interface ImageGenerationProvider {
    generateImage(prompt: string, aspectRatio: string): Promise<string>; // Returns base64 or URL
}

export interface VideoGenerationProvider {
    generateVideo(prompt: string, image: { base64: string, mimeType: string } | null, aspectRatio: string): Promise<string>; // Returns URL
}

export interface AIProvider {
    text: TextGenerationProvider;
    image: ImageGenerationProvider;
    video: VideoGenerationProvider;
}
