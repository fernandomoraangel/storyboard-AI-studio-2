import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "YOUR_API_KEY_HERE";

if (!apiKey || apiKey === "YOUR_API_KEY_HERE") {
    console.error("No API key found. Please set GEMINI_API_KEY or API_KEY.");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: apiKey });

async function listModels() {
    try {
        console.log("Fetching models...");
        const response = await ai.models.list();
        console.log("Available Models:");
        // @ts-ignore
        for (const model of response) {
            console.log(`- ${model.name} (${model.supportedGenerationMethods?.join(', ')})`);
        }
    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
