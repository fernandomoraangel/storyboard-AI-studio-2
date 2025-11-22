import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage, Scene, Character, StoryboardStyle } from '../types';
import { createChat, sendMessage, generateCharacterFromDescription, enrichCharacterFromDescription, generateImage, createImagePromptForShot, createCharacterImagePrompt } from '../services/geminiService';
import { ChatBubbleIcon, CloseIcon, SendIcon } from './icons';
import { LoadingSpinner } from './LoadingSpinner';
import type { Chat, Part, FunctionCall, FunctionResponsePart } from '@google/genai';
import { useLanguage } from '../contexts/languageContext';

interface ChatWidgetProps {
  addScene: (sceneData?: Partial<Scene>) => Scene;
  updateScene: (scene: Scene) => void;
  scenes: Scene[];
  characters: Character[];
  updateCharacter: (character: Character) => void;
  addCharacterFromAI: (characterData: Omit<Character, 'id' | 'images'>) => void;
  addVisualToCharacter: (characterName: string, imageUrl: string) => void;
  storyboardStyle: StoryboardStyle;
  aspectRatio: string;
}

export const ChatWidget: React.FC<ChatWidgetProps> = (props) => {
  const { t, language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([{ sender: 'bot', text: t('chatInitial') }]);
  }, [t]);

  useEffect(() => {
    if (!isOpen) return;
    const init = async () => {
        setIsLoading(true);
        try {
            chatRef.current = await createChat(props.characters, props.scenes, language);
        } catch (error) {
            console.error("Failed to initialize chat:", error);
            setMessages(prev => [...prev, {sender: 'bot', text: t('chatError')}]);
        } finally {
            setIsLoading(false);
        }
    };
    init();
  }, [props.characters, props.scenes, language, t, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleToolCalls = async (calls: FunctionCall[]): Promise<Part[]> => {
    const toolResponses: FunctionResponsePart[] = [];

    const isQuotaError = (e: any): boolean => {
      const message = JSON.stringify(e).toLowerCase();
      return message.includes('quota') || message.includes('resource_exhausted');
    };

    await Promise.all(calls.map(async (call) => {
        try {
            let result;
            switch (call.name) {
                case 'create_scene': {
                    const newScene = props.addScene(call.args as Partial<Scene>);
                    let imageGenerated = false;
                    let imageError = null;
                    try {
                        if (newScene.shots && newScene.shots.length > 0) {
                            const prompt = createImagePromptForShot(newScene.shots[0], newScene, props.characters, props.storyboardStyle, props.aspectRatio);
                            const imageUrl = await generateImage(prompt);
                            const updatedFirstShot = { ...newScene.shots[0], imageUrl };
                            const updatedShots = [updatedFirstShot, ...newScene.shots.slice(1)];
                            const sceneWithImage = { ...newScene, shots: updatedShots };
                            props.updateScene(sceneWithImage);
                            imageGenerated = true;
                        }
                    } catch (e) {
                        console.error("Failed to generate image for new scene from chat:", e);
                        if (isQuotaError(e)) {
                            imageError = 'quota_exceeded';
                        } else {
                            imageError = 'unknown_error';
                        }
                    }
                    result = { success: true, sceneTitle: newScene.title, imageGenerated, imageError };
                    break;
                }
                
                case 'update_scene_details': {
                    const { sceneTitle, ...detailsToUpdate } = call.args as { sceneTitle: string } & Partial<Scene>;
                    const sceneToUpdate = props.scenes.find(s => s.title.toLowerCase() === sceneTitle.toLowerCase());
                    if (!sceneToUpdate) {
                        throw new Error(`Scene with title "${sceneTitle}" not found.`);
                    }
                    // Filter out null/undefined values from the AI
                    const validUpdates = Object.fromEntries(Object.entries(detailsToUpdate).filter(([_, v]) => v != null));
                    
                    const updatedScene = { ...sceneToUpdate, ...validUpdates };
                    props.updateScene(updatedScene);
                    result = { success: true, sceneTitle: sceneToUpdate.title };
                    break;
                }

                case 'create_character':
                    const newCharData = await generateCharacterFromDescription((call.args as any).description as string, language);
                    props.addCharacterFromAI(newCharData);
                    result = { success: true, characterName: newCharData.name };
                    break;
                
                case 'enrich_character_details':
                    const charToEnrich = props.characters.find(c => c.name.toLowerCase() === ((call.args as any).characterName as string).toLowerCase());
                    if (!charToEnrich) throw new Error(`Character "${(call.args as any).characterName}" not found.`);
                    const enrichedChar = await enrichCharacterFromDescription(charToEnrich, (call.args as any).enrichment_details as string, language);
                    props.updateCharacter(enrichedChar);
                    result = { success: true, characterName: enrichedChar.name };
                    break;
                
                case 'generate_character_visual': {
                    const characterName = (call.args as any).characterName as string;
                    const actionDescription = (call.args as any).action_description as string;
                    const charForVisual = props.characters.find(c => c.name.toLowerCase() === characterName.toLowerCase());
                    if (!charForVisual) throw new Error(`Character "${characterName}" not found.`);
                    
                    const prompt = createCharacterImagePrompt(charForVisual, props.storyboardStyle, props.aspectRatio, actionDescription);
                    
                    try {
                        const imageUrl = await generateImage(prompt);
                        props.addVisualToCharacter(characterName, imageUrl);
                        result = { success: true, characterName: charForVisual.name, imageGenerated: true, error: null };
                    } catch (e) {
                        console.error("Failed to generate character visual from chat:", e);
                        if (isQuotaError(e)) {
                           result = { success: true, characterName: charForVisual.name, imageGenerated: false, error: 'quota_exceeded' };
                        } else {
                            throw e;
                        }
                    }
                    break;
                }
                default:
                    throw new Error(`Unknown tool: ${call.name}`);
            }
            toolResponses.push({ functionResponse: { name: call.name, response: result } });

        } catch (e) {
            console.error(`Error executing tool ${call.name}:`, e);
            toolResponses.push({ functionResponse: { name: call.name, response: { error: (e as Error).message } } });
        }
    }));

    return toolResponses;
  };

  const handleSend = async () => {
    const textInput = input.trim();
    if (!textInput || isLoading || !chatRef.current) return;

    const userMessage: ChatMessage = { sender: 'user', text: textInput };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      let response = await sendMessage(chatRef.current, textInput);

      while (response.functionCalls && response.functionCalls.length > 0) {
        const functionResponseParts = await handleToolCalls(response.functionCalls);
        response = await sendMessage(chatRef.current, functionResponseParts);
      }
      
      const botMessage: ChatMessage = { sender: 'bot', text: response.text };
      setMessages(prev => [...prev, botMessage]);

    } catch (error) {
      console.error("Chat send error:", error);
      const errorMessage: ChatMessage = { sender: 'bot', text: t('chatSendError') };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleChat = () => setIsOpen(!isOpen);

  return (
    <>
      <button
        onClick={toggleChat}
        className="fixed bottom-6 right-6 bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 transition-transform transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 z-30"
        aria-label="Toggle Chat"
      >
        {isOpen ? <CloseIcon className="w-6 h-6" /> : <ChatBubbleIcon className="w-6 h-6" />}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 w-full max-w-sm h-[60vh] bg-gray-800/80 backdrop-blur-xl border border-gray-700 rounded-lg shadow-2xl flex flex-col z-30">
          <header className="p-4 border-b border-gray-700">
            <h3 className="font-bold text-white text-lg">{t('storyboardAssistant')}</h3>
          </header>
          <div className="flex-1 p-4 overflow-y-auto space-y-2">
            {messages.map((msg, index) => (
                <div key={index}>
                    <div className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs lg:max-w-sm px-4 py-2 rounded-2xl ${msg.sender === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-gray-700 text-gray-200 rounded-bl-none'}`}>
                            <p className="text-sm break-words whitespace-pre-wrap">{msg.text}</p>
                        </div>
                    </div>
                </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                  <div className="px-4 py-2 rounded-2xl bg-gray-700 text-gray-200 rounded-bl-none">
                      <LoadingSpinner />
                  </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-4 border-t border-gray-700">
            <div className="flex items-center bg-gray-900 rounded-lg">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder={t('chatPlaceholder')}
                className="flex-1 bg-transparent p-3 text-white focus:outline-none"
                disabled={isLoading}
              />
              <button onClick={handleSend} disabled={isLoading || !input.trim()} className="p-3 text-gray-400 hover:text-indigo-400 disabled:text-gray-600">
                <SendIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};