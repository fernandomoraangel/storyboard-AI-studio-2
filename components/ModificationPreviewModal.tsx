

import React, { useState } from 'react';
import { useLanguage } from '../contexts/languageContext';
import { ProjectState } from '../lib/db';
import { CheckCircleIcon, CloseIcon, RefreshCwIcon } from './icons';

interface ModificationPreviewModalProps {
    explanation: string;
    proposedState: ProjectState;
    onConfirm: (finalState: ProjectState) => void;
    onCancel: () => void;
    onBack: () => void;
}

export const ModificationPreviewModal: React.FC<ModificationPreviewModalProps> = ({ explanation, proposedState, onConfirm, onCancel, onBack }) => {
    const { t } = useLanguage();
    const [logline, setLogline] = useState(proposedState.logline);
    const [treatment, setTreatment] = useState(proposedState.treatment);

    const handleConfirm = () => {
        onConfirm({
            ...proposedState,
            logline,
            treatment
        });
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full border border-indigo-500/50 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-900/50 rounded-t-lg">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <RefreshCwIcon className="w-5 h-5 text-indigo-400" />
                        {t('previewModificationTitle')}
                    </h3>
                    <button onClick={onCancel} className="p-1 rounded-full hover:bg-gray-700 text-gray-400 hover:text-white">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-indigo-900/20 border border-indigo-800 p-3 rounded-md text-center">
                            <span className="block text-2xl font-bold text-indigo-400">{proposedState.scenes.length}</span>
                            <span className="text-xs text-indigo-300 uppercase tracking-wide">{t('modifiedScenesCount')}</span>
                        </div>
                        <div className="bg-purple-900/20 border border-purple-800 p-3 rounded-md text-center">
                            <span className="block text-2xl font-bold text-purple-400">{proposedState.characters.length}</span>
                            <span className="text-xs text-purple-300 uppercase tracking-wide">{t('modifiedCharactersCount')}</span>
                        </div>
                    </div>

                    {/* Explanation */}
                    <div className="bg-gray-700/30 p-4 rounded-md border border-gray-600">
                        <h4 className="text-sm font-semibold text-indigo-300 mb-2 uppercase tracking-wide">{t('previewExplanation')}</h4>
                        <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{explanation}</p>
                    </div>

                    {/* Editable Fields */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">{t('logline')}</label>
                            <textarea
                                value={logline}
                                onChange={(e) => setLogline(e.target.value)}
                                rows={2}
                                className="block w-full rounded-md border-0 bg-white/5 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                            />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">{t('treatment')}</label>
                            <textarea
                                value={treatment}
                                onChange={(e) => setTreatment(e.target.value)}
                                rows={6}
                                className="block w-full rounded-md border-0 bg-white/5 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                            />
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-700 bg-gray-900/50 rounded-b-lg flex gap-3">
                    <button 
                        onClick={onCancel}
                        className="flex-1 py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-sm font-medium transition-colors"
                    >
                        {t('rejectChanges')}
                    </button>
                     <button 
                        onClick={onBack}
                        className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-500 text-white rounded-md text-sm font-medium transition-colors"
                    >
                        {t('redefineSettings')}
                    </button>
                    <button 
                        onClick={handleConfirm}
                        className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <CheckCircleIcon className="w-4 h-4" />
                        {t('acceptChanges')}
                    </button>
                </div>
            </div>
        </div>
    );
};