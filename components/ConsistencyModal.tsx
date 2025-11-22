

import React, { useState } from 'react';
import { useLanguage } from '../contexts/languageContext';
import { WandIcon, CloseIcon } from './icons';
import { LoadingSpinner } from './LoadingSpinner';

export interface ConsistencySettings {
    intensity: number;
    weirdness: number;
    instructions: string;
}

interface ConsistencyModalProps {
    onApply: (settings: ConsistencySettings) => void;
    onClose: () => void;
    isLoading: boolean;
    initialValues?: ConsistencySettings;
}

export const ConsistencyModal: React.FC<ConsistencyModalProps> = ({ onApply, onClose, isLoading, initialValues }) => {
    const { t } = useLanguage();
    const [intensity, setIntensity] = useState(initialValues?.intensity ?? 5);
    const [weirdness, setWeirdness] = useState(initialValues?.weirdness ?? 3);
    const [instructions, setInstructions] = useState(initialValues?.instructions ?? '');

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full border border-yellow-500/50 flex flex-col">
                <div className="flex justify-between items-center p-4 border-b border-gray-700">
                    <div className="flex items-center space-x-2">
                        <WandIcon className="w-5 h-5 text-yellow-400" />
                        <h3 className="text-lg font-bold text-white">{t('consistencyModalTitle')}</h3>
                    </div>
                    {!isLoading && (
                        <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-700">
                            <CloseIcon className="w-5 h-5" />
                        </button>
                    )}
                </div>

                <div className="p-6 space-y-6">
                    {isLoading ? (
                        <div className="text-center py-8">
                            <LoadingSpinner />
                            <p className="mt-4 text-gray-300 animate-pulse">{t('adjustingStory')}</p>
                        </div>
                    ) : (
                        <>
                            <p className="text-sm text-gray-400 mb-4">{t('consistencyModalDescription')}</p>
                            
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <label className="text-sm font-medium text-gray-300">{t('modificationIntensity')}</label>
                                        <span className="text-sm text-yellow-400">{intensity}/10</span>
                                    </div>
                                    <input 
                                        type="range" min="1" max="10" step="1" 
                                        value={intensity} onChange={(e) => setIntensity(parseInt(e.target.value))}
                                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                                    />
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <label className="text-sm font-medium text-gray-300">{t('consistencyWeirdness')}</label>
                                        <span className="text-sm text-purple-400">{weirdness}/10</span>
                                    </div>
                                    <input 
                                        type="range" min="1" max="10" step="1" 
                                        value={weirdness} onChange={(e) => setWeirdness(parseInt(e.target.value))}
                                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                    />
                                </div>
                                 <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('additionalInstructions')}</label>
                                    <textarea
                                        value={instructions}
                                        onChange={(e) => setInstructions(e.target.value)}
                                        rows={3}
                                        placeholder={t('additionalInstructionsPlaceholder')}
                                        className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm"
                                    />
                                </div>
                            </div>

                            <button 
                                onClick={() => onApply({ intensity, weirdness, instructions })}
                                className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium bg-yellow-600 text-white hover:bg-yellow-500 h-10 px-4 py-2 transition-transform transform hover:scale-[1.02]"
                            >
                                <WandIcon className="w-4 h-4 mr-2" />
                                {t('applyAdjustment')}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};