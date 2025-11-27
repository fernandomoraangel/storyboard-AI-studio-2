import React from 'react';
import { CloseIcon, CheckCircleIcon, AlertCircleIcon, InfoIcon } from './icons';
import { useLanguage } from '../contexts/languageContext';

interface AlertModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    type?: 'success' | 'error' | 'info';
}

export const AlertModal: React.FC<AlertModalProps> = ({ isOpen, onClose, title, message, type = 'info' }) => {
    const { t } = useLanguage();

    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'success':
                return <CheckCircleIcon className="w-12 h-12 text-green-400" />;
            case 'error':
                return <AlertCircleIcon className="w-12 h-12 text-red-400" />;
            default:
                return <InfoIcon className="w-12 h-12 text-blue-400" />;
        }
    };

    const getBorderColor = () => {
        switch (type) {
            case 'success':
                return 'border-green-500/50';
            case 'error':
                return 'border-red-500/50';
            default:
                return 'border-blue-500/50';
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className={`bg-gray-900 border ${getBorderColor()} rounded-lg shadow-2xl w-full max-w-md p-6 relative transform transition-all scale-100`}>
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                >
                    <CloseIcon className="w-5 h-5" />
                </button>

                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="p-3 bg-gray-800 rounded-full">
                        {getIcon()}
                    </div>

                    <h3 className="text-xl font-bold text-white">
                        {title}
                    </h3>

                    <p className="text-gray-300">
                        {message}
                    </p>

                    <button
                        onClick={onClose}
                        className="mt-4 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium transition-colors w-full sm:w-auto"
                    >
                        {t('close') || "Close"}
                    </button>
                </div>
            </div>
        </div>
    );
};
