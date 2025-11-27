import { TextGenerationProvider, AIProviderConfig, ImageGenerationProvider, VideoGenerationProvider } from "../types";
import { Part } from "@google/genai"; // Keeping this for type compatibility in signatures

export class OllamaProvider implements TextGenerationProvider, ImageGenerationProvider, VideoGenerationProvider {
    private baseUrl: string;
    private model: string;

    constructor(config: AIProviderConfig) {
        this.baseUrl = (config.baseUrl || 'http://localhost:11434').replace(/\/$/, '');
        this.model = config.model || 'llama3';
    }

    private async fetchOllama(endpoint: string, body: any): Promise<any> {
        try {
            const url = `${this.baseUrl}${endpoint}`;
            console.log(`[OllamaProvider] Requesting: ${url}`, body);
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = `Ollama API error: ${response.statusText} (${response.status}) at ${url}.`;

                if (response.status === 500 && errorText.includes('system memory')) {
                    errorMessage = `Model too large! Your computer doesn't have enough RAM to run this model. Please try a smaller model (e.g., qwen2.5:0.5b or tinyllama). Details: ${errorText}`;
                } else {
                    errorMessage += ` Details: ${errorText}`;
                }

                throw new Error(errorMessage);
            }

            return await response.json();
        } catch (error) {
            console.error("Ollama request failed:", error);
            throw error;
        }
    }

    async generateContent(prompt: string, systemInstruction?: string, options?: any): Promise<string> {
        const response = await this.fetchOllama('/api/generate', {
            model: this.model,
            prompt: prompt,
            system: systemInstruction,
            stream: false,
            ...options
        });
        return response.response;
    }

    async generateJSON<T>(prompt: string, schema: any, systemInstruction?: string, options?: any): Promise<T> {
        // Ollama supports format: 'json'
        const response = await this.fetchOllama('/api/generate', {
            model: this.model,
            prompt: `${prompt}\nRespond with valid JSON matching this schema: ${JSON.stringify(schema)}`,
            system: systemInstruction,
            format: 'json',
            stream: false,
            ...options
        });
        return JSON.parse(response.response);
    }

    async createChat(systemInstruction: string, tools?: any[]): Promise<any> {
        // Ollama chat state needs to be managed manually or via their chat endpoint which takes history.
        // For this abstraction, we'll return a simple object that holds history.
        return {
            history: systemInstruction ? [{ role: 'system', content: systemInstruction }] : [],
            model: this.model,
            tools: tools // Ollama tool support is experimental/varying, we might ignore for basic implementation or try to map.
        };
    }

    async sendMessage(chat: any, message: string | Part[]): Promise<string> {
        const content = typeof message === 'string' ? message : message.map(p => p.text).join('');

        chat.history.push({ role: 'user', content });

        const response = await this.fetchOllama('/api/chat', {
            model: chat.model,
            messages: chat.history,
            stream: false,
        });

        const reply = response.message.content;
        chat.history.push({ role: 'assistant', content: reply });

        return reply;
    }

    // Not implemented for Ollama (unless using LLaVA, but keeping it simple for now or throwing)
    async generateImage(prompt: string, aspectRatio: string): Promise<string> {
        throw new Error("Image generation not supported by this Ollama configuration.");
    }

    async generateVideo(prompt: string, image: { base64: string; mimeType: string; } | null, aspectRatio: string): Promise<string> {
        throw new Error("Video generation not supported by Ollama.");
    }
}
