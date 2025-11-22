import React, { useState } from 'react';
import { useLanguage } from '../contexts/languageContext';
import { WandIcon, CloseIcon } from './icons';
import { LoadingSpinner } from './LoadingSpinner';

export interface ModificationSettings {
    intensity: number;
    weirdness: number;
    scope: {
        characters: boolean;
        scenes: boolean;
        shots: boolean;
        treatment: boolean;
        subplots: boolean;
        structure: boolean;
    };
    segerSettings?: {
        spine: boolean;
        paradox: boolean;
        personaShadow: boolean;
        relationships: boolean;
        backstory: boolean;
    };
    newStructure?: string;
    aiDecides: boolean;
    instructions: string;
}

interface ModificationModalProps {
    onApply: (settings: ModificationSettings) => void;
    onClose: () => void;
    isLoading: boolean;
    initialValues?: ModificationSettings;
}

export const ModificationModal: React.FC<ModificationModalProps> = ({ onApply, onClose, isLoading, initialValues }) => {
    const { t, options } = useLanguage();
    const [intensity, setIntensity] = useState(initialValues?.intensity ?? 5);
    const [weirdness, setWeirdness] = useState(initialValues?.weirdness ?? 3);
    const [aiDecides, setAiDecides] = useState(initialValues?.aiDecides ?? false);
    const [scope, setScope] = useState(initialValues?.scope ?? {
        characters: false,
        scenes: true,
        shots: false,
        treatment: false,
        subplots: false,
        structure: false,
    });
    const [segerSettings, setSegerSettings] = useState(initialValues?.segerSettings ?? {
        spine: false,
        paradox: false,
        personaShadow: false,
        relationships: false,
        backstory: false,
    });
    const [newStructure, setNewStructure] = useState(initialValues?.newStructure ?? '');
    const [instructions, setInstructions] = useState(initialValues?.instructions ?? '');

    const handleScopeChange = (key: keyof typeof scope) => {
        setScope(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSegerChange = (key: keyof typeof segerSettings) => {
        setSegerSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleApply = () => {
        onApply({
            intensity,
            weirdness,
            scope,
            segerSettings: scope.characters ? segerSettings : undefined,
            newStructure: scope.structure ? newStructure : undefined,
            aiDecides,
            instructions,
        });
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-gray-800 rounded-lg shadow-xl max-w-lg w-full border border-indigo-500/50 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b border-gray-700">
                    <div className="flex items-center space-x-2">
                        <WandIcon className="w-5 h-5 text-indigo-400" />
                        <h3 className="text-lg font-bold text-white">{t('modificationModalTitle')}</h3>
                    </div>
                    {!isLoading && (
                        <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-700">
                            <CloseIcon className="w-5 h-5" />
                        </button>
                    )}
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    {isLoading ? (
                        <div className="text-center py-12">
                            <LoadingSpinner />
                            <p className="mt-4 text-gray-300 animate-pulse">{t('modifyingStory')}</p>
                        </div>
                    ) : (
                        <>
                            {/* Sliders */}
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <label className="text-sm font-medium text-gray-300">{t('modificationIntensity')}</label>
                                        <span className="text-sm text-indigo-400">{intensity}/10</span>
                                    </div>
                                    <input 
                                        type="range" min="1" max="10" step="1" 
                                        value={intensity} onChange={(e) => setIntensity(parseInt(e.target.value))}
                                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                    />
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <label className="text-sm font-medium text-gray-300">{t('modificationWeirdness')}</label>
                                        <span className="text-sm text-purple-400">{weirdness}/10</span>
                                    </div>
                                    <input 
                                        type="range" min="1" max="10" step="1" 
                                        value={weirdness} onChange={(e) => setWeirdness(parseInt(e.target.value))}
                                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                    />
                                </div>
                            </div>

                            {/* Scope Selection */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-semibold text-gray-300">{t('modificationScope')}</h4>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={aiDecides} 
                                            onChange={(e) => setAiDecides(e.target.checked)}
                                            className="rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-sm text-indigo-300 font-medium">{t('scopeAIDecides')}</span>
                                    </label>
                                </div>

                                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 ${aiDecides ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <label className="flex items-center space-x-2 cursor-pointer p-2 bg-gray-700/30 rounded hover:bg-gray-700/50">
                                        <input type="checkbox" checked={scope.characters} onChange={() => handleScopeChange('characters')} className="rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500" />
                                        <span className="text-sm text-gray-300">{t('scopeCharacters')}</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer p-2 bg-gray-700/30 rounded hover:bg-gray-700/50">
                                        <input type="checkbox" checked={scope.scenes} onChange={() => handleScopeChange('scenes')} className="rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500" />
                                        <span className="text-sm text-gray-300">{t('scopeScenes')}</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer p-2 bg-gray-700/30 rounded hover:bg-gray-700/50">
                                        <input type="checkbox" checked={scope.shots} onChange={() => handleScopeChange('shots')} className="rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500" />
                                        <span className="text-sm text-gray-300">{t('scopeShots')}</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer p-2 bg-gray-700/30 rounded hover:bg-gray-700/50">
                                        <input type="checkbox" checked={scope.treatment} onChange={() => handleScopeChange('treatment')} className="rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500" />
                                        <span className="text-sm text-gray-300">{t('scopeTreatment')}</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer p-2 bg-gray-700/30 rounded hover:bg-gray-700/50">
                                        <input type="checkbox" checked={scope.subplots} onChange={() => handleScopeChange('subplots')} className="rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500" />
                                        <span className="text-sm text-gray-300">{t('scopeSubplots')}</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer p-2 bg-gray-700/30 rounded hover:bg-gray-700/50">
                                        <input type="checkbox" checked={scope.structure} onChange={() => handleScopeChange('structure')} className="rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500" />
                                        <span className="text-sm text-gray-300">{t('scopeStructure')}</span>
                                    </label>
                                </div>
                            </div>

                            {/* Linda Seger Refinement Checklist */}
                            {scope.characters && !aiDecides && (
                                <div className="space-y-2 bg-gray-700/20 p-3 rounded border border-indigo-900/50 animate-fade-in">
                                    <h4 className="font-semibold text-gray-300 text-sm mb-2">{t('segerRefinementTitle')}</h4>
                                    <div className="grid grid-cols-1 gap-2">
                                        <label className="flex items-center space-x-2 cursor-pointer">
                                            <input type="checkbox" checked={segerSettings.spine} onChange={() => handleSegerChange('spine')} className="rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500" />
                                            <span className="text-sm text-gray-300">{t('segerSpine')}</span>
                                        </label>
                                        <label className="flex items-center space-x-2 cursor-pointer">
                                            <input type="checkbox" checked={segerSettings.paradox} onChange={() => handleSegerChange('paradox')} className="rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500" />
                                            <span className="text-sm text-gray-300">{t('segerParadox')}</span>
                                        </label>
                                        <label className="flex items-center space-x-2 cursor-pointer">
                                            <input type="checkbox" checked={segerSettings.personaShadow} onChange={() => handleSegerChange('personaShadow')} className="rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500" />
                                            <span className="text-sm text-gray-300">{t('segerPersonaShadow')}</span>
                                        </label>
                                        <label className="flex items-center space-x-2 cursor-pointer">
                                            <input type="checkbox" checked={segerSettings.relationships} onChange={() => handleSegerChange('relationships')} className="rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500" />
                                            <span className="text-sm text-gray-300">{t('segerRelationships')}</span>
                                        </label>
                                        <label className="flex items-center space-x-2 cursor-pointer">
                                            <input type="checkbox" checked={segerSettings.backstory} onChange={() => handleSegerChange('backstory')} className="rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500" />
                                            <span className="text-sm text-gray-300">{t('segerBackstory')}</span>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {scope.structure && !aiDecides && (
                                <div className="animate-fade-in">
                                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('changeStructureTo')}</label>
                                    <select 
                                        value={newStructure} 
                                        onChange={(e) => setNewStructure(e.target.value)}
                                        className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm"
                                    >
                                        {Object.entries(options.narrativeStructureOptions).map(([value, label]) => (
                                            <option key={value} value={value}>{label as string}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Instructions */}
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

                            <button 
                                onClick={handleApply}
                                disabled={isLoading}
                                className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium bg-indigo-600 text-indigo-50 hover:bg-indigo-600/90 h-10 px-4 py-2 transition-transform transform hover:scale-[1.02]"
                            >
                                <WandIcon className="w-4 h-4 mr-2" />
                                {t('applyModification')}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};