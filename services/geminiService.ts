
import { GoogleGenAI, Chat, GenerateContentResponse, Type, FunctionDeclaration, Part, FunctionCall, Modality } from "@google/genai";
import type { Character, Scene, Reference, Shot, StoryboardStyle, ArcPoint, ProjectState } from '../types';
import type { Language } from "../lib/translations";
import { translations } from "../lib/translations";
import { ModificationSettings } from "../components/ModificationModal";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const cleanJson = (text: string) => {
    // Aggressive cleaning to find the JSON object boundaries
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
        return text.substring(firstBrace, lastBrace + 1);
    }
    // Fallback cleanup for simple markdown wrapping
    return text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
};

const createQuotaPlaceholderImage = (text: string = "Quota Exceeded"): string => {
    // Creates a simple placeholder image data URL on the client side
    // to prevent the app from breaking when API limits are hit.
    if (typeof document === 'undefined') return '';
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = '#1f2937'; // gray-800
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#6b7280'; // gray-500
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        ctx.font = '24px sans-serif';
        ctx.fillText("Try again later", canvas.width / 2, canvas.height / 2 + 50);
    }
    return canvas.toDataURL('image/jpeg');
};

const incrementDailyImageCount = () => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const storedDate = localStorage.getItem('dailyImageDate');
        let count = parseInt(localStorage.getItem('dailyImageCount') || '0', 10);

        if (storedDate !== today) {
            count = 0;
            localStorage.setItem('dailyImageDate', today);
        }
        localStorage.setItem('dailyImageCount', (count + 1).toString());
        
        // Dispatch a custom event so UI components can react immediately
        window.dispatchEvent(new Event('imageGenerated'));
    } catch (e) {
        console.error("Failed to update image count", e);
    }
};

const generateContentWithRetry = async (params: any): Promise<GenerateContentResponse> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            const response = await ai.models.generateContent(params);
            return response;
        } catch (error: any) {
            let errorMessage = '';
            try { errorMessage = (JSON.stringify(error) || '').toLowerCase(); } 
            catch (e) { errorMessage = String(error).toLowerCase(); }

            // Check for quota/rate limit errors specifically
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
};

// ... (getChatTools, createChat, sendMessage, getCharactersPromptFragment, getStyleSuffix, createCharacterImagePrompt, createImagePromptForShot - SAME AS BEFORE)

export const getChatTools = (language: Language): FunctionDeclaration[] => {
    const options = translations[language].options;
    const t = (key: keyof (typeof translations)['en']) => {
        return translations[language][key] || translations.en[key];
    };

    return [
        {
            name: 'create_scene',
            description: "Creates a new scene for the current episode.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING, description: 'The title of the scene.' },
                    location: { type: Type.STRING, description: 'The script-style location header, like "INT. COFFEE SHOP - DAY".' },
                    description: { type: Type.STRING, description: 'A detailed description of the action in the scene.' },
                    characters: { type: Type.STRING, description: "Comma-separated list of character names in the scene." },
                    setting: { type: Type.STRING, description: 'The location of the scene.' },
                    dialogueType: { type: Type.STRING, description: "Type of audio.", enum: ['dialogue', 'mos'] },
                    dialogue: { type: Type.STRING, description: "Dialogue content." },
                    keyObjects: { type: Type.STRING, description: "Key props." },
                    actions: { type: Type.STRING, description: "Main actions." },
                    tone: { type: Type.STRING, description: "Emotional tone." },
                    notes: { type: Type.STRING, description: "Director's notes." },
                },
                required: ['title', 'location', 'description', 'characters', 'setting', 'dialogueType', 'dialogue', 'keyObjects', 'actions', 'tone', 'notes'],
            },
        },
        {
            name: 'update_scene_details',
            description: "Updates technical details of an existing scene in the current episode.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    sceneTitle: { type: Type.STRING, description: "Exact title of the scene to update." },
                    location: { type: Type.STRING },
                    shotType: { type: Type.STRING, enum: [...options.shotTypeOptions] },
                    cameraMovement: { type: Type.STRING, enum: [...options.cameraMovementOptions] },
                    cameraType: { type: Type.STRING, enum: [...options.cameraTypeOptions] },
                    lensType: { type: Type.STRING, enum: [...options.lensTypeOptions] },
                    lensBlur: { type: Type.STRING, enum: [...options.lensBlurOptions] },
                    lighting: { type: Type.STRING, enum: [...options.lightingOptions] },
                    style: { type: Type.STRING, enum: [...options.styleOptions] },
                    colorGrade: { type: Type.STRING, enum: [...options.colorGradeOptions] },
                    filmGrain: { type: Type.STRING, enum: [...options.filmGrainOptions] },
                    filmStock: { type: Type.STRING, enum: [...options.filmStockOptions] },
                    transitionType: { type: Type.STRING, enum: [...options.transitionTypeOptions] },
                    atmosphere: { type: Type.STRING },
                    technicalNotes: { type: Type.STRING },
                },
                required: ['sceneTitle'],
            },
        },
        {
            name: 'create_character',
            description: 'Generates a complete new character.',
            parameters: {
                type: Type.OBJECT,
                properties: { description: { type: Type.STRING, description: 'Brief user description.' } },
                required: ['description'],
            },
        },
        {
            name: 'enrich_character_details',
            description: "Enriches an existing character's details.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    characterName: { type: Type.STRING },
                    enrichment_details: { type: Type.STRING }
                },
                required: ['characterName', 'enrichment_details'],
            },
        },
        {
            name: 'generate_character_visual',
            description: "Generates a visual image for a character.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    characterName: { type: Type.STRING },
                    action_description: { type: Type.STRING },
                },
                required: ['characterName', 'action_description'],
            },
        },
    ];
};

export const createChat = async (characters: Character[] = [], scenes: Scene[] = [], language: Language): Promise<Chat> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    const langInstruction = language === 'es' ? "Responde en español." : "Respond in English.";

    let characterDescriptions = characters.map(c => `- ${c.name} (${c.role})`).join('\n');
    let sceneDescriptions = scenes.map(s => `- ${s.title}`).join('\n');

    const systemInstruction = `You are a powerful storyboard assistant for a Series production.
- Goal: Help the user create/edit scenes for the *current* episode and manage characters.
- Use 'create_scene' to add scenes to the current episode.
- Use 'update_scene_details' to modify technical details.
- Use 'create_character', 'enrich_character_details', 'generate_character_visual' for character management.
- Respond to general questions with text.
${langInstruction}

Current Project Context:
Characters:
${characterDescriptions || 'No characters.'}
Current Episode Scenes:
${sceneDescriptions || 'No scenes in this episode.'}
`;

    const chatTools = getChatTools(language);

    return ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: systemInstruction,
            tools: [{ functionDeclarations: chatTools }],
        },
    });
};

export const sendMessage = async (chat: Chat, message: string | Part[]): Promise<GenerateContentResponse> => {
    return chat.sendMessage({ message });
};

export const getCharactersPromptFragment = (sceneCharacters: string, allCharacters: Character[]): string => {
    if (!sceneCharacters || sceneCharacters.toLowerCase() === 'none' || allCharacters.length === 0) {
      return '';
    }
    const sceneCharacterNames = sceneCharacters.split(',').map(name => name.trim().toLowerCase());
    const includedCharacters = allCharacters.filter(char => sceneCharacterNames.includes(char.name.toLowerCase()));
    if (includedCharacters.length === 0) return `Characters mentioned: ${sceneCharacters}.`;
    return 'Featured characters: ' + includedCharacters.map(char => `[Character Name: ${char.name}. Appearance: ${char.appearance}. Behavior: ${char.behavior}. Outfit: ${char.outfit}. Personality: ${char.personality}.]`).join(' ');
};

export const getStyleSuffix = (style: StoryboardStyle): string => {
  switch (style) {
    case 'Sketch': return 'in a black and white charcoal sketch style, rough lines, high contrast.';
    case 'ComicBook': return 'in a vibrant comic book art style, with bold ink lines, dynamic paneling, and cel shading.';
    case 'Anime': return 'in a detailed Japanese anime style, cel-shaded, with vibrant colors and expressive characters.';
    case 'FilmNoir': return 'in a black and white film noir style, with high contrast, dramatic deep shadows, and a 1940s aesthetic.';
    case 'LineDrawing': return 'in a clean, black and white line drawing style, minimalist, with fine lines.';
    case 'QuickLineDrawing': return 'in a quick, loose, gestural line drawing style, minimalist, energetic lines.';
    case 'LowPoly': return 'in a low-poly 3D video game style, with visible polygons, flat shading, and a vibrant color palette.';
    case 'StylizedVideoGame': return 'in a stylized video game art style, similar to games like Fortnite or Valorant, with clean shapes and painterly textures.';
    case 'Solarpunk': return 'in a solarpunk aesthetic, featuring lush greenery integrated with futuristic organic architecture, bright and optimistic.';
    case 'Cyberpunk': return 'in a cyberpunk style, with neon-drenched cityscapes, futuristic technology, cybernetic enhancements, and a gritty, dystopian atmosphere.';
    case 'Sepia': return 'in a sepia tone, giving it a vintage, old photograph look, warm brownish monochrome.';
    case 'Custom': return 'in a photorealistic, cinematic style, with dramatic lighting and high detail, but modified by user-provided style references.';
    case 'Cinematic': default: return 'in a photorealistic, cinematic style, with dramatic lighting and high detail.';
  }
};

export const createCharacterImagePrompt = (character: Character, storyboardStyle: StoryboardStyle, aspectRatio: string, actionDescription: string = 'standing in a neutral pose with a neutral background'): string => {
    const styleSuffix = getStyleSuffix(storyboardStyle);
    const prompt = `A cinematic, high-detail, full-body character portrait.
      Character DNA for visual consistency: [Character Name: ${character.name}. Appearance: ${character.appearance}. Behavior: ${character.behavior}. Outfit: ${character.outfit}. Personality: ${character.personality}.].
      Action/Pose: ${actionDescription}.
      Overall visual look: ${styleSuffix}
      The final image must have a ${aspectRatio} aspect ratio.`;
    return prompt.replace(/  +/g, ' ').trim();
};

export const createImagePromptForShot = (shot: Shot, scene: Scene, characters: Character[], storyboardStyle: StoryboardStyle, aspectRatio: string): string => {
    const characterDetails = getCharactersPromptFragment(scene.characters, characters);
    const prompt = `Create a storyboard visual with a ${aspectRatio} aspect ratio.
      Overall visual look: ${getStyleSuffix(storyboardStyle)}
      Scene Setting: ${scene.setting}. 
      ${characterDetails}
      Shot Action: ${shot.description}. 
      Shot Type: ${shot.shotType}.
      Camera: ${shot.cameraMovement} ${shot.cameraType || ''} with a ${shot.lensType || ''} lens.
      Lens Blur / Bokeh: ${shot.lensBlur || 'none'}.
      Atmosphere: ${shot.atmosphere}.
      Lighting: ${shot.lighting}.
      Shot Content Style: ${shot.style}.
      Color Grade: ${shot.colorGrade || 'none'}.
      Film Stock Simulation: ${shot.filmStock || 'none'}.
      Film Grain: ${shot.filmGrain || 'none'}.
      Director's Notes for this shot: ${shot.notes || 'none'}.`;
    return prompt.replace(/  +/g, ' ').trim();
}

export const generateImage = async (prompt: string, aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9' = '16:9'): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    const maxRetries = 3;
    let attempt = 0;
    const finalPrompt = `${prompt} The final image must have a ${aspectRatio} aspect ratio.`;

    while (attempt < maxRetries) {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [{ text: finalPrompt }] },
                config: { responseModalities: [Modality.IMAGE] },
            });

            if (!response.candidates || response.candidates.length === 0 || !response.candidates[0].content?.parts) {
                 throw new Error("Image generation failed: No valid candidates returned from API.");
            }
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    incrementDailyImageCount(); // Track usage
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
            throw new Error("Image generation failed: No image data found in the response parts.");
        } catch (error: any) {
            const errorMessage = (JSON.stringify(error) || '').toLowerCase();
            const isQuotaError = errorMessage.includes('quota') || errorMessage.includes('resource_exhausted') || (error.code === 429) || (error.status === 'RESOURCE_EXHAUSTED');

            if (isQuotaError) {
                // If quota is hit, stop retrying immediately and return a placeholder
                console.warn("Quota exceeded for image generation. Returning placeholder.");
                return createQuotaPlaceholderImage();
            }

            if (attempt < maxRetries - 1) {
                const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
                console.warn(`Error on attempt ${attempt + 1}. Retrying in ${delay.toFixed(0)}ms...`);
                await sleep(delay);
                attempt++;
            } else {
                console.error(`Final attempt failed to generate image. Error:`, error);
                throw error;
            }
        }
    }
    throw new Error("Image generation failed after multiple retries.");
};

export const completeCharacterDetails = async (character: Partial<Character>, language: Language): Promise<Partial<Character>> => {
    const allFields = Object.entries(character).filter(([key]) => key !== 'id' && key !== 'images').map(([key, value]) => `${key}: ${value || 'not defined'}`).join(', ');
    const allFieldNames = ['name', 'role', 'personality', 'appearance', 'outfit', 'behavior'];
    const langInstruction = language === 'es' ? 'en español' : 'in English';
    const prompt = `You are a creative writer. Based on the following character details: ${allFields}. Please creatively enrich and expand upon all of the following fields: ${allFieldNames.join(', ')}. Provide a more detailed and imaginative description for each field ${langInstruction}, even if it already has content. Return a complete JSON object with all fields filled with the enriched content.`;

    const response = await generateContentWithRetry({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING }, role: { type: Type.STRING }, personality: { type: Type.STRING }, appearance: { type: Type.STRING }, outfit: { type: Type.STRING }, behavior: { type: Type.STRING },
                },
                required: allFieldNames,
            },
        },
    });
    return JSON.parse(cleanJson(response.text.trim()));
};

export const generateCharacterFromDescription = async (description: string, language: Language): Promise<Omit<Character, 'id' | 'images'>> => {
    const langInstruction = language === 'es' ? 'en español' : 'in English';
    const prompt = `You are a creative writer. Create a complete character profile based on this simple description: "${description}". Fill out all the details imaginatively ${langInstruction}.`;
    
    const response = await generateContentWithRetry({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING }, role: { type: Type.STRING }, personality: { type: Type.STRING }, appearance: { type: Type.STRING }, outfit: { type: Type.STRING }, behavior: { type: Type.STRING },
                },
                required: ['name', 'role', 'personality', 'appearance', 'outfit', 'behavior'],
            },
        },
    });
    return JSON.parse(cleanJson(response.text.trim()));
};

export const enrichCharacterFromDescription = async (character: Character, enrichmentDetails: string, language: Language): Promise<Character> => {
    const langInstruction = language === 'es' ? 'en español' : 'in English';
    const characterJson = JSON.stringify({ name: character.name, role: character.role, personality: character.personality, appearance: character.appearance, outfit: character.outfit, behavior: character.behavior }, null, 2);
    const prompt = `You are a creative writer. You are given a character's current profile and a user request to enrich it. Current Character Profile: ${characterJson}. User Enrichment Request: "${enrichmentDetails}". Your task is to update the character's profile based on the user's request. Return the complete, updated character profile as a single JSON object. The response must be ${langInstruction}.`;

     const response = await generateContentWithRetry({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING }, role: { type: Type.STRING }, personality: { type: Type.STRING }, appearance: { type: Type.STRING }, outfit: { type: Type.STRING }, behavior: { type: Type.STRING },
                },
                required: ['name', 'role', 'personality', 'appearance', 'outfit', 'behavior'],
            },
        },
    });
    const updatedDetails = JSON.parse(cleanJson(response.text.trim()));
    return { ...character, ...updatedDetails }; 
};

export const updateStoryFromArc = async (
    currentLogline: string,
    currentTreatment: string,
    currentEpisodes: { title: string; synopsis: string }[],
    newArc: ArcPoint[],
    language: Language
): Promise<{ logline: string; treatment: string; episodes: { title: string; synopsis: string }[] }> => {
    const langInstruction = language === 'es' ? 'en español' : 'in English';
    const arcData = JSON.stringify(newArc.map(p => `${p.label}: Tension=${p.tension}, Emotion=${p.emotion}, Conflict=${p.conflict}`));
    const episodesData = JSON.stringify(currentEpisodes);

    const prompt = `
    The user has drastically modified the Narrative Arc (Dramatic Tension, Emotional State, Conflict Level) of the story.
    You must rewrite the Logline, Treatment, and Episode Synopses to match this new pacing and emotional trajectory exactly.
    
    New Narrative Arc Data:
    ${arcData}
    
    Current Logline: ${currentLogline}
    Current Treatment: ${currentTreatment}
    Current Episodes: ${episodesData}
    
    Respond with JSON containing 'logline', 'treatment', and 'episodes' (array of title, synopsis).
    Ensure the response is ${langInstruction}.
    `;

    const response = await generateContentWithRetry({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    logline: { type: Type.STRING },
                    treatment: { type: Type.STRING },
                    episodes: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                title: { type: Type.STRING },
                                synopsis: { type: Type.STRING }
                            },
                            required: ['title', 'synopsis']
                        }
                    }
                },
                required: ['logline', 'treatment', 'episodes']
            }
        }
    });

    return JSON.parse(cleanJson(response.text.trim()));
};

export const generateQuickText = async (prompt: string, language: Language): Promise<string> => {
    const response = await generateContentWithRetry({
        model: 'gemini-2.5-flash',
        contents: prompt
    });
    return response.text || '';
};

export const generateStory = async (
    prompt: string, 
    sceneCount: number, 
    language: Language, 
    narrativeStructure: string, 
    characterCount: number | '',
    maxShotDuration: number,
    subplotCount: number | '',
    episodeCount: number,
    setProgress: (messageKey: string, data?: { [key: string]: string | number }) => void,
    executionPlan?: string[],
    structureSubElements?: string[], // New parameter for user-selected structural elements
    structureCustomInput?: string // New parameter for text inputs like Egri's premise
): Promise<{ title: string; logline: string; soundtrackPrompt: string; treatment: string; structuralAnalysis: string; references: Reference[]; characters: Omit<Character, 'id' | 'images'>[]; episodes: { title: string, synopsis: string, scenes: Omit<Scene, 'id'>[] }[]; subplots: string; narrativeArc: ArcPoint[] }> => {
    const langInstruction = language === 'es' ? 'en español' : 'in English';
    const userPrompt = prompt.trim() === '' ? (language === 'es' ? 'una serie sorprendente y visualmente interesante' : 'a surprising and visually interesting series') : prompt;
    const hasSubplots = typeof subplotCount === 'number' && subplotCount > 0;
    const numCharacters = (typeof characterCount === 'number' && characterCount >= 0) ? characterCount : Math.floor(Math.random() * 3) + 1;
    const structureName = translations[language].options.narrativeStructureOptions[narrativeStructure] || narrativeStructure;
    
    let structureInstruction = `Narrative Structure: ${structureName}.`;
    if (structureSubElements && structureSubElements.length > 0) {
        structureInstruction += ` Specifically incorporate the following structural elements/functions: ${structureSubElements.join(', ')}.`;
    }
    if (structureCustomInput) {
        structureInstruction += ` Specific Structural Directive (e.g. Premise/Theme): "${structureCustomInput}".`;
    }

    let context = {
        coreConcept: { title: 'Untitled', logline: '', treatment: '' },
        refinedOutline: { logline: '', treatment: '', references: [] as Reference[] },
        characters: [] as Omit<Character, 'id' | 'images'>[],
        episodeOutlines: [] as { title: string, synopsis: string }[],
        fullEpisodes: [] as { title: string, synopsis: string, scenes: Omit<Scene, 'id'>[] }[],
        structuralAnalysis: '',
        soundtrackPrompt: '',
        subplots: '',
        narrativeArc: [] as ArcPoint[],
    };

    // Default execution plan
    const plan = executionPlan || ['progressGeneratingCore', 'progressSearchingReferences', 'progressGeneratingArc', 'progressRefiningStory', 'progressCreatingCharacters', 'progressRenamingCharacters', 'progressRefiningCharactersSeger', 'progressAdjustingStoryToCharacters', 'progressOutliningEpisodes', 'progressOutliningScenes', 'progressGeneratingShots', 'progressGeneratingAnalysis'];

    const stepExecutors: { [key: string]: () => Promise<void> } = {
        'progressGeneratingCore': async () => {
            const coreConceptResponse = await generateContentWithRetry({
                model: 'gemini-3-pro-preview',
                contents: `Create a concept for a ${episodeCount > 1 ? 'Series' : 'Story'} based on: "${userPrompt}". ${structureInstruction} Task: Invent a unique title, a compelling one-sentence logline, and a brief treatment (narrative summary) that reflects this structure. Response in ${langInstruction}.`,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, logline: { type: Type.STRING }, treatment: { type: Type.STRING } }, required: ['title', 'logline', 'treatment'] }
                }
            });
            context.coreConcept = JSON.parse(cleanJson(coreConceptResponse.text.trim()));
            context.refinedOutline = { logline: context.coreConcept.logline, treatment: context.coreConcept.treatment, references: [] };
        },
        'progressSearchingReferences': async () => {
            if (!context.coreConcept.logline) return;
            const searchResponse = await generateContentWithRetry({ model: 'gemini-2.5-flash', contents: `Find artistic references for: "${context.coreConcept.logline}".`, config: { tools: [{ googleSearch: {} }] } });
            const searchReferences = (searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []).map((c: any) => ({ title: c.web?.title, uri: c.web?.uri })).filter(ref => ref.title && ref.uri);
            context.refinedOutline.references = searchReferences;
        },
        'progressGeneratingArc': async () => {
             const arcPrompt = `Create a narrative arc analysis for this story: "${context.refinedOutline.logline}".
             I need ${episodeCount} data points (one per episode) representing the trajectory of:
             1. Dramatic Tension (0-10)
             2. Emotional State (0-10, where 0 is despair, 10 is euphoria)
             3. Conflict Level (0-10)
             Return JSON array 'points' where each point has { label: "Episode X", tension: number, emotion: number, conflict: number }.`;
             
             try {
                const arcResponse = await generateContentWithRetry({
                   model: 'gemini-2.5-flash',
                   contents: arcPrompt,
                   config: {
                       responseMimeType: 'application/json',
                       responseSchema: {
                           type: Type.OBJECT,
                           properties: {
                               points: {
                                   type: Type.ARRAY,
                                   items: {
                                       type: Type.OBJECT,
                                       properties: {
                                           label: { type: Type.STRING },
                                           tension: { type: Type.NUMBER },
                                           emotion: { type: Type.NUMBER },
                                           conflict: { type: Type.NUMBER }
                                       },
                                       required: ['label', 'tension', 'emotion', 'conflict']
                                   }
                               }
                           },
                           required: ['points']
                       }
                   }
                });
                const arcData = JSON.parse(cleanJson(arcResponse.text.trim())).points;
                context.narrativeArc = arcData.map((p: any, i: number) => ({ 
                    ...p, 
                    id: i, 
                    x: (i / (Math.max(1, arcData.length - 1))) * 100,
                    modifiedCurves: ['tension', 'emotion', 'conflict'],
                    isEpisodeAnchor: true 
                }));
             } catch (e) {
                 console.warn("Failed to generate narrative arc, skipping this step.", e);
                 context.narrativeArc = [];
             }
        },
        'progressRefiningStory': async () => {
            if (context.refinedOutline.references.length === 0) return;
            const refinedOutlineResponse = await generateContentWithRetry({
                model: 'gemini-3-pro-preview',
                contents: `Refine logline and treatment for "${context.coreConcept.title}" based on references: ${JSON.stringify(context.refinedOutline.references)}. Return JSON in ${langInstruction}.`,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            logline: { type: Type.STRING }, treatment: { type: Type.STRING },
                            enrichedReferences: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, description: { type: Type.STRING }, details: { type: Type.STRING } }, required: ['title', 'description', 'details'] } }
                        },
                        required: ['logline', 'treatment', 'enrichedReferences']
                    }
                }
            });
            const parsedResponse = JSON.parse(cleanJson(refinedOutlineResponse.text.trim()));
            const enrichedData = parsedResponse.enrichedReferences || [];
            context.refinedOutline.references = context.refinedOutline.references.map((ref, index) => ({ uri: ref.uri, title: enrichedData[index]?.title || ref.title, description: enrichedData[index]?.description || '', details: enrichedData[index]?.details || '' }));
            context.refinedOutline.logline = parsedResponse.logline || context.refinedOutline.logline;
            context.refinedOutline.treatment = parsedResponse.treatment || context.refinedOutline.treatment;
        },
        'progressCreatingCharacters': async () => {
            const characterGenResponse = await generateContentWithRetry({
                model: 'gemini-3-pro-preview',
                contents: `Create exactly ${numCharacters} main characters for story "${context.refinedOutline.logline}". JSON response in ${langInstruction}.`,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: { type: Type.OBJECT, properties: { characters: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, role: { type: Type.STRING }, personality: { type: Type.STRING }, appearance: { type: Type.STRING }, outfit: { type: Type.STRING }, behavior: { type: Type.STRING } }, required: ["name", "role", "personality", "appearance", "outfit", "behavior"] } } }, required: ["characters"] }
                }
            });
            context.characters = JSON.parse(cleanJson(characterGenResponse.text.trim())).characters;
        },
        'progressRenamingCharacters': async () => {
            if (context.characters.length === 0) return;
            const characterRenamingResponse = await generateContentWithRetry({
                model: 'gemini-3-pro-preview',
                contents: `Rename characters for story "${context.refinedOutline.logline}" with evocative names. Keep other details same. Characters: ${JSON.stringify(context.characters)}. JSON response in ${langInstruction}.`,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: { type: Type.OBJECT, properties: { characters: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, role: { type: Type.STRING }, personality: { type: Type.STRING }, appearance: { type: Type.STRING }, outfit: { type: Type.STRING }, behavior: { type: Type.STRING }, }, required: ["name", "role", "personality", "appearance", "outfit", "behavior"] } } }, required: ["characters"] }
                }
            });
            context.characters = JSON.parse(cleanJson(characterRenamingResponse.text.trim())).characters;
        },
        'progressRefiningCharactersSeger': async () => {
             if (context.characters.length === 0) return;
            const characterSegerResponse = await generateContentWithRetry({
                model: 'gemini-3-pro-preview',
                contents: `Deepen characters (Seger method) for story: "${context.refinedOutline.logline}". Characters: ${JSON.stringify(context.characters)}. Return JSON in ${langInstruction}.`,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: { type: Type.OBJECT, properties: { characters: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, role: { type: Type.STRING }, personality: { type: Type.STRING }, appearance: { type: Type.STRING }, outfit: { type: Type.STRING }, behavior: { type: Type.STRING }, }, required: ["name", "role", "personality", "appearance", "outfit", "behavior"] } } }, required: ["characters"] }
                }
            });
             context.characters = JSON.parse(cleanJson(characterSegerResponse.text.trim())).characters;
        },
        'progressAdjustingStoryToCharacters': async () => {
             if (context.characters.length === 0) return;
            const storyAdjustmentResponse = await generateContentWithRetry({
                model: 'gemini-3-pro-preview',
                contents: `Adjust story "${context.refinedOutline.logline}" to fit deepened characters: ${JSON.stringify(context.characters)}. Return JSON in ${langInstruction}.`,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: { type: Type.OBJECT, properties: { logline: { type: Type.STRING }, treatment: { type: Type.STRING }, }, required: ["logline", "treatment"] }
                }
            });
            const res = JSON.parse(cleanJson(storyAdjustmentResponse.text.trim()));
            context.refinedOutline.logline = res.logline; context.refinedOutline.treatment = res.treatment;
        },
        'progressOutliningEpisodes': async () => {
            if (episodeCount <= 1) {
                context.episodeOutlines = [{ title: context.coreConcept.title, synopsis: context.refinedOutline.logline }];
                return;
            }
            const episodesResponse = await generateContentWithRetry({
                model: 'gemini-3-pro-preview',
                contents: `Create an outline for a ${episodeCount}-episode series based on: "${context.refinedOutline.logline}" and treatment "${context.refinedOutline.treatment}". ${structureInstruction} Provide a title and synopsis for each episode. Return JSON in ${langInstruction}.`,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: { type: Type.OBJECT, properties: { episodes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, synopsis: { type: Type.STRING } }, required: ["title", "synopsis"] } } }, required: ["episodes"] }
                }
            });
            context.episodeOutlines = JSON.parse(cleanJson(episodesResponse.text.trim())).episodes;
        },
        'progressOutliningScenes': async () => {
            if (!context.episodeOutlines || context.episodeOutlines.length === 0) return;
            context.fullEpisodes = [];
            for (const [index, ep] of context.episodeOutlines.entries()) {
                const promptContent = `Outline exactly ${sceneCount} scenes for Episode ${index + 1}: "${ep.title}" (Synopsis: ${ep.synopsis}). ${structureInstruction} Characters: ${context.characters.map(c => c.name).join(', ')}. Return JSON in ${langInstruction}.`;
                const schemaConfig = {
                    responseMimeType: 'application/json',
                    responseSchema: { type: Type.OBJECT, properties: { scenes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, location: { type: Type.STRING }, characters: { type: Type.STRING }, setting: { type: Type.STRING }, dialogueType: { type: Type.STRING, enum: ['dialogue', 'mos'] }, dialogue: { type: Type.STRING }, musicPrompt: { type: Type.STRING }, keyObjects: { type: Type.STRING }, actions: { type: Type.STRING }, tone: { type: Type.STRING }, notes: { type: Type.STRING } }, required: ["title", "location", "characters", "setting", "dialogueType", "dialogue", "musicPrompt", "keyObjects", "actions", "tone", "notes"] } } }, required: ["scenes"] }
                };
                try {
                    const sceneOutlinesResponse = await generateContentWithRetry({
                        model: 'gemini-3-pro-preview',
                        contents: promptContent,
                        config: schemaConfig
                    });
                    const scenes = JSON.parse(cleanJson(sceneOutlinesResponse.text.trim())).scenes;
                    context.fullEpisodes.push({ ...ep, scenes });
                } catch (e) {
                    console.warn(`Pro model failed for outlining scenes in Ep ${index + 1}, trying fallback...`, e);
                    try {
                        const sceneOutlinesResponse = await generateContentWithRetry({
                            model: 'gemini-2.5-flash',
                            contents: promptContent,
                            config: schemaConfig
                        });
                        const scenes = JSON.parse(cleanJson(sceneOutlinesResponse.text.trim())).scenes;
                        context.fullEpisodes.push({ ...ep, scenes });
                    } catch (fallbackError) {
                         console.error(`Failed to outline scenes for episode ${index + 1} with fallback`, fallbackError);
                         throw new Error(`Failed to generate scenes for Episode ${index + 1}. Please try again.`);
                    }
                }
            }
        },
        'progressGeneratingShots': async () => {
            if (!context.fullEpisodes || context.fullEpisodes.length === 0) return;
            const options = translations[language]?.options || translations['en'].options;
            const defaultShot = { shotType: 'Wide Shot (WS)', cameraMovement: 'Static', cameraType: 'Digital Cinema Camera', lensType: 'Standard (35mm-50mm)', lensBlur: 'None (Deep Focus)', lighting: 'Natural Light', style: 'Cinematic / Hollywood', colorGrade: 'Neutral / Natural', filmGrain: 'Clean (No Grain)', filmStock: 'Digital (None)', };

            for (const ep of context.fullEpisodes) {
                const enrichedScenes: Omit<Scene, 'id'>[] = [];
                for (const outline of ep.scenes) {
                    setProgress('progressGeneratingShotsFor', { title: outline.title });
                    try {
                        const shotsResponse = await generateContentWithRetry({
                            model: 'gemini-2.5-flash', 
                            contents: `Create 2-4 detailed shots for scene "${outline.title}": "${outline.actions}". Return JSON in ${langInstruction}.`,
                            config: {
                                responseMimeType: 'application/json',
                                responseSchema: { type: Type.OBJECT, properties: { shots: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { description: { type: Type.STRING }, duration: { type: Type.NUMBER }, soundFx: { type: Type.STRING }, notes: { type: Type.STRING }, shotType: { type: Type.STRING, enum: [...options.shotTypeOptions] }, cameraMovement: { type: Type.STRING, enum: [...options.cameraMovementOptions] }, cameraType: { type: Type.STRING, enum: [...options.cameraTypeOptions] }, lensType: { type: Type.STRING, enum: [...options.lensTypeOptions] }, lensBlur: { type: Type.STRING, enum: [...options.lensBlurOptions] }, lighting: { type: Type.STRING, enum: [...options.lightingOptions] }, style: { type: Type.STRING, enum: [...options.styleOptions] }, atmosphere: { type: Type.STRING }, colorGrade: { type: Type.STRING, enum: [...options.colorGradeOptions] }, filmStock: { type: Type.STRING, enum: [...options.filmStockOptions] }, filmGrain: { type: Type.STRING, enum: [...options.filmGrainOptions] }, technicalNotes: { type: Type.STRING } }, required: ["description", "duration", "soundFx", "notes", "shotType", "cameraMovement", "cameraType", "lensType", "lensBlur", "lighting", "style", "atmosphere", "colorGrade", "filmStock", "filmGrain", "technicalNotes"] } } }, required: ["shots"] }
                            }
                        });
                        const parsed = JSON.parse(cleanJson(shotsResponse.text.trim()));
                        if (parsed.shots) {
                            enrichedScenes.push({ ...outline, shots: parsed.shots.map((shot: any) => ({ ...shot, id: Date.now() + Math.random(), imageUrl: null, videoUrl: null })), transitionType: options.transitionTypeOptions[0] });
                        } else {
                             throw new Error("No shots returned");
                        }
                    } catch (e) {
                        console.error(`Failed to generate shots for "${outline.title}":`, e);
                        const errorMsg = language === 'es' ? 'La generación falló. Por favor edite manualmente.' : 'Generation failed. Please edit manually.';
                        enrichedScenes.push({ ...outline, shots: [{ id: Date.now(), description: errorMsg, duration: 5, imageUrl: null, videoUrl: null, soundFx: '', notes: '', technicalNotes: 'N/A', atmosphere: 'N/A', ...defaultShot }], transitionType: options.transitionTypeOptions[0] });
                    }
                    await sleep(200);
                }
                ep.scenes = enrichedScenes;
            }
        },
        'progressGeneratingAnalysis': async () => {
             if (!context.refinedOutline.logline) return;
            const finalAnalysisResponse = await generateContentWithRetry({
                model: 'gemini-3-pro-preview',
                contents: `Analyze story structure for "${context.refinedOutline.logline}". ${structureInstruction} Create soundtrack prompt and subplots. Return JSON in ${langInstruction}.`,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: { type: Type.OBJECT, properties: { structuralAnalysis: { type: Type.STRING }, soundtrackPrompt: { type: Type.STRING }, subplots: { type: Type.STRING } }, required: ["structuralAnalysis", "soundtrackPrompt", ...(hasSubplots ? ["subplots"] : [])] }
                }
            });
            const analysisResult = JSON.parse(cleanJson(finalAnalysisResponse.text.trim()));
            context.structuralAnalysis = analysisResult.structuralAnalysis;
            context.soundtrackPrompt = analysisResult.soundtrackPrompt;
            context.subplots = analysisResult.subplots || '';
        }
    };

    for (const stepKey of plan) {
        if (stepExecutors[stepKey]) {
            setProgress(stepKey);
            try { 
                await stepExecutors[stepKey](); 
            } catch (e) { 
                console.error(`Error during step ${stepKey}:`, e); 
                const criticalSteps = ['progressGeneratingCore', 'progressCreatingCharacters', 'progressOutliningEpisodes', 'progressOutliningScenes'];
                if (criticalSteps.includes(stepKey)) {
                     throw e;
                }
            }
        }
    }

    const finalEpisodes = context.fullEpisodes.map((ep) => {
         const finalScenes = ep.scenes.map(s => {
             if (!s.shots || s.shots.length === 0) {
                const defaultShot = { shotType: 'Wide Shot (WS)', cameraMovement: 'Static', cameraType: 'Digital Cinema Camera', lensType: 'Standard (35mm-50mm)', lensBlur: 'None (Deep Focus)', lighting: 'Natural Light', style: 'Cinematic / Hollywood', colorGrade: 'Neutral / Natural', filmGrain: 'Clean (No Grain)', filmStock: 'Digital (None)', technicalNotes: 'Default', atmosphere: 'Default' };
                return { ...s, shots: [{ id: Date.now(), description: 'Scene without shots.', duration: 5, imageUrl: null, videoUrl: null, soundFx: '', notes: '', ...defaultShot }], transitionType: translations[language].options.transitionTypeOptions[0] };
            }
            return s;
        });
        return { ...ep, scenes: finalScenes };
    });

    return {
        title: context.coreConcept.title,
        logline: context.refinedOutline.logline,
        soundtrackPrompt: context.soundtrackPrompt,
        treatment: context.refinedOutline.treatment,
        structuralAnalysis: context.structuralAnalysis,
        references: context.refinedOutline.references,
        characters: context.characters,
        episodes: finalEpisodes,
        subplots: context.subplots,
        narrativeArc: context.narrativeArc,
    };
};

export const generateVideo = async (prompt: string, image: { base64: string, mimeType: string } | null, aspectRatio: '16:9' | '9:16', setProgress: (messageKey: string) => void): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    setProgress('loadingGeneratingVideo');
    
    const config: any = { numberOfVideos: 1, resolution: '720p', aspectRatio: aspectRatio };
    let request: any = {
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        config: config
    };

    if (image) {
        request.image = { imageBytes: image.base64, mimeType: image.mimeType };
    }

    let operation = await ai.models.generateVideos(request);
    setProgress('loadingPollingStatus');
    while (!operation.done) { await new Promise(resolve => setTimeout(resolve, 10000)); operation = await ai.operations.getVideosOperation({ operation: operation }); }
    if (!operation.response?.generatedVideos?.[0]?.video?.uri) { throw new Error("Video generation failed: No video URI returned from the API."); }
    const downloadLink = operation.response.generatedVideos[0].video.uri;
    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY!}`);
    if (!response.ok) throw new Error(`Failed to download video: ${response.statusText}`);
    const videoBlob = await response.blob();
    return URL.createObjectURL(videoBlob);
};

export const generateSynopsis = async (title: string, characters: Character[], scenes: Scene[], language: Language): Promise<string> => {
    const characterSummary = characters.map(c => `${c.name} (${c.role})`).join(', ');
    const sceneDescriptions = scenes.map((s, i) => `Scene ${i+1} (${s.title}): ${s.shots.map(shot => shot.description).join(' ')}`).join('\n');
    const langInstruction = language === 'es' ? 'en español' : 'in English';
    const prompt = `Write a brief 50-70 word synopsis for "${title}" based on these scenes: ${sceneDescriptions}. Characters: ${characterSummary}. ${langInstruction}.`;
    const response = await generateContentWithRetry({ model: 'gemini-2.5-flash', contents: prompt, });
    return response.text.trim();
};

export const translateDetailsToEnglish = async (details: { [key: string]: string }): Promise<{ [key: string]: string }> => {
    const detailsToTranslate: { [key: string]: string } = {};
    for (const key in details) { if (details[key] && details[key].trim() !== '') { detailsToTranslate[key] = details[key]; } }
    if (Object.keys(detailsToTranslate).length === 0) return details; 
    const prompt = `Translate JSON values into English. Input: ${JSON.stringify(detailsToTranslate)}. Output JSON:`;
    try {
        const response = await generateContentWithRetry({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json', responseSchema: { type: Type.OBJECT, properties: Object.fromEntries(Object.keys(detailsToTranslate).map(k => [k, { type: Type.STRING }])), required: Object.keys(detailsToTranslate) } } });
        return { ...details, ...JSON.parse(cleanJson(response.text.trim())) };
    } catch (e) { return details; }
};

export const ensureStoryConsistency = async (currentState: ProjectState, language: Language, settings?: { intensity: number; weirdness: number; instructions: string }): Promise<{ state: ProjectState; explanation: string }> => {
    const langInstruction = language === 'es' ? 'en español' : 'in English';
    const instructions = settings?.instructions || 'Fix continuity errors caused by reordering.';
    
    // Minimize payload: Send simplified episode/scene structure
    const simplifiedEpisodes = currentState.episodes.map(ep => ({
        id: ep.id,
        title: ep.title,
        scenes: ep.scenes.map(s => ({
            id: s.id,
            title: s.title,
            actions: s.actions,
            dialogue: s.dialogue,
            characters: s.characters,
            location: s.location,
            notes: s.notes
        }))
    }));

    const prompt = `
    The user has completely reordered the scenes and episodes of this story. 
    Task: Analyze the new flow for logical continuity errors (e.g. characters appearing before they are introduced, dead characters appearing alive, plot points happening out of order).
    
    User Instructions: ${instructions}
    Intensity: ${settings?.intensity || 5}/10.
    
    Rewrite the 'actions', 'dialogue', and 'notes' of the scenes to fix these errors and ensure a coherent narrative flow in this new order.
    DO NOT change the order of scenes or episodes. DO NOT change IDs.
    
    Input Story Structure:
    ${JSON.stringify(simplifiedEpisodes)}
    
    Return JSON with:
    1. 'explanation': A brief summary of what was fixed.
    2. 'episodes': The updated array of episodes with the same structure as input (id, title, scenes: [{id, title, actions, dialogue, characters, location, notes}]).
    
    Response must be ${langInstruction}.
    `;

    const response = await generateContentWithRetry({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    explanation: { type: Type.STRING },
                    episodes: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.NUMBER },
                                title: { type: Type.STRING },
                                scenes: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            id: { type: Type.NUMBER },
                                            title: { type: Type.STRING },
                                            actions: { type: Type.STRING },
                                            dialogue: { type: Type.STRING },
                                            characters: { type: Type.STRING },
                                            location: { type: Type.STRING },
                                            notes: { type: Type.STRING }
                                        },
                                        required: ['id', 'title', 'actions', 'dialogue', 'characters', 'location', 'notes']
                                    }
                                }
                            },
                            required: ['id', 'title', 'scenes']
                        }
                    }
                },
                required: ['explanation', 'episodes']
            }
        }
    });

    const result = JSON.parse(cleanJson(response.text.trim()));
    
    // Merge updates back into full state (preserving shots)
    const updatedEpisodes = currentState.episodes.map(originalEp => {
        const updatedEpData = result.episodes.find((e: any) => e.id === originalEp.id);
        if (!updatedEpData) return originalEp;

        const updatedScenes = originalEp.scenes.map(originalScene => {
            const updatedSceneData = updatedEpData.scenes.find((s: any) => s.id === originalScene.id);
            if (!updatedSceneData) return originalScene;
            return { ...originalScene, ...updatedSceneData };
        });

        return { ...originalEp, scenes: updatedScenes };
    });

    return { 
        state: { ...currentState, episodes: updatedEpisodes }, 
        explanation: result.explanation 
    };
};

export const modifyStory = async (currentState: ProjectState, settings: ModificationSettings, language: Language): Promise<{ state: ProjectState; explanation: string }> => {
    const langInstruction = language === 'es' ? 'en español' : 'in English';
    
    // 1. Construct Context & Instructions
    const scopeList = Object.entries(settings.scope)
        .filter(([k, v]) => v)
        .map(([k]) => k)
        .join(', ');

    const prompt = `
    You are a creative story editor and co-writer. The user wants to MODIFY their story.
    
    CURRENT STORY STATE:
    Title: ${currentState.seriesTitle}
    Logline: ${currentState.logline}
    Treatment: ${currentState.treatment}
    Characters: ${JSON.stringify(currentState.characters.map(c => ({ name: c.name, role: c.role, personality: c.personality })))}
    Episodes: ${JSON.stringify(currentState.episodes.map(e => ({ title: e.title, synopsis: e.synopsis })))}
    
    MODIFICATION SETTINGS:
    - User Instructions: "${settings.instructions}"
    - Intensity: ${settings.intensity}/10 (10 = drastic changes)
    - Weirdness: ${settings.weirdness}/10 (10 = surreal/avant-garde)
    - Scope of Change: ${settings.aiDecides ? "You decide what needs changing to fulfill the request." : "Strictly modify ONLY: " + scopeList}
    ${settings.newStructure ? `- Re-structure the story to: ${settings.newStructure}` : ''}
    ${settings.segerSettings ? `- Apply Linda Seger Refinements: ${Object.keys(settings.segerSettings).filter(k => (settings.segerSettings as any)[k]).join(', ')}` : ''}
    
    TASK:
    Rewrite the story components (Logline, Treatment, Characters, Episode Outline) based on the instructions.
    Maintain consistency across modified elements.
    
    OUTPUT FORMAT (JSON):
    {
        "explanation": "A brief summary of what was changed and why.",
        "seriesTitle": "Updated Title (if changed)",
        "logline": "Updated Logline",
        "treatment": "Updated Treatment",
        "characters": [ { "name": "...", "role": "...", "personality": "...", "appearance": "...", "outfit": "...", "behavior": "..." } ], 
        "episodes": [ { "title": "...", "synopsis": "..." } ]
    }
    
    Return ONLY the JSON object. The response must be in ${langInstruction}.
    `;

    const response = await generateContentWithRetry({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    explanation: { type: Type.STRING },
                    seriesTitle: { type: Type.STRING },
                    logline: { type: Type.STRING },
                    treatment: { type: Type.STRING },
                    characters: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING },
                                role: { type: Type.STRING },
                                personality: { type: Type.STRING },
                                appearance: { type: Type.STRING },
                                outfit: { type: Type.STRING },
                                behavior: { type: Type.STRING }
                            }
                        }
                    },
                    episodes: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                title: { type: Type.STRING },
                                synopsis: { type: Type.STRING }
                            }
                        }
                    }
                },
                required: ['explanation', 'logline', 'treatment']
            }
        }
    });

    const result = JSON.parse(cleanJson(response.text.trim()));
    const newState = { ...currentState };

    // Apply changes
    if (result.seriesTitle) newState.seriesTitle = result.seriesTitle;
    if (result.logline) newState.logline = result.logline;
    if (result.treatment) newState.treatment = result.treatment;

    if (result.characters && Array.isArray(result.characters)) {
        // Smart Merge: Try to match characters by name to preserve IDs and Images
        newState.characters = result.characters.map((newC: any, i: number) => {
            const existing = currentState.characters.find(c => c.name.toLowerCase() === newC.name.toLowerCase());
            return {
                id: existing ? existing.id : Date.now() + i,
                images: existing ? existing.images : [],
                name: newC.name,
                role: newC.role,
                personality: newC.personality,
                appearance: newC.appearance,
                outfit: newC.outfit,
                behavior: newC.behavior
            };
        });
    }

    if (result.episodes && Array.isArray(result.episodes)) {
        // Smart Merge: Update episodes metadata
        if (result.episodes.length === currentState.episodes.length) {
            // If count matches, update content but keep scene structure (assuming structure didn't change drastically)
            newState.episodes = currentState.episodes.map((ep, i) => ({
                ...ep,
                title: result.episodes[i].title,
                synopsis: result.episodes[i].synopsis
            }));
        } else {
            // If count changes, we have to rebuild. 
            // We keep existing scenes where possible to avoid data loss, but misalignment is possible.
            newState.episodes = result.episodes.map((newEp: any, i: number) => {
                const existing = currentState.episodes[i];
                return {
                    id: existing ? existing.id : Date.now() + i,
                    title: newEp.title,
                    synopsis: newEp.synopsis,
                    scenes: existing ? existing.scenes : [] // Attach existing scenes or start empty
                };
            });
            result.explanation += ` (Note: The number of episodes changed from ${currentState.episodes.length} to ${result.episodes.length}. Scenes may need manual adjustment.)`;
        }
    }

    return { state: newState, explanation: result.explanation };
};
