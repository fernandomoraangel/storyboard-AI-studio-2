
import React, { useState } from 'react';
import { useLanguage } from '../contexts/languageContext';
import { CloseIcon, DownloadIcon, CheckCircleIcon } from './icons';

export interface PDFExportOptions {
    includeCover: boolean;
    includeBible: boolean;
    includeCharacters: boolean;
    includeAllEpisodes: boolean;
    includePrompts: boolean;
    includeMetadata: boolean;
    layout: 'standard' | 'compact'; // Compact = 2 columns, smaller images
}

interface PDFExportModalProps {
    onExport: (options: PDFExportOptions) => void;
    onClose: () => void;
}

export const PDFExportModal: React.FC<PDFExportModalProps> = ({ onExport, onClose }) => {
    const { t } = useLanguage();
    
    const [options, setOptions] = useState<PDFExportOptions>({
        includeCover: true,
        includeBible: true,
        includeCharacters: true,
        includeAllEpisodes: true,
        includePrompts: false,
        includeMetadata: true,
        layout: 'compact', 
    });

    const handleToggle = (key: keyof PDFExportOptions) => {
        if (key === 'layout') return; 
        setOptions(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full border border-gray-700 flex flex-col">
                <div className="flex justify-between items-center p-4 border-b border-gray-700">
                    <h3 className="text-lg font-bold text-white">{t('exportToPDF')}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-700">
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Include Content</h4>
                        
                        <label className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-gray-700/50 rounded">
                            <input 
                                type="checkbox" 
                                checked={options.includeCover} 
                                onChange={() => handleToggle('includeCover')} 
                                className="rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500 h-5 w-5"
                            />
                            <span className="text-gray-200">Cover Page</span>
                        </label>

                        <label className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-gray-700/50 rounded">
                            <input 
                                type="checkbox" 
                                checked={options.includeBible} 
                                onChange={() => handleToggle('includeBible')} 
                                className="rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500 h-5 w-5"
                            />
                            <span className="text-gray-200">Series Bible & Overview</span>
                        </label>

                        <label className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-gray-700/50 rounded">
                            <input 
                                type="checkbox" 
                                checked={options.includeCharacters} 
                                onChange={() => handleToggle('includeCharacters')} 
                                className="rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500 h-5 w-5"
                            />
                            <span className="text-gray-200">Character Profiles</span>
                        </label>
                        
                        <label className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-gray-700/50 rounded">
                            <input 
                                type="checkbox" 
                                checked={options.includeAllEpisodes} 
                                onChange={() => handleToggle('includeAllEpisodes')} 
                                className="rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500 h-5 w-5"
                            />
                            <span className="text-gray-200">All Episodes (vs Current Only)</span>
                        </label>

                        <div className="border-t border-gray-700 my-2"></div>

                         <label className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-gray-700/50 rounded">
                            <input 
                                type="checkbox" 
                                checked={options.includePrompts} 
                                onChange={() => handleToggle('includePrompts')} 
                                className="rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500 h-5 w-5"
                            />
                            <span className="text-gray-200">Include Image Prompts</span>
                        </label>

                        <label className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-gray-700/50 rounded">
                            <input 
                                type="checkbox" 
                                checked={options.includeMetadata} 
                                onChange={() => handleToggle('includeMetadata')} 
                                className="rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500 h-5 w-5"
                            />
                            <span className="text-gray-200">Include Project Parameters</span>
                        </label>
                    </div>

                    <div className="border-t border-gray-700 pt-4 space-y-3">
                        <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Layout</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={() => setOptions(prev => ({ ...prev, layout: 'standard' }))}
                                className={`p-3 rounded border text-sm text-center transition-all ${options.layout === 'standard' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'}`}
                            >
                                <div className="mb-2 mx-auto w-8 h-10 border-2 border-current rounded-sm flex flex-col gap-1 p-0.5 opacity-60">
                                    <div className="w-full h-1/3 bg-current"></div>
                                    <div className="w-full h-1/3 bg-current"></div>
                                </div>
                                Standard
                                <span className="block text-xs opacity-70 mt-1">1 shot per row</span>
                            </button>
                            
                            <button 
                                onClick={() => setOptions(prev => ({ ...prev, layout: 'compact' }))}
                                className={`p-3 rounded border text-sm text-center transition-all ${options.layout === 'compact' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'}`}
                            >
                                <div className="mb-2 mx-auto w-8 h-10 border-2 border-current rounded-sm grid grid-cols-2 gap-0.5 p-0.5 opacity-60">
                                    <div className="bg-current h-1/3"></div>
                                    <div className="bg-current h-1/3"></div>
                                    <div className="bg-current h-1/3"></div>
                                    <div className="bg-current h-1/3"></div>
                                </div>
                                Compact Grid
                                <span className="block text-xs opacity-70 mt-1">2 shots per row</span>
                            </button>
                        </div>
                    </div>

                    <button 
                        onClick={() => onExport(options)}
                        className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 h-12 px-4 py-2 shadow-lg transition-transform hover:scale-[1.02]"
                    >
                        <DownloadIcon className="w-5 h-5 mr-2" />
                        Generate PDF
                    </button>
                </div>
            </div>
        </div>
    );
};
