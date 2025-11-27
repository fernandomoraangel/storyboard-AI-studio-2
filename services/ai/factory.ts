import { TextGenerationProvider, ImageGenerationProvider, VideoGenerationProvider, AIProviderConfig } from "./types";
import { GeminiProvider } from "./providers/gemini";
import { OllamaProvider } from "./providers/ollama";
import { ComfyUIProvider } from "./providers/comfyui";

export class AIProviderFactory {
    private static instance: AIProviderFactory;
    public text: TextGenerationProvider;
    public image: ImageGenerationProvider;
    public video: VideoGenerationProvider;

    private constructor() {
        const config = this.loadConfig();
        this.text = this.createTextProvider(config);
        const mediaProviders = this.createMediaProviders(config);
        this.image = mediaProviders.image;
        this.video = mediaProviders.video;
    }

    public static getInstance(): AIProviderFactory {
        if (!AIProviderFactory.instance) {
            AIProviderFactory.instance = new AIProviderFactory();
        }
        return AIProviderFactory.instance;
    }

    public static resetInstance(): void {
        // @ts-ignore
        AIProviderFactory.instance = undefined;
    }

    private loadConfig(): any {
        if (typeof window !== 'undefined') {
            return {
                textProvider: localStorage.getItem('AI_PROVIDER_TEXT') || process.env.NEXT_PUBLIC_AI_PROVIDER_TEXT || 'gemini',
                mediaProvider: localStorage.getItem('AI_PROVIDER_MEDIA') || process.env.NEXT_PUBLIC_AI_PROVIDER_MEDIA || 'gemini',
                ollamaUrl: localStorage.getItem('OLLAMA_URL') || process.env.NEXT_PUBLIC_OLLAMA_URL || 'http://localhost:11434',
                ollamaModel: localStorage.getItem('OLLAMA_MODEL') || process.env.NEXT_PUBLIC_OLLAMA_MODEL || 'llama3',
                comfyuiUrl: localStorage.getItem('COMFYUI_URL') || process.env.NEXT_PUBLIC_COMFYUI_URL || 'http://127.0.0.1:8188',
                apiKey: localStorage.getItem('GEMINI_API_KEY') || process.env.API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '',
            };
        }
        return {
            textProvider: process.env.NEXT_PUBLIC_AI_PROVIDER_TEXT || 'gemini',
            mediaProvider: process.env.NEXT_PUBLIC_AI_PROVIDER_MEDIA || 'gemini',
            ollamaUrl: process.env.NEXT_PUBLIC_OLLAMA_URL || 'http://localhost:11434',
            ollamaModel: process.env.NEXT_PUBLIC_OLLAMA_MODEL || 'llama3',
            comfyuiUrl: process.env.NEXT_PUBLIC_COMFYUI_URL || 'http://127.0.0.1:8188',
            apiKey: process.env.API_KEY || '',
        };
    }

    private createTextProvider(config: any): TextGenerationProvider {
        if (config.textProvider === 'ollama') {
            return new OllamaProvider({
                baseUrl: config.ollamaUrl,
                model: config.ollamaModel
            });
        }
        return new GeminiProvider({ apiKey: config.apiKey });
    }

    private createMediaProviders(config: any): { image: ImageGenerationProvider, video: VideoGenerationProvider } {
        if (config.mediaProvider === 'comfyui') {
            const comfy = new ComfyUIProvider({ baseUrl: config.comfyuiUrl });
            return { image: comfy, video: comfy };
        }
        const gemini = new GeminiProvider({ apiKey: config.apiKey });
        return { image: gemini, video: gemini };
    }
}
