import React, { useState, useEffect, ChangeEvent, useCallback } from 'react';
import { generateVideo } from '../services/geminiService';
import { VideoIcon, UploadIcon, WandIcon } from './icons';
import { LoadingSpinner } from './LoadingSpinner';
import { useLanguage } from '../contexts/languageContext';

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const ApiKeySelector: React.FC<{ onKeySelected: () => void }> = ({ onKeySelected }) => {
    const { t } = useLanguage();
    return (
        <div className="text-center p-6 bg-gray-800/50 border border-dashed border-gray-600 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">{t('apiKeyRequired')}</h3>
            <p className="text-sm text-gray-400 mb-4">
                {t('apiKeyDescription')}
            </p>
            <button
                onClick={async () => {
                    await window.aistudio?.openSelectKey();
                    onKeySelected();
                }}
                className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-indigo-600 text-indigo-50 hover:bg-indigo-600/90 h-10 px-4 py-2"
            >
                {t('selectApiKey')}
            </button>
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:underline mt-3 block">
                {t('learnMoreBilling')}
            </a>
        </div>
    );
};

export const VideoGenerator: React.FC = () => {
  const { t } = useLanguage();
  const [apiKeySelected, setApiKeySelected] = useState(false);
  const [image, setImage] = useState<{ file: File; preview: string } | null>(null);
  const [prompt, setPrompt] = useState('An astronaut riding a horse on the moon.');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const checkApiKey = useCallback(async () => {
    const hasKey = await window.aistudio?.hasSelectedApiKey() ?? false;
    setApiKeySelected(hasKey);
  }, []);

  useEffect(() => {
    checkApiKey();
  }, [checkApiKey]);

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage({ file, preview: URL.createObjectURL(file) });
    }
  };

  const handleGenerate = async () => {
    if (!image) {
      setError(t('errorUploadImage'));
      return;
    }
    setError(null);
    setIsLoading(true);
    setVideoUrl(null);
    setLoadingMessage(t('loadingPreparingAssets'));

    try {
      const base64 = await blobToBase64(image.file);
      const generatedUrl = await generateVideo(
        prompt, 
        { base64, mimeType: image.file.type }, 
        aspectRatio,
        (msgKey) => setLoadingMessage(t(msgKey as any)) // A bit of a hack, assumes keys match
      );
      setVideoUrl(generatedUrl);
    } catch (err) {
        const error = err as Error;
        console.error('Video generation failed:', error);
        
        if (error.message?.includes("Requested entity was not found.")) {
             setError(t('errorApiKey'));
             setApiKeySelected(false); // Force re-selection
        } else {
             setError(t('errorGeneric', { message: error.message }));
        }
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const onKeySelected = () => {
    setApiKeySelected(true);
    setError(null);
  }

  if (!apiKeySelected) {
    return <ApiKeySelector onKeySelected={onKeySelected} />;
  }

  return (
    <div className="bg-gray-800/50 p-6 rounded-lg shadow-lg border border-gray-700 space-y-6">
      <div className="flex items-center space-x-3">
        <VideoIcon className="w-6 h-6 text-indigo-400" />
        <h2 className="text-2xl font-bold">{t('videoGeneratorTitle')}</h2>
      </div>

      {videoUrl && (
        <div>
          <video src={videoUrl} controls className="w-full rounded-md" />
        </div>
      )}

      {isLoading && (
        <div className="text-center p-6 bg-gray-900/50 rounded-lg">
          <LoadingSpinner />
          <p className="mt-3 text-sm text-gray-300">{loadingMessage}</p>
        </div>
      )}

      {!isLoading && (
        <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">{t('videoStep1')}</label>
              <div className="mt-2 flex justify-center rounded-lg border border-dashed border-white/25 px-6 py-10">
                  <div className="text-center">
                      {image ? (
                          <img src={image.preview} alt="Preview" className="mx-auto h-24 w-auto rounded-md" />
                      ) : (
                          <UploadIcon className="mx-auto h-12 w-12 text-gray-500" aria-hidden="true" />
                      )}
                      <div className="mt-4 flex text-sm leading-6 text-gray-400">
                          <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-semibold text-indigo-400 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2 focus-within:ring-offset-gray-900 hover:text-indigo-500">
                              <span>{image ? t('changeImage') : t('uploadFile')}</span>
                              <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*" onChange={handleImageUpload} />
                          </label>
                          <p className="pl-1">{t('dragAndDrop')}</p>
                      </div>
                      <p className="text-xs leading-5 text-gray-400">{t('fileTypes')}</p>
                  </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">{t('videoStep2')}</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                placeholder={t('videoPromptPlaceholder')}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">{t('videoStep3')}</label>
              <div className="flex gap-4">
                <button onClick={() => setAspectRatio('16:9')} className={`flex-1 p-2 rounded-md text-sm border ${aspectRatio === '16:9' ? 'bg-indigo-600 border-indigo-500' : 'bg-gray-700 border-gray-600 hover:bg-gray-600'}`}>{t('aspectLandscape')}</button>
                <button onClick={() => setAspectRatio('9:16')} className={`flex-1 p-2 rounded-md text-sm border ${aspectRatio === '9:16' ? 'bg-indigo-600 border-indigo-500' : 'bg-gray-700 border-gray-600 hover:bg-gray-600'}`}>{t('aspectPortrait')}</button>
              </div>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}
            
            <button onClick={handleGenerate} disabled={!image || isLoading} className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-indigo-600 text-indigo-50 hover:bg-indigo-600/90 h-10 px-4 py-2 disabled:opacity-50">
              <WandIcon className="w-4 h-4 mr-2" />
              {t('generateVideo')}
            </button>
        </div>
      )}
    </div>
  );
};