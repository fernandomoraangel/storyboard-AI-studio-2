import { GoogleGenAI, Chat, GenerateContentResponse, Type, FunctionDeclaration, Part, Modality } from "@google/genai";
import { TextGenerationProvider, ImageGenerationProvider, VideoGenerationProvider, AIProviderConfig } from "../types";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const cleanJson = (text: string) => {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
        return text.substring(firstBrace, lastBrace + 1);
    }
    return text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
};

export class GeminiProvider implements TextGenerationProvider, ImageGenerationProvider, VideoGenerationProvider {
    private ai: GoogleGenAI;
    private apiKey: string;
    private textModel: string;
    private mediaModel: string;
    private static lastRequestTime: number = 0;
    private static readonly MIN_REQUEST_INTERVAL = 4500; // 4.5 seconds between requests (safe for 15 RPM)

    constructor(config: AIProviderConfig) {
        this.apiKey = config.apiKey || process.env.API_KEY || '';
        this.ai = new GoogleGenAI({ apiKey: this.apiKey });
        this.textModel = config.textModel || 'gemini-2.0-flash-exp';
        this.mediaModel = config.mediaModel || 'imagen-2';
    }

    private async waitForRateLimit(): Promise<void> {
        const now = Date.now();
        const timeSinceLastRequest = now - GeminiProvider.lastRequestTime;

        if (timeSinceLastRequest < GeminiProvider.MIN_REQUEST_INTERVAL) {
            const waitTime = GeminiProvider.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
            console.log(`[GeminiProvider] Rate limiting: waiting ${waitTime}ms before next request`);
            await sleep(waitTime);
        }

        GeminiProvider.lastRequestTime = Date.now();
    }

    private async generateContentWithRetry(params: any): Promise<GenerateContentResponse> {
        const maxRetries = 3;
        let attempt = 0;

        while (attempt < maxRetries) {
            try {
                await this.waitForRateLimit(); // Wait to respect rate limits
                const response = await this.ai.models.generateContent(params);
                return response;
            } catch (error: any) {
                let errorMessage = '';
                try { errorMessage = (JSON.stringify(error) || '').toLowerCase(); }
                catch (e) { errorMessage = String(error).toLowerCase(); }

                const isQuotaError = errorMessage.includes('429') || errorMessage.includes('resource_exhausted') || errorMessage.includes('quota');

                if (isQuotaError) {
                    console.error("Quota exhausted for text generation.");
                    throw new Error("Quota exceeded. Please check your plan or try again later.");
                }

                const isRetryable = errorMessage.includes('500') || errorMessage.includes('503') || errorMessage.includes('timeout') || errorMessage.includes('rpc failed') || (error.status === 'UNKNOWN');

                if (isRetryable && attempt < maxRetries - 1) {
                    const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
                    console.warn(`Retryable error on attempt ${attempt + 1}. Retrying in ${delay.toFixed(0)}ms...`, error);
                    await sleep(delay);
                    attempt++;
                } else {
                    console.error(`Final attempt failed to generate content. Error:`, error);
                    throw error;
                }
            }
        }
        throw new Error("Content generation failed after multiple retries.");
    }

    async generateContent(prompt: string, systemInstruction?: string, options?: any): Promise<string> {
        const response = await this.generateContentWithRetry({
            model: this.textModel,
            contents: prompt,
            config: { systemInstruction, ...options }
        });
        return response.text || '';
    }

    async generateJSON<T>(prompt: string, schema: any, systemInstruction?: string, options?: any): Promise<T> {
        const response = await this.generateContentWithRetry({
            model: this.textModel,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: schema,
                systemInstruction,
                ...options
            },
        });
        return JSON.parse(cleanJson(response.text?.trim() || '{}'));
    }

    async createChat(systemInstruction: string, tools?: any[]): Promise<any> {
        return this.ai.chats.create({
            model: this.textModel,
            config: {
                systemInstruction: systemInstruction,
                tools: tools ? [{ functionDeclarations: tools }] : undefined,
            },
        });
    }

    async sendMessage(chat: any, message: string | Part[]): Promise<string> {
        const response = await chat.sendMessage({ message });
        return response.text || '';
    }

    async generateImage(prompt: string, aspectRatio: string): Promise<string> {
        await this.waitForRateLimit(); // Wait to respect rate limits

        // Handle Gemini models (multimodal generation) vs Imagen models (image-only generation)
        if (this.mediaModel.toLowerCase().startsWith('gemini')) {
            try {
                const response = await this.ai.models.generateContent({
                    model: this.mediaModel,
                    contents: [
                        {
                            role: 'user',
                            parts: [{ text: `Generate an image of: ${prompt}` }]
                        }
                    ],
                    config: {
                        // responseMimeType: 'image/jpeg' // Not supported by gemini-2.0-flash-exp yet
                    }
                });

                // Check for inline data (base64 image)
                if (response.candidates?.[0]?.content?.parts) {
                    for (const part of response.candidates[0].content.parts) {
                        if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
                            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                        }
                    }
                }

                throw new Error("The Gemini model generated text instead of an image. This model might not support native image generation yet. Please try an 'imagen' model or ComfyUI.");

            } catch (error: any) {
                console.error("Gemini Native Image Generation Error:", error);
                const errorMessage = (JSON.stringify(error) || '').toLowerCase();
                if (errorMessage.includes('location') || errorMessage.includes('region') || errorMessage.includes('not supported')) {
                    throw new Error("Image generation is not supported in your region with this model. Please try ComfyUI (Local).");
                }
                throw error;
            }
        }

        // Default: Use Imagen models
        try {
            const response = await this.ai.models.generateImages({
                model: this.mediaModel,
                prompt: prompt,
                config: { numberOfImages: 1, aspectRatio: aspectRatio as any }
            });

            if (!response.generatedImages || response.generatedImages.length === 0) {
                throw new Error("Image generation failed: No images returned from API.");
            }

            const imageData = response.generatedImages[0];
            if (imageData.image?.imageBytes) {
                return `data:image/png;base64,${imageData.image.imageBytes}`;
            }
            throw new Error("Image generation failed: No image data found.");
        } catch (error: any) {
            const errorMessage = (JSON.stringify(error) || '').toLowerCase();
            const isQuotaError = errorMessage.includes('quota') || errorMessage.includes('resource_exhausted') || (error.code === 429) || (error.status === 'RESOURCE_EXHAUSTED');

            if (isQuotaError) {
                console.warn("Quota exceeded for image generation.");
                throw new Error("Quota exceeded for image generation.");
            }
            if (errorMessage.includes('location') || errorMessage.includes('region') || errorMessage.includes('not supported')) {
                throw new Error("Image generation is not supported in your region with this model. Please try ComfyUI (Local).");
            }
            throw error;
        }
    }

    async generateVideo(prompt: string, image: { base64: string, mimeType: string } | null, aspectRatio: string): Promise<string> {
        await this.waitForRateLimit(); // Wait to respect rate limits

        const config: any = { numberOfVideos: 1, resolution: '720p', aspectRatio: aspectRatio };
        let request: any = {
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            config: config
        };

        if (image) {
            request.image = { imageBytes: image.base64, mimeType: image.mimeType };
        }

        try {
            // @ts-ignore - generateVideos might not be in the type definition yet or requires specific version
            let operation = await this.ai.models.generateVideos(request);

            while (!operation.done) {
                await sleep(10000);
                // @ts-ignore
                operation = await this.ai.operations.getVideosOperation({ operation: operation });
            }

            if (!operation.response?.generatedVideos?.[0]?.video?.uri) {
                throw new Error("Video generation failed: No video URI returned from the API.");
            }

            const downloadLink = operation.response.generatedVideos[0].video.uri;
            const response = await fetch(`${downloadLink}&key=${this.apiKey}`);
            if (!response.ok) throw new Error(`Failed to download video: ${response.statusText}`);
            const videoBlob = await response.blob();

            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(videoBlob);
            });

        } catch (e) {
            console.error("Gemini Video Generation Error:", e);
            throw e;
        }
    }

    async listModels(): Promise<string[]> {
        try {
            const response = await this.ai.models.list();
            const models: string[] = [];
            // @ts-ignore
            for (const model of response) {
                if (model.name) {
                    models.push(`${model.name} (${model.supportedGenerationMethods?.join(', ')})`);
                }
            }
            return models;
        } catch (e: any) {
            console.warn("Failed to list models (likely due to region/permissions). Using default list.", e);
            // Return default models if API fails (e.g. due to location restrictions)
            return [
                "models/gemini-2.0-flash-exp (generateContent, generateImages)",
                "models/gemini-1.5-pro (generateContent)",
                "models/gemini-1.5-flash (generateContent)",
                "models/gemini-1.0-pro (generateContent)",
                "models/imagen-3.0-generate-001 (image, generateImages)",
                "models/imagen-3.0-fast-generate-001 (image, generateImages)",
                "models/imagen-2 (image, generateImages)"
            ];
        }
    }
}
