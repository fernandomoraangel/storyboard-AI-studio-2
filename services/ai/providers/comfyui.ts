import { ImageGenerationProvider, VideoGenerationProvider, AIProviderConfig, TextGenerationProvider } from "../types";
import { Part } from "@google/genai";

export class ComfyUIProvider implements ImageGenerationProvider, VideoGenerationProvider, TextGenerationProvider {
    private baseUrl: string;

    private model: string;

    constructor(config: AIProviderConfig) {
        this.baseUrl = config.baseUrl || 'http://127.0.0.1:8188';
        this.model = config.comfyuiModel || 'v1-5-pruned-emaonly.ckpt';
    }

    // Placeholder for text generation if needed, or throw
    async generateContent(prompt: string, systemInstruction?: string, options?: any): Promise<string> {
        throw new Error("Text generation not supported by ComfyUI provider.");
    }
    async generateJSON<T>(prompt: string, schema: any, systemInstruction?: string, options?: any): Promise<T> {
        throw new Error("JSON generation not supported by ComfyUI provider.");
    }
    async createChat(systemInstruction: string, tools?: any[]): Promise<any> {
        throw new Error("Chat not supported by ComfyUI provider.");
    }
    async sendMessage(chat: any, message: string | Part[]): Promise<string> {
        throw new Error("Chat not supported by ComfyUI provider.");
    }

    private async queuePrompt(workflow: any): Promise<string> {
        const response = await fetch(`${this.baseUrl}/prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: workflow }),
        });
        if (!response.ok) {
            throw new Error(`ComfyUI Error: ${response.statusText}`);
        }
        const data = await response.json();
        return data.prompt_id;
    }

    private async getHistory(promptId: string): Promise<any> {
        // Poll for history
        const maxRetries = 60; // 1 minute roughly if 1s delay
        for (let i = 0; i < maxRetries; i++) {
            try {
                const response = await fetch(`${this.baseUrl}/history/${promptId}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data[promptId]) {
                        return data[promptId];
                    }
                }
            } catch (e) {
                console.warn("Error polling ComfyUI history:", e);
            }
            await new Promise(r => setTimeout(r, 1000));
        }
        throw new Error("Timeout waiting for ComfyUI generation.");
    }

    private async getImage(filename: string, subfolder: string, type: string): Promise<string> {
        const url = `${this.baseUrl}/view?filename=${filename}&subfolder=${subfolder}&type=${type}`;
        const response = await fetch(url);
        const blob = await response.blob();
        const buffer = await blob.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        return `data:${blob.type};base64,${base64}`;
    }

    async generateImage(prompt: string, aspectRatio: string): Promise<string> {
        // Simplified default workflow for standard ComfyUI
        const workflow = {
            "3": {
                "inputs": {
                    "seed": Math.floor(Math.random() * 1000000000),
                    "steps": 20,
                    "cfg": 8,
                    "sampler_name": "euler",
                    "scheduler": "normal",
                    "denoise": 1,
                    "model": ["4", 0],
                    "positive": ["6", 0],
                    "negative": ["7", 0],
                    "latent_image": ["5", 0]
                },
                "class_type": "KSampler"
            },
            "4": {
                "inputs": { "ckpt_name": this.model },
                "class_type": "CheckpointLoaderSimple"
            },
            "5": {
                "inputs": { "width": 512, "height": 512, "batch_size": 1 },
                "class_type": "EmptyLatentImage"
            },
            "6": {
                "inputs": { "text": prompt, "clip": ["4", 1] },
                "class_type": "CLIPTextEncode"
            },
            "7": {
                "inputs": { "text": "text, watermark", "clip": ["4", 1] },
                "class_type": "CLIPTextEncode"
            },
            "8": {
                "inputs": { "samples": ["3", 0], "vae": ["4", 2] },
                "class_type": "VAEDecode"
            },
            "9": {
                "inputs": { "filename_prefix": "ComfyUI", "images": ["8", 0] },
                "class_type": "SaveImage"
            }
        };

        // Adjust aspect ratio in node 5
        const [w, h] = this.getDimensions(aspectRatio);
        workflow["5"].inputs.width = w;
        workflow["5"].inputs.height = h;

        try {
            const promptId = await this.queuePrompt(workflow);
            const history = await this.getHistory(promptId);
            const outputs = history.outputs;

            // Find the image output (Node 9)
            if (outputs["9"] && outputs["9"].images && outputs["9"].images.length > 0) {
                const imgData = outputs["9"].images[0];
                return await this.getImage(imgData.filename, imgData.subfolder, imgData.type);
            }
            throw new Error("No image output found in ComfyUI history.");
        } catch (e) {
            console.error("ComfyUI Generation Failed:", e);
            throw e;
        }
    }

    async generateVideo(prompt: string, image: { base64: string; mimeType: string; } | null, aspectRatio: string): Promise<string> {
        // Video generation in ComfyUI (e.g. SVD) requires a different workflow.
        // This is highly dependent on installed nodes (e.g. ComfyUI-VideoHelperSuite).
        // For now, I will throw an error asking for configuration or return a placeholder if not configured.
        throw new Error("ComfyUI Video generation requires custom workflow configuration (not yet implemented).");
    }

    async listModels(): Promise<string[]> {
        try {
            const response = await fetch(`${this.baseUrl}/object_info/CheckpointLoaderSimple`);
            if (!response.ok) throw new Error("Failed to fetch ComfyUI models");

            const data = await response.json();
            // The structure is usually data.CheckpointLoaderSimple.input.required.ckpt_name[0] which is an array of strings
            const models = data?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0];

            if (Array.isArray(models)) {
                return models;
            }
            return [];
        } catch (e) {
            console.error("Failed to list ComfyUI models:", e);
            return [];
        }
    }

    private getDimensions(aspectRatio: string): [number, number] {
        switch (aspectRatio) {
            case '16:9': return [896, 512];
            case '9:16': return [512, 896];
            case '1:1': return [512, 512];
            case '4:3': return [680, 512];
            case '3:4': return [512, 680];
            default: return [512, 512];
        }
    }
}
