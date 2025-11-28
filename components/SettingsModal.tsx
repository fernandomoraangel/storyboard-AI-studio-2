import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/languageContext';
import { SettingsIcon, CloseIcon, FloppyDiskIcon, RefreshCwIcon } from './icons';
import { AIProviderFactory } from '../services/ai/factory';
import { GeminiProvider } from '../services/ai/providers/gemini';

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
    const [comfyuiModel, setComfyuiModel] = useState('v1-5-pruned-emaonly.ckpt');
    const [geminiApiKey, setGeminiApiKey] = useState('');
    const [geminiTextModel, setGeminiTextModel] = useState('gemini-2.0-flash-exp');
    const [geminiMediaModel, setGeminiMediaModel] = useState('imagen-2');
    const [useCustomModel, setUseCustomModel] = useState(false);
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
            setComfyuiModel(localStorage.getItem('COMFYUI_MODEL') || 'v1-5-pruned-emaonly.ckpt');
            setGeminiApiKey(localStorage.getItem('GEMINI_API_KEY') || '');
            setGeminiTextModel(localStorage.getItem('GEMINI_TEXT_MODEL') || 'gemini-2.0-flash-exp');
            setGeminiMediaModel(localStorage.getItem('GEMINI_MEDIA_MODEL') || 'imagen-2');
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

    const fetchComfyUIModels = async () => {
        setIsFetchingModels(true);
        setFetchError('');
        try {
            const cleanUrl = comfyuiUrl.replace(/\/$/, '');
            const response = await fetch(`${cleanUrl}/object_info/CheckpointLoaderSimple`);
            if (!response.ok) throw new Error('Failed to fetch ComfyUI models');

            const data = await response.json();
            const models = data?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0];

            if (Array.isArray(models)) {
                setAvailableModels(models);
                if (models.length > 0) {
                    setFetchError(`✅ Found ${models.length} models.`);
                    if (!models.includes(comfyuiModel)) {
                        setComfyuiModel(models[0]);
                    }
                } else {
                    setFetchError('⚠️ No models found in ComfyUI.');
                }
            } else {
                throw new Error('Invalid response format from ComfyUI');
            }
        } catch (e) {
            console.error("Failed to fetch ComfyUI models:", e);
            setFetchError('❌ Failed to fetch models. Check URL/CORS.');
        } finally {
            setIsFetchingModels(false);
        }
    };

    const fetchGeminiModels = async () => {
        if (!geminiApiKey) {
            setFetchError('⚠️ Please enter a Gemini API Key first.');
            return;
        }
        setIsFetchingModels(true);
        setFetchError('');
        try {
            const provider = new GeminiProvider({ apiKey: geminiApiKey });
            const models = await provider.listModels();
            setAvailableModels(models);

            if (models.length > 0) {
                setFetchError(`✅ Found ${models.length} models (or defaults).`);
            } else {
                setFetchError('⚠️ No models found.');
            }
        } catch (e: any) {
            console.error("Failed to fetch Gemini models", e);
            setFetchError('❌ Failed to fetch models. Check API Key.');
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
            localStorage.setItem('COMFYUI_MODEL', comfyuiModel);
            localStorage.setItem('GEMINI_API_KEY', geminiApiKey);
            localStorage.setItem('GEMINI_TEXT_MODEL', geminiTextModel);
            localStorage.setItem('GEMINI_MEDIA_MODEL', geminiMediaModel);

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

                            <div className="flex justify-between items-center mb-1 mt-2">
                                <label className="block text-sm font-medium text-gray-400">Checkpoint Name</label>
                                <button
                                    onClick={fetchComfyUIModels}
                                    disabled={isFetchingModels}
                                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center disabled:opacity-50"
                                >
                                    <RefreshCwIcon className={`w-3 h-3 mr-1 ${isFetchingModels ? 'animate-spin' : ''}`} />
                                    Fetch Models
                                </button>
                            </div>

                            {availableModels.length > 0 ? (
                                <select
                                    value={comfyuiModel}
                                    onChange={(e) => setComfyuiModel(e.target.value)}
                                    className="block w-full rounded-md border-0 bg-gray-700/30 py-1.5 px-3 text-white shadow-sm ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm"
                                >
                                    {availableModels.map(model => (
                                        <option key={model} value={model}>{model}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    value={comfyuiModel}
                                    onChange={(e) => setComfyuiModel(e.target.value)}
                                    placeholder="e.g. v1-5-pruned-emaonly.ckpt"
                                    className="block w-full rounded-md border-0 bg-gray-700/30 py-1.5 px-3 text-white shadow-sm ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm"
                                />
                            )}
                            {fetchError && <p className="text-xs text-yellow-400 mt-1">{fetchError}</p>}
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
                                className="block w-full rounded-md border-0 bg-gray-700/50 py-1.5 px-3 text-white shadow-sm ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm mb-2"
                            />

                            <div className="flex justify-between items-center mb-1 mt-4">
                                <label className="block text-sm font-medium text-gray-400">Gemini Models</label>
                                <div className="flex items-center gap-2">
                                    <label className="flex items-center text-xs text-gray-400 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={useCustomModel}
                                            onChange={(e) => setUseCustomModel(e.target.checked)}
                                            className="mr-1 rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        Custom
                                    </label>
                                    <button
                                        onClick={fetchGeminiModels}
                                        disabled={isFetchingModels || !geminiApiKey || useCustomModel}
                                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center disabled:opacity-50"
                                    >
                                        <RefreshCwIcon className={`w-3 h-3 mr-1 ${isFetchingModels ? 'animate-spin' : ''}`} />
                                        Fetch
                                    </button>
                                </div>
                            </div>

                            {useCustomModel ? (
                                <div className="space-y-3 pl-2 border-l-2 border-indigo-500/20 my-2">
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">Text Model ID</label>
                                        <input
                                            type="text"
                                            value={geminiTextModel}
                                            onChange={(e) => setGeminiTextModel(e.target.value)}
                                            placeholder="e.g. gemini-1.5-pro"
                                            className="block w-full rounded-md border-0 bg-gray-700/30 py-1.5 px-3 text-white shadow-sm ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-xs"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">Media Model ID</label>
                                        <input
                                            type="text"
                                            value={geminiMediaModel}
                                            onChange={(e) => setGeminiMediaModel(e.target.value)}
                                            placeholder="e.g. imagen-3.0-generate-001"
                                            className="block w-full rounded-md border-0 bg-gray-700/30 py-1.5 px-3 text-white shadow-sm ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-xs"
                                        />
                                    </div>
                                </div>
                            ) : (availableModels.length > 0 && (
                                <div className="space-y-3 pl-2 border-l-2 border-indigo-500/20 my-2">
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">Text Model</label>
                                        <select
                                            value={geminiTextModel}
                                            onChange={(e) => setGeminiTextModel(e.target.value)}
                                            className="block w-full rounded-md border-0 bg-gray-700/30 py-1.5 px-3 text-white shadow-sm ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-xs"
                                        >
                                            {availableModels.filter(m => m.includes('generateContent')).map(model => {
                                                const name = model.split(' ')[0].replace('models/', '');
                                                return <option key={name} value={name}>{name}</option>;
                                            })}
                                            <option value="gemini-2.0-flash-exp">gemini-2.0-flash-exp (Default)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">Media Model</label>
                                        <select
                                            value={geminiMediaModel}
                                            onChange={(e) => setGeminiMediaModel(e.target.value)}
                                            className="block w-full rounded-md border-0 bg-gray-700/30 py-1.5 px-3 text-white shadow-sm ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-xs"
                                        >
                                            {availableModels.filter(m => m.includes('imagen') || m.includes('generateImage') || m.includes('generateImages')).map(model => {
                                                const name = model.split(' ')[0].replace('models/', '');
                                                return <option key={name} value={name}>{name}</option>;
                                            })}
                                            <option value="imagen-2">imagen-2 (Default)</option>
                                            <option value="imagen-3.0-generate-001">imagen-3.0-generate-001</option>
                                        </select>
                                    </div>
                                </div>
                            ))}
                            {fetchError && <p className="text-xs text-yellow-400 mt-1">{fetchError}</p>}
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
