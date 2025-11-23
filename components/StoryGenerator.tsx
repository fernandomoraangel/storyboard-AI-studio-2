






import React, { useState, useRef, useEffect } from 'react';
import type { Scene, Character, Reference, ArcPoint, Episode } from '../types';
import { generateStory, generateQuickText } from '../services/geminiService';
import { WandIcon, GripVerticalIcon } from './icons';
import { useLanguage } from '../contexts/languageContext';
import { StoryGenerationProgress } from './StoryGenerationProgress';
import { LoadingSpinner } from './LoadingSpinner';

type EpisodePreview = {
    title: string;
    synopsis: string;
    scenes: Omit<Scene, 'id'>[];
}

type StoryPreview = {
  title: string;
  logline: string;
  soundtrackPrompt: string;
  treatment: string;
  structuralAnalysis: string;
  references: Reference[];
  characters: Omit<Character, 'id' | 'images'>[];
  episodes: EpisodePreview[];
  subplots: string;
  narrativeArc: ArcPoint[];
};

interface GenerationStepConfig {
    key: string;
    label: string;
    enabled: boolean;
}

interface StoryGeneratorProps {
    onStoryGenerated: (story: StoryPreview) => Promise<void>;
    aspectRatio: string;
}

export const StoryGenerator: React.FC<StoryGeneratorProps> = ({ onStoryGenerated, aspectRatio }) => {
    const { t, language, options } = useLanguage();
    const [prompt, setPrompt] = useState('');
    const [sceneCount, setSceneCount] = useState<number | ''>(3);
    const [episodeCount, setEpisodeCount] = useState<number | ''>(1);
    const [characterCount, setCharacterCount] = useState<number | ''>('');
    const [maxShotDuration, setMaxShotDuration] = useState<number | ''>(8);
    const [subplotCount, setSubplotCount] = useState<number | ''>('');
    const [narrativeStructure, setNarrativeStructure] = useState('');
    const [selectedSubElements, setSelectedSubElements] = useState<string[]>([]);
    const [structureCustomInput, setStructureCustomInput] = useState('');
    const [isGeneratingPremise, setIsGeneratingPremise] = useState(false);
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [preview, setPreview] = useState<StoryPreview | null>(null);
    
    const [showProgressModal, setShowProgressModal] = useState(false);
    const [showConfigModal, setShowConfigModal] = useState(false);
    
    // Default Steps
    const defaultSteps: GenerationStepConfig[] = [
        { key: 'progressGeneratingCore', label: 'generatingCore', enabled: true },
        { key: 'progressSearchingReferences', label: 'searchingReferences', enabled: true },
        { key: 'progressGeneratingArc', label: 'generatingArc', enabled: true },
        { key: 'progressRefiningStory', label: 'refiningStory', enabled: true },
        { key: 'progressCreatingCharacters', label: 'creatingCharacters', enabled: true },
        { key: 'progressRenamingCharacters', label: 'renamingCharacters', enabled: true },
        { key: 'progressRefiningCharactersSeger', label: 'refiningCharactersSeger', enabled: true },
        { key: 'progressAdjustingStoryToCharacters', label: 'adjustingStoryToCharacters', enabled: true },
        { key: 'progressOutliningEpisodes', label: 'outliningEpisodes', enabled: true },
        { key: 'progressOutliningScenes', label: 'outliningScenes', enabled: true },
        { key: 'progressGeneratingShots', label: 'generatingShots', enabled: true },
        { key: 'progressGeneratingAnalysis', label: 'generatingAnalysis', enabled: true },
    ];
    
    const [configSteps, setConfigSteps] = useState<GenerationStepConfig[]>(defaultSteps);
    const [currentProgressKey, setCurrentProgressKey] = useState('');
    const [modalTitle, setModalTitle] = useState('');

    const handleNarrativeStructureChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setNarrativeStructure(e.target.value);
        setSelectedSubElements([]); // Reset sub elements when structure changes
        setStructureCustomInput(''); // Reset custom input
    };

    const toggleSubElement = (element: string) => {
        setSelectedSubElements(prev => {
            if (prev.includes(element)) {
                return prev.filter(e => e !== element);
            } else {
                return [...prev, element];
            }
        });
    };

    const handleSuggestPremise = async () => {
        setIsGeneratingPremise(true);
        setError(null);
        try {
            let promptText = '';
            if (prompt.trim()) {
                promptText = `Create a Lajos Egri style premise (Character + Conflict = Conclusion) based on this story idea: "${prompt}". Keep it concise, one sentence. Response in ${language === 'es' ? 'Spanish' : 'English'}.`;
            } else {
                promptText = `Create a random, compelling Lajos Egri style premise (Character + Conflict = Conclusion) for a new story. Keep it concise, one sentence. Response in ${language === 'es' ? 'Spanish' : 'English'}.`;
            }
            
            const premise = await generateQuickText(promptText, language);
            setStructureCustomInput(premise);
        } catch (e) {
            console.error("Failed to generate premise", e);
            setError(t('storyGenerationError', { message: (e as Error).message }));
        } finally {
            setIsGeneratingPremise(false);
        }
    };

    const handleSceneCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (val === '') {
            setSceneCount('');
        } else {
            const num = parseInt(val, 10);
            if (!isNaN(num)) {
                setSceneCount(num);
            }
        }
    };
    
    const handleSceneCountBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        let num = parseInt(e.target.value, 10);
        if (isNaN(num) || num < 1) {
            setSceneCount(1);
        } else if (num > 25) {
            setSceneCount(25);
        }
    };

    const handleEpisodeCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (val === '') {
            setEpisodeCount('');
        } else {
            const num = parseInt(val, 10);
            if (!isNaN(num)) {
                setEpisodeCount(num);
            }
        }
    };

    const handleEpisodeCountBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        let num = parseInt(e.target.value, 10);
        if (isNaN(num) || num < 1) {
            setEpisodeCount(1);
        } else if (num > 20) {
            setEpisodeCount(20);
        }
    };

    const handleCharacterCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (val === '') {
            setCharacterCount('');
        } else {
            const num = parseInt(val, 10);
            if (!isNaN(num)) {
                setCharacterCount(num);
            }
        }
    };
    
    const handleCharacterCountBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        if (e.target.value === '') return;
        let num = parseInt(e.target.value, 10);
        if (isNaN(num) || num < 0) {
            setCharacterCount(0);
        } else if (num > 10) { 
            setCharacterCount(10);
        }
    };

    const handleMaxShotDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (val === '') {
            setMaxShotDuration('');
        } else {
            const num = parseInt(val, 10);
            if (!isNaN(num)) {
                setMaxShotDuration(num);
            }
        }
    };
    
    const handleMaxShotDurationBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (val === '') {
            return;
        }
        let num = parseInt(val, 10);
        if (isNaN(num) || num < 3) {
            setMaxShotDuration(3);
        } else if (num > 30) {
            setMaxShotDuration(30);
        }
    };

    const handleSubplotCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (val === '') {
            setSubplotCount('');
        } else {
            const num = parseInt(val, 10);
            if (!isNaN(num)) {
                setSubplotCount(num);
            }
        }
    };

    const handleSubplotCountBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        if (e.target.value === '') return;
        let num = parseInt(e.target.value, 10);
        if (isNaN(num) || num < 0) {
            setSubplotCount('');
        } else if (num > 5) {
            setSubplotCount(5);
        }
    };

    // Validate inputs before opening the config modal
    const handlePreGenerate = () => {
        setError(null);
        
        const requirements: { [key: string]: { scenes: number, characters: number } } = {
            threeAct: { scenes: 3, characters: 1 },
            herosJourney: { scenes: 5, characters: 2 },
            sevenPoint: { scenes: 7, characters: 1 },
            fichteanCurve: { scenes: 3, characters: 1 },
            kishotenketsu: { scenes: 4, characters: 1 },
            inMediasRes: { scenes: 2, characters: 1 },
            proppsFunctions: { scenes: 4, characters: 2 },
            greimasActantial: { scenes: 2, characters: 3 },
            balloPerezArguments: { scenes: 2, characters: 1 },
            egriPremise: { scenes: 3, characters: 1 },
            mckeeValues: { scenes: 2, characters: 1 },
            campbellArchetypes: { scenes: 3, characters: 2 },
        };

        const currentReq = requirements[narrativeStructure];
        const finalSceneCount = typeof sceneCount === 'number' && sceneCount > 0 ? sceneCount : 1;
        const finalCharacterCount = typeof characterCount === 'number' && characterCount >= 0 ? characterCount : Infinity;

        if (currentReq) {
            const needsMoreScenes = finalSceneCount < currentReq.scenes;
            const needsMoreChars = finalCharacterCount < currentReq.characters;
            const structureName = options.narrativeStructureOptions[narrativeStructure] || narrativeStructure;

            if (needsMoreScenes && needsMoreChars) {
                setError(t('validationErrorScenesAndCharacters', { structure: structureName, scenes: currentReq.scenes, characters: currentReq.characters }));
                return;
            }
            if (needsMoreScenes) {
                setError(t('validationErrorScenes', { structure: structureName, count: currentReq.scenes }));
                return;
            }
            if (needsMoreChars) {
                setError(t('validationErrorCharacters', { structure: structureName, count: currentReq.characters }));
                return;
            }
        }
        
        setShowConfigModal(true);
    }

    const startGeneration = async () => {
        setShowConfigModal(false);
        setPreview(null);
        setIsLoading(true);
        setModalTitle(t('generatingStory'));

        const finalEpisodeCount = typeof episodeCount === 'number' && episodeCount > 0 ? episodeCount : 1;

        // Filter steps that are enabled
        const activeSteps = configSteps.filter(s => s.enabled);
        
        // CRITICAL: Force essential steps to ensure the Gemini service receives expected data.
        // Without 'progressGeneratingCore', 'progressOutliningEpisodes', and 'progressOutliningScenes',
        // the data structure is incomplete and the process fails.
        const mandatorySteps = ['progressGeneratingCore', 'progressOutliningEpisodes', 'progressOutliningScenes'];
        const finalPlan: string[] = [];
        
        // Reconstruct plan preserving order, ensuring mandatory steps are present
        for (const step of defaultSteps) {
            if (activeSteps.find(s => s.key === step.key) || mandatorySteps.includes(step.key)) {
                finalPlan.push(step.key);
            }
        }

        setCurrentProgressKey('');
        setShowProgressModal(true);
        
        const setProgress = (messageKey: string, data?: { [key: string]: string | number }) => {
            setCurrentProgressKey(messageKey);
        };
        
        const finalSceneCount = typeof sceneCount === 'number' && sceneCount > 0 ? sceneCount : 1;
        const finalCharacterCount = typeof characterCount === 'number' && characterCount >= 0 ? characterCount : '';
        const finalMaxDuration = typeof maxShotDuration === 'number' && maxShotDuration > 0 ? maxShotDuration : 8;
        const finalSubplotCount = typeof subplotCount === 'number' && subplotCount > 0 ? subplotCount : '';

        try {
            const result = await generateStory(
                prompt, 
                finalSceneCount, 
                language, 
                narrativeStructure, 
                finalCharacterCount, 
                finalMaxDuration, 
                finalSubplotCount,
                finalEpisodeCount,
                setProgress,
                finalPlan,
                selectedSubElements, // Pass selected sub-elements (arrays)
                structureCustomInput // Pass custom input (string) for Egri/others
            );
            setPreview(result);
            setShowProgressModal(false);
        } catch (err) {
            const e = err as Error;
            console.error('Story generation failed:', e);
            setError(e.message);
            // Do not close progress modal on error so user can see the message
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleApprove = async () => {
        if (!preview) return;
        setIsLoading(true);
        setError(null);
       
        try {
            await onStoryGenerated(preview);
            setPreview(null);
        } catch(e) {
            console.error('Approval and creation failed:', e);
            setError((e as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDiscard = () => {
        setPreview(null);
        setError(null);
    };

    const handleCloseModal = () => {
        setShowProgressModal(false);
        setError(null);
        setIsLoading(false);
    };

    // Drag and Drop Handlers for Config Modal
    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);

    const handleDragStart = (e: React.DragEvent, position: number) => {
        dragItem.current = position;
    };

    const handleDragEnter = (e: React.DragEvent, position: number) => {
        dragOverItem.current = position;
    };

    const handleDragEnd = (e: React.DragEvent) => {
        const copyListItems = [...configSteps];
        if (dragItem.current !== null && dragOverItem.current !== null) {
            const dragItemContent = copyListItems[dragItem.current];
            copyListItems.splice(dragItem.current, 1);
            copyListItems.splice(dragOverItem.current, 0, dragItemContent);
            dragItem.current = null;
            dragOverItem.current = null;
            setConfigSteps(copyListItems);
        }
    };

    const toggleStep = (index: number) => {
        const newSteps = [...configSteps];
        newSteps[index].enabled = !newSteps[index].enabled;
        setConfigSteps(newSteps);
    }

    // Check if current structure has sub-options
    const currentSubOptions = options.structureSubOptions && options.structureSubOptions[narrativeStructure] 
        ? options.structureSubOptions[narrativeStructure] 
        : null;

    // Get description for the current structure
    const currentStructureDescription = (options.narrativeStructureDescriptions && narrativeStructure) 
        ? options.narrativeStructureDescriptions[narrativeStructure] 
        : null;

    return (
        <div className="space-y-6">
            {showConfigModal && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full border border-gray-700 flex flex-col max-h-[90vh]">
                        <h3 className="text-lg font-semibold mb-2 text-white">{t('configureGenerationTitle')}</h3>
                        <p className="text-sm text-gray-400 mb-4">{t('configureGenerationDesc')}</p>
                        
                        <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-2">
                            {configSteps.map((step, index) => (
                                <div 
                                    key={step.key}
                                    className="flex items-center gap-3 bg-gray-700/50 p-3 rounded border border-gray-600 select-none"
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragEnter={(e) => handleDragEnter(e, index)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => e.preventDefault()}
                                >
                                    <div className="cursor-grab text-gray-500 hover:text-gray-300">
                                        <GripVerticalIcon className="w-5 h-5" />
                                    </div>
                                    <input 
                                        type="checkbox" 
                                        checked={step.enabled} 
                                        onChange={() => toggleStep(index)}
                                        className="w-4 h-4 rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className={`flex-1 text-sm ${step.enabled ? 'text-white' : 'text-gray-500'}`}>
                                        {t(step.key as any).replace('...', '')}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-3 justify-end border-t border-gray-700 pt-4">
                            <button 
                                onClick={() => setShowConfigModal(false)}
                                className="px-4 py-2 text-sm rounded-md bg-gray-700 hover:bg-gray-600 text-white"
                            >
                                {t('cancel')}
                            </button>
                            <button 
                                onClick={startGeneration}
                                className="px-4 py-2 text-sm rounded-md bg-indigo-600 hover:bg-indigo-500 text-white"
                            >
                                {t('startGeneration')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showProgressModal && (
                <StoryGenerationProgress
                    title={modalTitle}
                    steps={configSteps.filter(s => s.enabled).map(s => ({ key: s.key, label: t(s.key as any) }))}
                    currentStepKey={currentProgressKey}
                    error={error}
                    onClose={handleCloseModal}
                />
            )}

            {!preview && (
                <>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="story-prompt" className="block text-sm font-medium text-gray-400 mb-1">
                                {t('storyIdea')}
                            </label>
                            <textarea
                                id="story-prompt"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                rows={3}
                                className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                                placeholder={t('storyIdeaPlaceholder')}
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label htmlFor="episode-count" className="block text-sm font-medium text-gray-400 mb-1">
                                    {t('numberOfEpisodes')}
                                </label>
                                <input
                                    id="episode-count"
                                    type="number"
                                    value={episodeCount}
                                    onChange={handleEpisodeCountChange}
                                    onBlur={handleEpisodeCountBlur}
                                    min="1"
                                    max="20"
                                    className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 h-10 text-center"
                                />
                            </div>
                            <div>
                                <label htmlFor="scene-count" className="block text-sm font-medium text-gray-400 mb-1">
                                    {t('numberOfScenesPerEpisode')}
                                </label>
                                <input
                                    id="scene-count"
                                    type="number"
                                    value={sceneCount}
                                    onChange={handleSceneCountChange}
                                    onBlur={handleSceneCountBlur}
                                    min="1"
                                    max="25"
                                    className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 h-10 text-center"
                                />
                            </div>
                            <div>
                                <label htmlFor="character-count" className="block text-sm font-medium text-gray-400 mb-1">
                                    {t('numberOfCharacters')}
                                </label>
                                <input
                                    id="character-count"
                                    type="number"
                                    value={characterCount}
                                    onChange={handleCharacterCountChange}
                                    onBlur={handleCharacterCountBlur}
                                    min="0"
                                    max="10"
                                    placeholder={t('characterCountPlaceholder')}
                                    className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 h-10 text-center"
                                />
                            </div>
                             <div>
                                <label htmlFor="max-shot-duration" className="block text-sm font-medium text-gray-400 mb-1">
                                    {t('maxShotDuration')}
                                </label>
                                <input
                                    id="max-shot-duration"
                                    type="number"
                                    value={maxShotDuration}
                                    onChange={handleMaxShotDurationChange}
                                    onBlur={handleMaxShotDurationBlur}
                                    min="3"
                                    max="30"
                                    className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 h-10 text-center"
                                />
                            </div>
                             <div>
                                <label htmlFor="subplot-count" className="block text-sm font-medium text-gray-400 mb-1">
                                    {t('numberOfSubplots')}
                                </label>
                                <input
                                    id="subplot-count"
                                    type="number"
                                    value={subplotCount}
                                    onChange={handleSubplotCountChange}
                                    onBlur={handleSubplotCountBlur}
                                    min="0"
                                    max="5"
                                    placeholder={t('subplotCountPlaceholder')}
                                    className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 h-10 text-center"
                                />
                            </div>
                            <div>
                                <label htmlFor="narrative-structure" className="block text-sm font-medium text-gray-400 mb-1">
                                    {t('narrativeStructure')}
                                </label>
                                <select
                                    id="narrative-structure"
                                    value={narrativeStructure}
                                    onChange={handleNarrativeStructureChange}
                                    className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 h-10"
                                >
                                    {Object.entries(options.narrativeStructureOptions).map(([value, label]) => (
                                        <option 
                                            key={value} 
                                            value={value} 
                                            title={options.narrativeStructureDescriptions?.[value] || ''}
                                        >
                                            {label as string}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        
                        {/* Narrative Structure Description */}
                        {currentStructureDescription && (
                            <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-md p-3 mt-2 animate-fade-in">
                                <p className="text-sm text-indigo-200 italic">
                                    <span className="font-bold not-italic mr-1">ℹ️</span>
                                    {currentStructureDescription}
                                </p>
                            </div>
                        )}
                        
                        {/* Specific UI for Lajos Egri Premise */}
                        {narrativeStructure === 'egriPremise' && (
                            <div className="bg-gray-800/30 border border-gray-700 rounded-md p-4 mt-4 animate-fade-in">
                                <label htmlFor="egri-premise" className="block text-sm font-medium text-indigo-300 mb-2">
                                    {t('egriPremiseLabel')}
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        id="egri-premise"
                                        type="text"
                                        value={structureCustomInput}
                                        onChange={(e) => setStructureCustomInput(e.target.value)}
                                        placeholder={t('egriPremisePlaceholder')}
                                        className="flex-1 block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                                    />
                                    <button 
                                        onClick={handleSuggestPremise}
                                        disabled={isGeneratingPremise}
                                        className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50"
                                        title={prompt ? t('suggestPremise') : "Generate random premise"}
                                    >
                                        {isGeneratingPremise ? <LoadingSpinner /> : <WandIcon className="w-4 h-4 mr-1" />}
                                        {t('suggestPremise')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Sub-options UI (Checkboxes for lists) */}
                        {currentSubOptions && (
                            <div className="bg-gray-800/30 border border-gray-700 rounded-md p-4 mt-4 animate-fade-in">
                                <label className="block text-sm font-medium text-indigo-300 mb-3">
                                    {t('structureElements')} ({selectedSubElements.length} selected):
                                </label>
                                <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto">
                                    {currentSubOptions.map((option) => (
                                        <button
                                            key={option}
                                            onClick={() => toggleSubElement(option)}
                                            className={`px-3 py-1.5 text-xs rounded-full border transition-colors text-left ${
                                                selectedSubElements.includes(option)
                                                    ? 'bg-indigo-600 border-indigo-500 text-white'
                                                    : 'bg-gray-700/50 border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500'
                                            }`}
                                        >
                                            {option}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={handlePreGenerate}
                        disabled={isLoading}
                        className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-indigo-600 text-indigo-50 hover:bg-indigo-600/90 h-10 px-4 py-2 disabled:opacity-50"
                    >
                        <WandIcon className="w-4 h-4 mr-2" />
                        {isLoading ? t('generatingStory') : t('generateStoryIdea')}
                    </button>
                    {error && !isLoading && (
                        <div className="mt-4 text-sm text-red-400 bg-red-900/50 p-3 rounded-md text-center">
                            {error}
                        </div>
                    )}
                </>
            )}

            {preview && (
                <div className="space-y-6 pt-6 border-t border-gray-700 animate-fade-in">
                    <h3 className="text-xl font-bold">{t('storyPreview')}: {preview.title}</h3>

                     <div className="space-y-4">
                        <h4 className="font-semibold text-lg text-indigo-300">{t('logline')}</h4>
                        <p className="text-gray-300 italic bg-gray-700/50 p-3 rounded-md">{preview.logline}</p>
                        
                        <h4 className="font-semibold text-lg text-indigo-300">{t('soundtrackPrompt')}</h4>
                        <p className="text-gray-300 italic bg-gray-700/50 p-3 rounded-md">{preview.soundtrackPrompt}</p>

                        <h4 className="font-semibold text-lg text-indigo-300">{t('structuralAnalysis')}</h4>
                        <p className="text-gray-300 whitespace-pre-wrap bg-gray-700/50 p-3 rounded-md">{preview.structuralAnalysis}</p>
                        
                        {preview.subplots && (
                            <>
                                <h4 className="font-semibold text-lg text-indigo-300">{t('subplots')}</h4>
                                <p className="text-gray-300 whitespace-pre-wrap bg-gray-700/50 p-3 rounded-md">{preview.subplots}</p>
                            </>
                        )}

                        <h4 className="font-semibold text-lg text-indigo-300">{t('treatment')}</h4>
                        <p className="text-gray-300 whitespace-pre-wrap bg-gray-700/50 p-3 rounded-md">{preview.treatment}</p>

                        <h4 className="font-semibold text-lg text-indigo-300">{t('references')}</h4>
                        <div className="space-y-2">
                          {preview.references.map((ref, index) => (
                              <div key={index} className="bg-gray-700/50 p-3 rounded-md">
                                  <a href={ref.uri} target="_blank" rel="noopener noreferrer" className="text-indigo-400 font-bold hover:underline">{ref.title}</a>
                                  {ref.details && <p className="text-xs text-gray-400 italic mt-1">{ref.details}</p>}
                                  <p className="text-sm text-gray-300 mt-1">{ref.description}</p>
                              </div>
                          ))}
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <h4 className="font-semibold text-lg text-indigo-300">{t('characters')}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {preview.characters.map((char, index) => (
                            <div key={index} className="bg-gray-700/50 p-4 rounded-md">
                                <p className="font-bold">{char.name} <span className="text-sm font-normal text-gray-400">({char.role})</span></p>
                                <p className="text-sm text-gray-300">{char.appearance}</p>
                            </div>
                        ))}
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <h4 className="font-semibold text-lg text-indigo-300">{t('episodes')}</h4>
                        {preview.episodes.map((ep, index) => (
                            <div key={index} className="bg-gray-700/50 p-4 rounded-md">
                                <p className="font-bold">{t('episode')} {index + 1}: {ep.title}</p>
                                <p className="text-sm text-gray-400 italic mt-1">{ep.synopsis}</p>
                                {ep.scenes && ep.scenes.length > 0 && (
                                    <div className="mt-3 pt-2 border-t border-gray-600">
                                        <p className="text-xs text-indigo-300 font-semibold mb-1">{t('scenes')} (Preview):</p>
                                        <ul className="list-disc list-inside pl-2 text-xs text-gray-400 space-y-1">
                                            {ep.scenes.slice(0, 3).map((shot, shotIndex) => (
                                                <li key={shotIndex}>{shot.title}</li>
                                            ))}
                                            {ep.scenes.length > 3 && <li>... {t('moreScenes', { count: ep.scenes.length - 3 })}</li>}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button onClick={handleApprove} disabled={isLoading} className="flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium bg-green-600 text-white hover:bg-green-700 h-10 px-4 py-2 disabled:opacity-50">
                           {isLoading ? t('generatingStory') : t('approveAndCreate')}
                        </button>
                         <button onClick={handleDiscard} className="flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium bg-gray-600 hover:bg-gray-500 h-10 px-4 py-2">
                           {t('discard')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};