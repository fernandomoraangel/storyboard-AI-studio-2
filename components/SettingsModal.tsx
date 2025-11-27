import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/languageContext';
import { SettingsIcon, CloseIcon, FloppyDiskIcon, RefreshCwIcon } from './icons';
import { AIProviderFactory } from '../services/ai/factory';

interface SettingsModalProps {
    onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
    const { t } = useLanguage();
    const [textProvider, setTextProvider] = useState('gemini');
    const [mediaProvider, setMediaProvider] = useState('gemini');
    const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
    const [ollamaModel, setOllamaModel] = useState('llama3');
    const [comfyuiUrl, setComfyuiUrl] = useState('http://127.0.0.1:8188');
    const [geminiApiKey, setGeminiApiKey] = useState('');
    const [message, setMessage] = useState('');

    // Model fetching state
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [isFetchingModels, setIsFetchingModels] = useState(false);
    const [fetchError, setFetchError] = useState('');

    useEffect(() => {
        // Load settings from localStorage
        if (typeof window !== 'undefined') {
            setTextProvider(localStorage.getItem('AI_PROVIDER_TEXT') || 'gemini');
            setMediaProvider(localStorage.getItem('AI_PROVIDER_MEDIA') || 'gemini');
            setOllamaUrl(localStorage.getItem('OLLAMA_URL') || 'http://localhost:11434');
            setOllamaModel(localStorage.getItem('OLLAMA_MODEL') || 'llama3');
            setComfyuiUrl(localStorage.getItem('COMFYUI_URL') || 'http://127.0.0.1:8188');
            setGeminiApiKey(localStorage.getItem('GEMINI_API_KEY') || '');
        }
    }, []);

    const checkConnection = async () => {
        setMessage(t('testingConnection') || 'Testing connection...');
        try {
            const cleanUrl = ollamaUrl.replace(/\/$/, '');
            const response = await fetch(`${cleanUrl}/api/version`);
            if (response.ok) {
                setMessage('✅ Connection Successful!');
                setTimeout(() => setMessage(''), 3000);
            } else {
                throw new Error(response.statusText);
            }
        } catch (e) {
            console.error("Connection failed:", e);
            setMessage('❌ Connection Failed. Check URL/CORS.');
        }
    };

    const fetchOllamaModels = async () => {
        setIsFetchingModels(true);
        setFetchError('');
        try {
            const cleanUrl = ollamaUrl.replace(/\/$/, '');
            console.log(`[SettingsModal] Fetching models from: ${cleanUrl}/api/tags`);
            const response = await fetch(`${cleanUrl}/api/tags`);
            if (!response.ok) throw new Error('Failed to fetch models');
            const data = await response.json();
            console.log("[SettingsModal] Raw API Response:", JSON.stringify(data, null, 2));
            console.log("[SettingsModal] data.models:", data.models);

            if (!data.models || !Array.isArray(data.models)) {
                throw new Error('Invalid response format from Ollama API');
            }

            const models = data.models.map((m: any) => {
                console.log("[SettingsModal] Processing model:", m);
                return m.name;
            });
            console.log("[SettingsModal] Final parsed models array:", models);
            setAvailableModels(models);

            if (models.length > 0) {
                if (!models.includes(ollamaModel)) {
                    setOllamaModel(models[0]);
                    setFetchError(`✅ Found ${models.length} models. Switched to '${models[0]}'.`);
                } else {
                    setFetchError(`✅ Found ${models.length} models.`);
                }
            } else {
                setFetchError('⚠️ No models found in Ollama.');
            }
        } catch (e) {
            console.error("[SettingsModal] Failed to fetch models:", e);
            setFetchError('❌ Could not fetch models. Check URL/CORS.');
        } finally {
            setIsFetchingModels(false);
        }
    };

    const handleSave = () => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('AI_PROVIDER_TEXT', textProvider);
            localStorage.setItem('AI_PROVIDER_MEDIA', mediaProvider);
            localStorage.setItem('OLLAMA_URL', ollamaUrl);
            localStorage.setItem('OLLAMA_MODEL', ollamaModel);
            localStorage.setItem('COMFYUI_URL', comfyuiUrl);
            localStorage.setItem('GEMINI_API_KEY', geminiApiKey);

            // Reset the factory to reload config
            AIProviderFactory.resetInstance();

            setMessage(t('settingsSaved'));
            setTimeout(() => setMessage(''), 3000);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full border border-indigo-500/50 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b border-gray-700">
                    <div className="flex items-center space-x-2">
                        <SettingsIcon className="w-5 h-5 text-indigo-400" />
                        <h3 className="text-lg font-bold text-white">{t('settingsTitle')}</h3>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-700">
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    {/* Text Provider */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">{t('textProvider')}</label>
                        <select
                            value={textProvider}
                            onChange={(e) => setTextProvider(e.target.value)}
                            className="block w-full rounded-md border-0 bg-gray-700/50 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm"
                        >
                            <option value="gemini">Gemini (Cloud)</option>
                            <option value="ollama">Ollama (Local)</option>
                        </select>
                    </div>

                    {textProvider === 'ollama' && (
                        <div className="space-y-4 pl-4 border-l-2 border-indigo-500/30">
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-sm font-medium text-gray-400">{t('ollamaUrl')}</label>
                                    <button
                                        onClick={checkConnection}
                                        className="text-xs text-green-400 hover:text-green-300 underline"
                                    >
                                        Check Connection
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    value={ollamaUrl}
                                    onChange={(e) => setOllamaUrl(e.target.value)}
                                    className="block w-full rounded-md border-0 bg-gray-700/30 py-1.5 px-3 text-white shadow-sm ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-sm font-medium text-gray-400">{t('ollamaModel')}</label>
                                    <button
                                        onClick={fetchOllamaModels}
                                        disabled={isFetchingModels}
                                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center disabled:opacity-50"
                                    >
                                        <RefreshCwIcon className={`w-3 h-3 mr-1 ${isFetchingModels ? 'animate-spin' : ''}`} />
                                        Fetch Models
                                    </button>
                                </div>

                                {availableModels.length > 0 ? (
                                    <select
                                        value={ollamaModel}
                                        onChange={(e) => setOllamaModel(e.target.value)}
                                        className="block w-full rounded-md border-0 bg-gray-700/30 py-1.5 px-3 text-white shadow-sm ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm"
                                    >
                                        {availableModels.map(model => (
                                            <option key={model} value={model}>{model}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        value={ollamaModel}
                                        onChange={(e) => setOllamaModel(e.target.value)}
                                        placeholder="e.g. qwen2.5:0.5b"
                                        className="block w-full rounded-md border-0 bg-gray-700/30 py-1.5 px-3 text-white shadow-sm ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm"
                                    />
                                )}
                                {fetchError && <p className="text-xs text-yellow-400 mt-1">{fetchError}</p>}
                            </div>
                        </div>
                    )}

                    {/* Media Provider */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">{t('mediaProvider')}</label>
                        <select
                            value={mediaProvider}
                            onChange={(e) => setMediaProvider(e.target.value)}
                            className="block w-full rounded-md border-0 bg-gray-700/50 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm"
                        >
                            <option value="gemini">Gemini (Cloud)</option>
                            <option value="comfyui">ComfyUI (Local)</option>
                        </select>
                    </div>

                    {mediaProvider === 'comfyui' && (
                        <div className="pl-4 border-l-2 border-indigo-500/30">
                            <label className="block text-sm font-medium text-gray-400 mb-1">{t('comfyuiUrl')}</label>
                            <input
                                type="text"
                                value={comfyuiUrl}
                                onChange={(e) => setComfyuiUrl(e.target.value)}
                                className="block w-full rounded-md border-0 bg-gray-700/30 py-1.5 px-3 text-white shadow-sm ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm"
                            />
                        </div>
                    )}

                    {/* Gemini API Key (Global) */}
                    {(textProvider === 'gemini' || mediaProvider === 'gemini') && (
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">{t('geminiApiKey')}</label>
                            <input
                                type="password"
                                value={geminiApiKey}
                                onChange={(e) => setGeminiApiKey(e.target.value)}
                                placeholder="Leave empty to use env var"
                                className="block w-full rounded-md border-0 bg-gray-700/50 py-1.5 px-3 text-white shadow-sm ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm"
                            />
                        </div>
                    )}

                    {message && (
                        <div className="p-2 bg-green-500/20 border border-green-500/50 rounded text-green-200 text-sm text-center">
                            {message}
                        </div>
                    )}

                    <button
                        onClick={handleSave}
                        className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium bg-indigo-600 text-indigo-50 hover:bg-indigo-600/90 h-10 px-4 py-2 transition-transform transform hover:scale-[1.02]"
                    >
                        <FloppyDiskIcon className="w-4 h-4 mr-2" />
                        {t('saveSettings')}
                    </button>
                </div>
            </div>
        </div>
    );
};
