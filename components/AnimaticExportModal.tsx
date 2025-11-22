import React, { useState, useCallback } from 'react';
import type { Scene } from '../types';
import { useLanguage } from '../contexts/languageContext';
import { LoadingSpinner } from './LoadingSpinner';
import { CloseIcon, WandIcon, DownloadIcon } from './icons';
import { generateAnimatic, AnimaticOptions } from '../services/animaticService';

interface AnimaticExportModalProps {
    scenes: Scene[];
    aspectRatio: string;
    storyTitle: string;
    onClose: () => void;
}

export const AnimaticExportModal: React.FC<AnimaticExportModalProps> = ({ scenes, aspectRatio, storyTitle, onClose }) => {
    const { t } = useLanguage();

    // Configuration State
    const [includeSceneTitles, setIncludeSceneTitles] = useState(true);
    const [includeShotDescriptions, setIncludeShotDescriptions] = useState(true);
    const [fontSize, setFontSize] = useState(2); // Percentage of canvas height
    const [fontColor, setFontColor] = useState('#FFFFFF');
    const [backgroundColor, setBackgroundColor] = useState('#111827');
    
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [animaticPreviewUrl, setAnimaticPreviewUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    const handleGeneratePreview = useCallback(async () => {
        const allShots = scenes.flatMap(s => s.shots);
        if (!allShots.some(shot => shot.imageUrl)) {
            setError(t('noImagesError'));
            return;
        }

        setIsPreviewing(true);
        setError(null);
        if (animaticPreviewUrl) {
            URL.revokeObjectURL(animaticPreviewUrl);
            setAnimaticPreviewUrl(null);
        }
        
        try {
            const options: AnimaticOptions = {
                width: 1280,
                t: t,
                includeSceneTitles,
                includeShotDescriptions,
                fontSize,
                fontColor,
                backgroundColor,
                textBackgroundColor: 'rgba(0, 0, 0, 0.7)',
            };
            const videoBlob = await generateAnimatic(scenes, aspectRatio, options);
            setAnimaticPreviewUrl(URL.createObjectURL(videoBlob));
        } catch (err) {
            console.error("Animatic preview failed:", err);
            setError((err as Error).message);
        } finally {
            setIsPreviewing(false);
        }
    }, [scenes, aspectRatio, t, includeSceneTitles, includeShotDescriptions, fontSize, fontColor, backgroundColor, animaticPreviewUrl]);
    
    const renderContent = () => {
        return (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
                {/* Left Column: Options */}
                <div className="space-y-6">
                    <div>
                        <h4 className="font-semibold text-gray-300 mb-3">{t('animaticContent')}</h4>
                        <div className="space-y-2">
                             <label className="flex items-center space-x-2 cursor-pointer">
                                <input type="checkbox" checked={includeSceneTitles} onChange={(e) => setIncludeSceneTitles(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 bg-gray-700" />
                                <span className="text-sm text-gray-300">{t('animaticIncludeSceneTitles')}</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input type="checkbox" checked={includeShotDescriptions} onChange={(e) => setIncludeShotDescriptions(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 bg-gray-700" />
                                <span className="text-sm text-gray-300">{t('animaticIncludeShotDescriptions')}</span>
                            </label>
                        </div>
                    </div>
                     <div>
                        <h4 className="font-semibold text-gray-300 mb-3">{t('animaticStyling')}</h4>
                         <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">{t('animaticFontSize')} ({fontSize}%)</label>
                                <input type="range" min="1" max="5" step="0.1" value={fontSize} onChange={(e) => setFontSize(parseFloat(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                            </div>
                            <div className="flex items-center justify-between">
                                <label className="text-sm text-gray-400">{t('animaticFontColor')}</label>
                                <input type="color" value={fontColor} onChange={(e) => setFontColor(e.target.value)} className="w-10 h-8 p-1 bg-gray-700 border border-gray-600 rounded cursor-pointer" />
                            </div>
                            <div className="flex items-center justify-between">
                                <label className="text-sm text-gray-400">{t('animaticBackgroundColor')}</label>
                                <input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} className="w-10 h-8 p-1 bg-gray-700 border border-gray-600 rounded cursor-pointer" />
                            </div>
                         </div>
                    </div>
                    <button 
                        onClick={handleGeneratePreview} 
                        disabled={isPreviewing}
                        className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium border border-gray-600 hover:bg-gray-700 h-10 px-4 py-2 disabled:opacity-50 text-purple-400 hover:text-purple-300"
                    >
                        {isPreviewing ? <LoadingSpinner/> : <WandIcon className="w-4 h-4"/>}
                        <span className="ml-2">{isPreviewing ? t('previewingAnimatic') : t('previewAnimatic')}</span>
                    </button>
                </div>
                {/* Right Column: Preview */}
                <div className="space-y-4">
                     <div className="aspect-video w-full bg-black rounded-md flex items-center justify-center">
                        {isPreviewing ? (
                             <div className="text-center">
                                <LoadingSpinner />
                                <p className="mt-2 text-sm text-gray-400">{t('previewingAnimatic')}...</p>
                            </div>
                        ) : animaticPreviewUrl ? (
                             <video src={animaticPreviewUrl} controls className="w-full h-full rounded-md" />
                        ) : (
                             <div className="text-gray-500 text-sm p-4 text-center">{t('animaticPreviewPlaceholder')}</div>
                        )}
                     </div>
                     <a
                        href={animaticPreviewUrl ?? '#'}
                        download={animaticPreviewUrl ? `${storyTitle.replace(/ /g, '_')}_animatic.webm` : undefined}
                        className={`w-full inline-flex items-center justify-center rounded-md text-sm font-medium bg-indigo-600 text-indigo-50 hover:bg-indigo-700 h-10 px-4 py-2 ${!animaticPreviewUrl ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={(e) => !animaticPreviewUrl && e.preventDefault()}
                        aria-disabled={!animaticPreviewUrl}
                      >
                         <DownloadIcon className="w-4 h-4 mr-2"/>
                         {t('animaticDownload')}
                      </a>
                </div>
                {error && (
                    <div className="md:col-span-2 text-center p-3 bg-red-900/50 rounded-md">
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}
             </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full border border-gray-700 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-gray-700 flex-shrink-0">
                    <h3 className="text-lg font-semibold">{t('exportAnimatic')}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-700">
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="overflow-y-auto">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};