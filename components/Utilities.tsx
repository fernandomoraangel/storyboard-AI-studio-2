
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/languageContext';
import { ChartBarIcon, RefreshCwIcon, WandIcon } from './icons';
import { LoadingSpinner } from './LoadingSpinner';
import type { Episode, Character, StoryboardStyle } from '../types';
import { createCharacterImagePrompt, createImagePromptForShot, generateImage } from '../services/geminiService';

interface UtilitiesProps {
    episodes: Episode[];
    characters: Character[];
    setEpisodes: React.Dispatch<React.SetStateAction<Episode[]>>;
    setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
    storyboardStyle: StoryboardStyle;
    aspectRatio: string;
}

export const Utilities: React.FC<UtilitiesProps> = ({ 
    episodes, characters, setEpisodes, setCharacters, storyboardStyle, aspectRatio 
}) => {
    const { t } = useLanguage();
    const [tokenCount, setTokenCount] = useState(0);
    const [imageCount, setImageCount] = useState(0);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [regenProgress, setRegenProgress] = useState({ current: 0, total: 0 });
    const [shouldStop, setShouldStop] = useState(false);

    // Constants
    const TOKEN_LIMIT = 1000000; // Gemini 1.5 Flash context window (approx)

    // 1. Calculate Stats
    useEffect(() => {
        const calculateMetrics = () => {
            // Rough estimation: 1 token ~= 4 characters for English text
            const allText = JSON.stringify({ episodes, characters });
            const estimatedTokens = Math.ceil(allText.length / 4);
            setTokenCount(estimatedTokens);

            // Get Daily Image Count from LocalStorage (updated by geminiService)
            const storedDate = localStorage.getItem('dailyImageDate');
            const today = new Date().toISOString().split('T')[0];
            if (storedDate === today) {
                setImageCount(parseInt(localStorage.getItem('dailyImageCount') || '0', 10));
            } else {
                setImageCount(0);
            }
        };

        calculateMetrics();
        // Listen for custom event dispatched by geminiService
        const handleImageGenerated = () => calculateMetrics();
        window.addEventListener('imageGenerated', handleImageGenerated);
        
        return () => window.removeEventListener('imageGenerated', handleImageGenerated);
    }, [episodes, characters]);

    // 2. Regenerate Logic
    const handleRegenerateAll = async () => {
        if (!window.confirm(t('regenerateAllDescription'))) return;
        
        setIsRegenerating(true);
        setShouldStop(false);

        // Collect all jobs
        const jobs: Array<() => Promise<void>> = [];

        // Character Jobs
        characters.forEach(char => {
            jobs.push(async () => {
                const prompt = createCharacterImagePrompt(char, storyboardStyle, aspectRatio);
                try {
                    const imageUrl = await generateImage(prompt);
                    setCharacters(prev => prev.map(c => c.id === char.id ? { ...c, images: [imageUrl, ...c.images] } : c));
                } catch (e) {
                    console.error(`Failed to regen character ${char.name}`, e);
                }
            });
        });

        // Shot Jobs
        episodes.forEach(ep => {
            ep.scenes.forEach(scene => {
                scene.shots.forEach(shot => {
                    jobs.push(async () => {
                        const prompt = createImagePromptForShot(shot, scene, characters, storyboardStyle, aspectRatio);
                        try {
                            const imageUrl = await generateImage(prompt);
                            setEpisodes(prevEps => prevEps.map(e => e.id === ep.id ? {
                                ...e,
                                scenes: e.scenes.map(s => s.id === scene.id ? {
                                    ...s,
                                    shots: s.shots.map(sh => sh.id === shot.id ? { ...sh, imageUrl } : sh)
                                } : s)
                            } : e));
                        } catch (e) {
                            console.error(`Failed to regen shot ${shot.id}`, e);
                        }
                    });
                });
            });
        });

        setRegenProgress({ current: 0, total: jobs.length });

        // Execute sequentially to avoid rate limits, but maybe batch slightly?
        // Let's stick to sequential for safety with `shouldStop` check.
        for (let i = 0; i < jobs.length; i++) {
            if (shouldStop) break;
            await jobs[i]();
            setRegenProgress(prev => ({ ...prev, current: i + 1 }));
            // Small delay to be nice to the API
            await new Promise(resolve => setTimeout(resolve, 500)); 
        }

        setIsRegenerating(false);
        setShouldStop(false);
    };

    const handleStop = () => {
        setShouldStop(true);
        setIsRegenerating(false); // Force UI update immediately
    };

    const contextPercentage = Math.min(100, (tokenCount / TOKEN_LIMIT) * 100).toFixed(1);

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            
            {/* Header */}
            <div className="flex items-center space-x-3 mb-6">
                <ChartBarIcon className="w-8 h-8 text-indigo-400" />
                <div>
                    <h2 className="text-2xl font-bold text-white">{t('utilitiesTitle')}</h2>
                    <p className="text-sm text-gray-400">{t('metricsDescription')}</p>
                </div>
            </div>

            {/* Dashboard Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Token Usage */}
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
                    <h3 className="text-gray-400 font-medium text-sm uppercase tracking-wider mb-2">{t('tokenUsage')}</h3>
                    <div className="flex items-end gap-2">
                        <span className="text-4xl font-bold text-white">{tokenCount.toLocaleString()}</span>
                        <span className="text-sm text-gray-500 mb-1">tokens</span>
                    </div>
                    <div className="mt-4">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>{t('contextWindow')}</span>
                            <span>{contextPercentage}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                            <div 
                                className={`h-2 rounded-full transition-all duration-500 ${parseFloat(contextPercentage) > 90 ? 'bg-red-500' : 'bg-indigo-500'}`} 
                                style={{ width: `${contextPercentage}%` }}
                            ></div>
                        </div>
                    </div>
                </div>

                {/* Image Usage */}
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
                    <h3 className="text-gray-400 font-medium text-sm uppercase tracking-wider mb-2">{t('imagesGeneratedToday')}</h3>
                    <div className="flex items-end gap-2">
                        <span className="text-4xl font-bold text-green-400">{imageCount}</span>
                        <span className="text-sm text-gray-500 mb-1">images</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-4">Resets daily. Tracks local browser usage.</p>
                </div>

                {/* Project Size */}
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
                    <h3 className="text-gray-400 font-medium text-sm uppercase tracking-wider mb-2">{t('projectStats')}</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-gray-300">{t('episodes')}</span>
                            <span className="font-bold text-white">{episodes.length}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-300">{t('scenes')}</span>
                            <span className="font-bold text-white">{episodes.reduce((acc, ep) => acc + ep.scenes.length, 0)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-300">{t('characters')}</span>
                            <span className="font-bold text-white">{characters.length}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions Area */}
            <div className="bg-gray-800/50 p-8 rounded-xl border border-gray-700 mt-8">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <WandIcon className="w-5 h-5 text-indigo-400" />
                    {t('regenerateAllImages')}
                </h3>
                <p className="text-gray-300 mb-6 max-w-2xl">
                    {t('regenerateAllDescription')}
                </p>

                {isRegenerating ? (
                    <div className="space-y-4">
                        <div className="flex justify-between text-sm text-gray-300">
                            <span>{t('regenerationProgress')}</span>
                            <span>{regenProgress.current} / {regenProgress.total}</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-4">
                            <div 
                                className="bg-indigo-600 h-4 rounded-full transition-all duration-300" 
                                style={{ width: `${(regenProgress.current / Math.max(1, regenProgress.total)) * 100}%` }}
                            ></div>
                        </div>
                        <button 
                            onClick={handleStop}
                            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors"
                        >
                            {t('stopRegeneration')}
                        </button>
                    </div>
                ) : (
                    <button 
                        onClick={handleRegenerateAll}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md font-medium transition-colors shadow-lg hover:shadow-indigo-500/30"
                    >
                        <RefreshCwIcon className="w-5 h-5" />
                        {t('startRegeneration')}
                    </button>
                )}
            </div>
        </div>
    );
};
