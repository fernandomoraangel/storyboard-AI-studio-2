import React, { useState, ChangeEvent } from 'react';
import { useLanguage } from '../contexts/languageContext';
import { UploadIcon, TrashIcon, WandIcon } from './icons';
import { LoadingSpinner } from './LoadingSpinner';
import type { CustomStyle } from '../types';

interface StyleTransferProps {
    onSaveAndApplyStyle: (referenceImages: {id: number, file: File, preview: string}[], referencePrompt: string) => void;
    isApplying: boolean;
    customStyles: CustomStyle[];
    onDeleteStyle: (id: number) => void;
}

export const StyleTransfer: React.FC<StyleTransferProps> = ({ onSaveAndApplyStyle, isApplying, customStyles, onDeleteStyle }) => {
    const { t } = useLanguage();
    const [referenceImages, setReferenceImages] = useState<{id: number, file: File, preview: string}[]>([]);
    const [prompt, setPrompt] = useState('');

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const filesArray = Array.from(e.target.files).map((file: File) => ({
                id: Date.now() + Math.random(),
                file,
                preview: URL.createObjectURL(file)
            }));
            setReferenceImages(prev => [...prev, ...filesArray]);
        }
    };

    const removeImage = (id: number) => {
        setReferenceImages(prev => prev.filter(image => image.id !== id));
    };

    const handleApplyClick = () => {
        onSaveAndApplyStyle(referenceImages, prompt);
    };

    return (
        <div className="space-y-8">
            <p className="text-gray-400">{t('styleTransferDescription')}</p>
            
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">{t('uploadReferenceImages')}</label>
                    <div className="mt-2 flex justify-center rounded-lg border border-dashed border-white/25 px-6 py-10">
                        <div className="text-center">
                            <UploadIcon className="mx-auto h-12 w-12 text-gray-500" aria-hidden="true" />
                            <div className="mt-4 flex text-sm leading-6 text-gray-400">
                                <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-semibold text-indigo-400 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2 focus-within:ring-offset-gray-900 hover:text-indigo-500">
                                    <span>{t('uploadFile')}</span>
                                    <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*" multiple onChange={handleFileChange} />
                                </label>
                                <p className="pl-1">{t('dragAndDrop')}</p>
                            </div>
                            <p className="text-xs leading-5 text-gray-400">{t('fileTypes')}</p>
                        </div>
                    </div>
                </div>

                {referenceImages.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {referenceImages.map(image => (
                            <div key={image.id} className="group relative">
                                <img src={image.preview} alt="Reference" className="w-full h-auto object-cover rounded-md aspect-video"/>
                                <button
                                    onClick={() => removeImage(image.id)}
                                    className="absolute top-1 right-1 bg-black/60 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                                    aria-label={t('removeImage')}
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div>
                    <label htmlFor="style-prompt" className="block text-sm font-medium text-gray-400 mb-1">
                        {t('styleInstructions')}
                    </label>
                    <textarea
                        id="style-prompt"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        rows={3}
                        className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                        placeholder={t('styleInstructionsPlaceholder')}
                    />
                </div>
            </div>

            <button
                onClick={handleApplyClick}
                disabled={isApplying || referenceImages.length === 0}
                className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-indigo-600 text-indigo-50 hover:bg-indigo-600/90 h-10 px-4 py-2 disabled:opacity-50"
            >
                {isApplying ? (
                    <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        {t('applyingStyle')}
                    </>
                ) : (
                     <>
                        <WandIcon className="w-4 h-4 mr-2" />
                        {t('applyStyle')}
                     </>
                )}
            </button>

            <div className="border-t border-gray-700 pt-6 mt-8">
                <h3 className="text-lg font-semibold text-gray-300 mb-4">{t('savedStyles')}</h3>
                {customStyles.length === 0 ? (
                    <p className="text-gray-400 text-center py-4 bg-gray-800/30 rounded-md">{t('noSavedStyles')}</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {customStyles.map(style => (
                            <div key={style.id} className="bg-gray-700/50 p-3 rounded-md flex flex-col">
                                <div className="flex justify-between items-start mb-2">
                                    <p className="font-bold flex-1 break-all">{style.name}</p>
                                    <button onClick={() => style.id && onDeleteStyle(style.id)} className="text-red-500 hover:text-red-400 ml-2 p-1"><TrashIcon className="w-4 h-4" /></button>
                                </div>
                                 {style.prompt && <p className="text-xs text-gray-400 italic mb-2 line-clamp-2">"{style.prompt}"</p>}
                                <div className="flex gap-2 mt-auto">
                                    {style.images.slice(0, 3).map((img, idx) => (
                                        <div key={idx} className="w-1/3 aspect-video bg-gray-800 rounded-sm overflow-hidden">
                                            <img src={`data:${img.mimeType};base64,${img.data}`} className="w-full h-full object-cover" alt={`Reference ${idx+1} for ${style.name}`} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};