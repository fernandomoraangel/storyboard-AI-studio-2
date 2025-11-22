import React from 'react';
import { useLanguage } from '../contexts/languageContext';
import { LoadingSpinner } from './LoadingSpinner';
import { CheckCircleIcon, CircleIcon } from './icons';

interface StoryGenerationProgressProps {
    title: string;
    steps: { key: string; label: string }[];
    currentStepKey: string;
    error: string | null;
    onClose: () => void;
}

export const StoryGenerationProgress: React.FC<StoryGenerationProgressProps> = ({ title, steps, currentStepKey, error, onClose }) => {
    const { t } = useLanguage();
    const currentStepIndex = steps.findIndex(step => step.key === currentStepKey);

    const getStatus = (index: number) => {
        if (error && index === currentStepIndex) return 'error';
        if (index < currentStepIndex) return 'completed';
        if (index === currentStepIndex && !error) return 'in-progress';
        return 'pending';
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 sm:p-8 max-w-md w-full border border-gray-700">
                <h3 className="text-xl font-semibold mb-6 text-center text-white">
                    {error ? t('storyGenerationError', { message: '' }).replace(': ', '') : title}
                </h3>

                {!error ? (
                    <ul className="space-y-4">
                        {steps.map((step, index) => {
                            const status = getStatus(index);
                            return (
                                <li key={step.key} className="flex items-center space-x-4">
                                    <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                                        {status === 'completed' && <CheckCircleIcon className="w-6 h-6 text-green-500" />}
                                        {status === 'in-progress' && <div className="w-6 h-6"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-400"></div></div>}
                                        {status === 'pending' && <CircleIcon className="w-6 h-6 text-gray-600" />}
                                    </div>
                                    <span className={`text-sm ${status === 'completed' ? 'text-gray-400 line-through' : status === 'in-progress' ? 'text-indigo-400 font-semibold' : 'text-gray-500'}`}>
                                        {step.label}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <div>
                        <p className="text-sm text-red-400 bg-red-900/50 p-4 rounded-md text-center mb-6">{error}</p>
                        <button onClick={onClose} className="w-full px-4 py-2 text-sm rounded-md bg-gray-600 hover:bg-gray-500 transition-colors">
                            {t('cancel')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};