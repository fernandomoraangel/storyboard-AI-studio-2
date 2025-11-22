import React, { useState, useCallback, ChangeEvent } from 'react';
import type { Character, StoryboardStyle } from '../types';
import { generateImage, completeCharacterDetails, translateDetailsToEnglish, createCharacterImagePrompt } from '../services/geminiService';
import { WandIcon, TrashIcon, SparklesIcon, ClipboardIcon, UploadIcon } from './icons';
import { LoadingSpinner } from './LoadingSpinner';
import { useLanguage } from '../contexts/languageContext';

interface CharacterCardProps {
  character: Character;
  updateCharacter: (character: Character) => void;
  deleteCharacter: (characterId: number) => void;
  storyboardStyle: StoryboardStyle;
  aspectRatio: string;
}

const InputField: React.FC<{ label: string; value: string; onChange: (e: ChangeEvent<HTMLInputElement>) => void; name: string; }> = ({ label, ...props }) => (
  <div>
    <label className="block text-sm font-medium text-gray-400 mb-1">{label}</label>
    <input
      type="text"
      className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
      {...props}
    />
  </div>
);

const TextAreaField: React.FC<{ label: string; value: string; onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void; name: string; rows?: number; }> = ({ label, rows = 2, ...props }) => (
  <div>
    <label className="block text-sm font-medium text-gray-400 mb-1">{label}</label>
    <textarea
      className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
      rows={rows}
      {...props}
    />
  </div>
);

export const CharacterCard: React.FC<CharacterCardProps> = ({ character, updateCharacter, deleteCharacter, storyboardStyle, aspectRatio }) => {
  const { t, language } = useLanguage();
  const [isCompleting, setIsCompleting] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [imageGenerationError, setImageGenerationError] = useState<string | null>(null);
  const [posePrompt, setPosePrompt] = useState('');
  
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [targetImageAI, setTargetImageAI] = useState('Gemini Flash Image');
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [isPromptCopied, setIsPromptCopied] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    updateCharacter({ ...character, [e.target.name]: e.target.value });
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string;
        if (imageUrl) {
            updateCharacter({ ...character, images: [...character.images, imageUrl] });
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };
  
  const handleDeleteImage = (imageIndex: number) => {
      const updatedImages = character.images.filter((_, index) => index !== imageIndex);
      updateCharacter({ ...character, images: updatedImages });
  };
  
  const handleCompleteWithAI = useCallback(async () => {
    setIsCompleting(true);
    setCompletionError(null);
    try {
        const partialCharacter: Partial<Character> = {
            name: character.name,
            role: character.role,
            personality: character.personality,
            appearance: character.appearance,
            outfit: character.outfit,
            behavior: character.behavior,
        };
        const suggestions = await completeCharacterDetails(partialCharacter, language);
        updateCharacter({ ...character, ...suggestions });
    } catch (error) {
        console.error("Failed to get AI character completion:", error);
        setCompletionError(t('genericCompletionError'));
    } finally {
        setIsCompleting(false);
    }
  }, [character, updateCharacter, language, t]);

  const handleGenerateImage = useCallback(async () => {
    if (!posePrompt.trim()) return;
    setIsGeneratingImage(true);
    setImageGenerationError(null);
    
    const prompt = createCharacterImagePrompt(character, storyboardStyle, aspectRatio, posePrompt);
    
    try {
      const imageUrl = await generateImage(prompt);
      updateCharacter({ ...character, images: [...character.images, imageUrl] });
      setPosePrompt('');
    } catch (error) {
      console.error("Character image generation failed:", error);
      const errorMessage = (error as any)?.error?.message || (error as any)?.message || 'An unknown error occurred.';
      if (errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
          setImageGenerationError(t('quotaError'));
      } else {
          setImageGenerationError(t('genericGenerationError'));
      }
    } finally {
      setIsGeneratingImage(false);
    }
  }, [character, posePrompt, storyboardStyle, aspectRatio, updateCharacter, t]);
  
  const clean = (str: string) => str?.trim() || '';
  const formatPrompt = (prompt: string) => prompt.replace(/, ,/g, ',').replace(/, \./g, '.').replace(/  +/g, ' ').replace(/, \s*--/g, ' --').trim();

  const generatePromptText = async () => {
    setIsGeneratingPrompt(true);
    try {
        let prompt = "";
        
        const characterDetails = {
            name: character.name,
            role: character.role,
            appearance: character.appearance,
            outfit: character.outfit,
            personality: character.personality,
            action: posePrompt || "standing"
        };

        let englishDetails = characterDetails;
        if (language === 'es') {
            englishDetails = await translateDetailsToEnglish(characterDetails) as typeof characterDetails;
        }
        
        const {name, role, action, appearance, outfit, personality} = englishDetails;

        switch (targetImageAI) {
          case 'Gemini Flash Image':
            prompt = `High-quality cinematic portrait of a character named ${name} (${role}). They are ${action}. Appearance: ${appearance}. Outfit: ${outfit}. Personality: ${personality}. The background is neutral. 9:16 aspect ratio.`;
            break;
          case 'Midjourney':
            prompt = `full body portrait of a character named ${name}, ${role}. ${action}. Appearance: ${appearance}. Outfit: ${outfit}. Personality: ${personality}. cinematic, detailed --ar 9:16 --style raw`;
            break;
          case 'Meta AI':
            prompt = `photograph of a person, ${name}, the ${role}, who is ${action}. They look like: ${appearance}. They wear: ${outfit}.`;
            break;
          default: // Generic
            prompt = `character concept art, ${name}, ${role}, ${action}. Appearance details: ${appearance}. Wearing ${outfit}. Personality is ${personality}.`;
            break;
        }
        setGeneratedPrompt(formatPrompt(prompt));
    } catch (error) {
        console.error("Error generating prompt:", error);
    } finally {
        setIsGeneratingPrompt(false);
    }
  };

  const copyPrompt = () => {
    navigator.clipboard.writeText(generatedPrompt);
    setIsPromptCopied(true);
    setTimeout(() => setIsPromptCopied(false), 2000);
  };


  return (
    <div className="bg-gray-800/50 rounded-lg shadow-lg overflow-hidden border border-gray-700 p-6">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-bold text-white flex items-center">
          {t('characterLabel')}: {character.name || t('unnamedCharacter')}
        </h3>
        <button onClick={() => deleteCharacter(character.id)} className="text-red-500 hover:text-red-400 transition-colors">
          <TrashIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label={t('characterName')} name="name" value={character.name} onChange={handleChange} />
            <InputField label={t('characterRole')} name="role" value={character.role} onChange={handleChange} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextAreaField label={t('characterPersonality')} name="personality" value={character.personality} onChange={handleChange} rows={3} />
          <TextAreaField label={t('characterBehavior')} name="behavior" value={character.behavior} onChange={handleChange} rows={3}/>
        </div>
        <TextAreaField label={t('characterAppearance')} name="appearance" value={character.appearance} onChange={handleChange} rows={3}/>
        <TextAreaField label={t('characterOutfit')} name="outfit" value={character.outfit} onChange={handleChange} rows={2}/>

        <div className="pt-2">
            <button onClick={handleCompleteWithAI} disabled={isCompleting} className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-indigo-600 text-indigo-50 hover:bg-indigo-600/90 h-10 px-4 py-2 disabled:opacity-50">
                <WandIcon className="w-4 h-4 mr-2"/>
                {isCompleting ? t('thinking') : t('completeWithAI')}
            </button>
            {completionError && <p className="text-sm text-red-400 mt-2 text-center">{completionError}</p>}
        </div>
      </div>
      
      <div className="mt-6 border-t border-gray-700 pt-6">
        <h4 className="text-base font-semibold text-gray-300 mb-4">{t('characterVisuals')}</h4>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4">
            {character.images.map((img, index) => (
                <div key={index} className="group relative aspect-w-9 aspect-h-16 bg-gray-700 rounded-md overflow-hidden">
                    <img src={img} alt={`${character.name} pose ${index + 1}`} className="w-full h-full object-cover"/>
                     <button 
                        onClick={() => handleDeleteImage(index)}
                        className="absolute top-1 right-1 bg-black/60 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                        aria-label="Delete image"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </div>
            ))}
             {isGeneratingImage && (
                <div className="aspect-w-9 aspect-h-16 bg-gray-700 rounded-md flex flex-col items-center justify-center">
                   <LoadingSpinner />
                   <p className="text-xs mt-2">{t('generating')}</p>
                </div>
            )}
            <div className="aspect-w-9 aspect-h-16">
                <label htmlFor={`character-upload-${character.id}`} className="cursor-pointer w-full h-full flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-600 hover:border-indigo-500 transition-colors text-indigo-400 p-2">
                    <UploadIcon className="w-8 h-8" />
                    <span className="mt-2 text-xs text-center">{t('upload')}</span>
                    <input id={`character-upload-${character.id}`} name="character-upload" type="file" className="sr-only" accept="image/*" onChange={handleImageUpload} />
                </label>
            </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
            <input 
                type="text"
                value={posePrompt}
                onChange={(e) => setPosePrompt(e.target.value)}
                placeholder={t('characterPosePlaceholder')}
                className="flex-1 block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
            />
            <button onClick={handleGenerateImage} disabled={isGeneratingImage || !posePrompt.trim()} className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-transparent hover:bg-gray-700 h-10 px-4 py-2">
                <SparklesIcon className="w-4 h-4 mr-2"/>
                {t('generateImage')}
            </button>
        </div>
        {imageGenerationError && <p className="text-sm text-red-400 mt-2 text-center">{imageGenerationError}</p>}
      </div>

       <div className="mt-6 border-t border-gray-700 pt-6">
            <h4 className="text-base font-semibold text-gray-300 mb-4">{t('promptGenerator')}</h4>
                <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                        <div className="sm:col-span-1">
                           <label className="block text-xs font-medium text-gray-400 mb-1">{t('targetAI')}</label>
                            <select
                                value={targetImageAI}
                                onChange={(e) => setTargetImageAI(e.target.value)}
                                className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 h-9"
                            >
                                <option value="Gemini Flash Image">Gemini Flash Image</option>
                                <option value="Midjourney">Midjourney</option>
                                <option value="Meta AI">Meta AI</option>
                                <option value="Generic">{t('generic')}</option>
                            </select>
                        </div>
                         <button
                            onClick={generatePromptText}
                            disabled={isGeneratingPrompt}
                            className="w-full h-9 sm:col-span-2 inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-transparent hover:bg-gray-700 disabled:opacity-50"
                        >
                            {isGeneratingPrompt ? <LoadingSpinner /> : t('generatePrompt')}
                        </button>
                    </div>
                    {generatedPrompt && (
                        <div className="relative">
                            <textarea readOnly value={generatedPrompt} className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-gray-300 shadow-sm ring-1 ring-inset ring-white/10 sm:text-sm" rows={4}/>
                            <button onClick={copyPrompt} className="absolute top-2 right-2 p-1.5 rounded-md bg-gray-900/50 hover:bg-gray-700 text-blue-400 hover:text-blue-300">
                               <ClipboardIcon className="w-4 h-4" />
                            </button>
                            {isPromptCopied && <span className="absolute top-2 right-10 text-xs text-indigo-400 bg-gray-900 px-2 py-1 rounded">{t('copied')}</span>}
                        </div>
                    )}
                </div>
        </div>

    </div>
  );
};