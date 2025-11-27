
import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/languageContext';
import { ChartBarIcon, RefreshCwIcon, WandIcon, DownloadIcon, UploadIcon, FloppyDiskIcon, VideoIcon, BookOpenIcon } from './icons';
import { LoadingSpinner } from './LoadingSpinner';
import type { Episode, Character, StoryboardStyle, ProjectState } from '../types';
import JSZip from 'jszip';

interface UtilitiesProps {
    episodes: Episode[];
    characters: Character[];
    setEpisodes: React.Dispatch<React.SetStateAction<Episode[]>>;
    setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
    storyboardStyle: StoryboardStyle;
    aspectRatio: string;
    onGetProjectState: () => ProjectState;
    onImportProject: (state: ProjectState) => void;
    onExportPDF: () => void;
    onExportAnimatic: () => void;

    // New Props for handling regeneration state from parent (App.tsx)
    isRegenerating: boolean;
    regenerationProgress: { current: number; total: number };
    onStartRegeneration: () => void;
    onStopRegeneration: () => void;
    showAlert: (title: string, message: string, type?: 'success' | 'error' | 'info') => void;
}

export const Utilities: React.FC<UtilitiesProps> = ({
    episodes, characters, setEpisodes, setCharacters, storyboardStyle, aspectRatio, onGetProjectState, onImportProject, onExportPDF, onExportAnimatic,
    isRegenerating, regenerationProgress, onStartRegeneration, onStopRegeneration, showAlert
}) => {
    const { t } = useLanguage();
    const [tokenCount, setTokenCount] = useState(0);
    const [imageCount, setImageCount] = useState(0);

    // Import/Export State
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const zipInputRef = useRef<HTMLInputElement>(null);
    const [pendingJson, setPendingJson] = useState<ProjectState | null>(null);

    // Constants
    const TOKEN_LIMIT = 1000000; // Gemini 1.5 Flash context window (approx)

    // 1. Calculate Stats
    useEffect(() => {
        const calculateMetrics = () => {
            // Rough estimation: 1 token ~= 4 characters for English text
            const allText = JSON.stringify({ episodes, characters });
            const estimatedTokens = Math.ceil(allText.length / 4);
            setTokenCount(estimatedTokens);

            // Get Daily Image Count from LocalStorage (updated by geminiService)
            const storedDate = localStorage.getItem('dailyImageDate');
            const today = new Date().toISOString().split('T')[0];
            if (storedDate === today) {
                setImageCount(parseInt(localStorage.getItem('dailyImageCount') || '0', 10));
            } else {
                setImageCount(0);
            }
        };

        calculateMetrics();
        // Listen for custom event dispatched by geminiService
        const handleImageGenerated = () => calculateMetrics();
        window.addEventListener('imageGenerated', handleImageGenerated);

        return () => window.removeEventListener('imageGenerated', handleImageGenerated);
    }, [episodes, characters]);

    // --- IMPORT / EXPORT LOGIC ---

    const handleExportJSON = () => {
        setIsExporting(true);
        try {
            const state = onGetProjectState();

            // Create a deep clone to modify for export (strip base64 images)
            const exportState = JSON.parse(JSON.stringify(state)) as ProjectState;

            // Strip images from characters and shots
            exportState.characters.forEach(c => {
                c.images = c.images.map((img, idx) => `images/char_${c.id}_${idx}.png`);
            });

            exportState.episodes.forEach(ep => {
                ep.scenes.forEach(s => {
                    s.shots.forEach(shot => {
                        if (shot.imageUrl) {
                            shot.imageUrl = `images/shot_${shot.id}.png`;
                        }
                    });
                });
            });

            const blob = new Blob([JSON.stringify(exportState, null, 2)], { type: "application/json5" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${state.seriesTitle.replace(/ /g, '_') || 'project'}.json5`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Export JSON failed", err);
            showAlert("Error", "Export failed.", "error");
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportZIP = async () => {
        setIsExporting(true);
        try {
            const state = onGetProjectState();
            const zip = new JSZip();
            const imagesFolder = zip.folder("images");

            if (!imagesFolder) return;

            // Helper to add base64 image to zip
            const addToZip = (base64Str: string, filename: string) => {
                if (!base64Str || !base64Str.startsWith('data:image')) return;
                const base64Data = base64Str.split(',')[1];
                imagesFolder.file(filename, base64Data, { base64: true });
            };

            // Add Character Images
            state.characters.forEach(c => {
                c.images.forEach((img, idx) => {
                    addToZip(img, `char_${c.id}_${idx}.png`);
                });
            });

            // Add Shot Images
            state.episodes.forEach(ep => {
                ep.scenes.forEach(s => {
                    s.shots.forEach(shot => {
                        if (shot.imageUrl) {
                            addToZip(shot.imageUrl, `shot_${shot.id}.png`);
                        }
                    });
                });
            });

            const zipContent = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(zipContent);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${state.seriesTitle.replace(/ /g, '_') || 'project_images'}.zip`;
            a.click();
            URL.revokeObjectURL(url);

        } catch (err) {
            console.error("Export ZIP failed", err);
            showAlert("Error", "Export ZIP failed.", "error");
        } finally {
            setIsExporting(false);
        }
    };

    const handleJsonFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                setPendingJson(json);
                // Reset file input value so onChange triggers again if needed
                e.target.value = '';
            } catch (err) {
                console.error("Invalid JSON file", err);
                showAlert("Error", "Invalid JSON5 file.", "error");
            }
        };
        reader.readAsText(file);
    };

    const handleFinalImport = async () => {
        if (!pendingJson) return;
        setIsImporting(true);

        try {
            const zipFile = zipInputRef.current?.files?.[0];

            if (zipFile) {
                const zip = await JSZip.loadAsync(zipFile);

                // Helper to read image from zip and convert to base64 data URL
                const readImageFromZip = async (filename: string): Promise<string | null> => {
                    // Strip path if necessary, the JSON stores e.g. "images/file.png" but our ZIP folder structure might vary
                    const cleanName = filename.replace(/^images\//, '');
                    // Try finding in root 'images/' folder or root
                    const file = zip.file(`images/${cleanName}`) || zip.file(cleanName);
                    if (!file) return null;

                    const base64 = await file.async("base64");
                    // Assume PNG for simplicity or try to detect mime type?
                    return `data:image/png;base64,${base64}`;
                };

                // Restore Character Images
                for (const c of pendingJson.characters) {
                    const newImages: string[] = [];
                    for (const imgRef of c.images) {
                        // If it looks like a reference path, try to load it
                        if (imgRef.startsWith('images/') || imgRef.includes('.png')) {
                            const loaded = await readImageFromZip(imgRef);
                            if (loaded) newImages.push(loaded);
                        } else if (imgRef.startsWith('data:image')) {
                            // It's already base64 (legacy or manual edit)
                            newImages.push(imgRef);
                        }
                    }
                    c.images = newImages;
                }

                // Restore Shot Images
                for (const ep of pendingJson.episodes) {
                    for (const s of ep.scenes) {
                        for (const shot of s.shots) {
                            if (shot.imageUrl && (shot.imageUrl.startsWith('images/') || shot.imageUrl.includes('.png'))) {
                                const loaded = await readImageFromZip(shot.imageUrl);
                                shot.imageUrl = loaded; // If null (not found), it becomes null
                            }
                        }
                    }
                }
            } else {
                // No ZIP provided: Clear placeholder paths to avoid broken images
                for (const c of pendingJson.characters) {
                    c.images = c.images.filter(img => img.startsWith('data:image'));
                }
                for (const ep of pendingJson.episodes) {
                    for (const s of ep.scenes) {
                        for (const shot of s.shots) {
                            if (shot.imageUrl && !shot.imageUrl.startsWith('data:image')) {
                                shot.imageUrl = null;
                            }
                        }
                    }
                }
            }

            onImportProject(pendingJson);
            setPendingJson(null);
            if (zipInputRef.current) zipInputRef.current.value = '';
            showAlert(t('projectImportedSuccess') || "Project imported successfully!", "", "success");

        } catch (err) {
            console.error("Import failed", err);
            showAlert("Error", "Import failed. Check console.", "error");
        } finally {
            setIsImporting(false);
        }
    };

    const contextPercentage = Math.min(100, (tokenCount / TOKEN_LIMIT) * 100).toFixed(1);

    return (
        <div className="max-w-5xl mx-auto space-y-8">

            {/* Header */}
            <div className="flex items-center space-x-3 mb-6">
                <ChartBarIcon className="w-8 h-8 text-indigo-400" />
                <div>
                    <h2 className="text-2xl font-bold text-white">{t('utilitiesTitle')}</h2>
                    <p className="text-sm text-gray-400">{t('metricsDescription')}</p>
                </div>
            </div>

            {/* Dashboard Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Token Usage */}
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
                    <h3 className="text-gray-400 font-medium text-sm uppercase tracking-wider mb-2">{t('tokenUsage')}</h3>
                    <div className="flex items-end gap-2">
                        <span className="text-4xl font-bold text-white">{tokenCount.toLocaleString()}</span>
                        <span className="text-sm text-gray-500 mb-1">tokens</span>
                    </div>
                    <div className="mt-4">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>{t('contextWindow')}</span>
                            <span>{contextPercentage}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                            <div
                                className={`h-2 rounded-full transition-all duration-500 ${parseFloat(contextPercentage) > 90 ? 'bg-red-500' : 'bg-indigo-500'}`}
                                style={{ width: `${contextPercentage}%` }}
                            ></div>
                        </div>
                    </div>
                </div>

                {/* Image Usage */}
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
                    <h3 className="text-gray-400 font-medium text-sm uppercase tracking-wider mb-2">{t('imagesGeneratedToday')}</h3>
                    <div className="flex items-end gap-2">
                        <span className="text-4xl font-bold text-green-400">{imageCount}</span>
                        <span className="text-sm text-gray-500 mb-1">images</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-4">Resets daily. Tracks local browser usage.</p>
                </div>

                {/* Project Size */}
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
                    <h3 className="text-gray-400 font-medium text-sm uppercase tracking-wider mb-2">{t('projectStats')}</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-gray-300">{t('episodes')}</span>
                            <span className="font-bold text-white">{episodes.length}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-300">{t('scenes')}</span>
                            <span className="font-bold text-white">{episodes.reduce((acc, ep) => acc + ep.scenes.length, 0)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-300">{t('characters')}</span>
                            <span className="font-bold text-white">{characters.length}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Import / Export Area */}
            <div className="bg-gray-800/50 p-8 rounded-xl border border-gray-700 mt-8">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <FloppyDiskIcon className="w-5 h-5 text-blue-400" />
                    {t('importExportTitle')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                    {/* Export Column */}
                    <div className="space-y-4 border-r border-gray-700 pr-8">
                        <h4 className="font-semibold text-gray-300 text-sm uppercase">Export Media</h4>
                        <button
                            onClick={onExportPDF}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-900/30 hover:bg-red-900/50 border border-red-900/50 text-red-100 rounded-md font-medium transition-colors"
                        >
                            <BookOpenIcon className="w-5 h-5" />
                            {t('exportToPDF')}
                        </button>
                        <button
                            onClick={onExportAnimatic}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-900/50 text-purple-100 rounded-md font-medium transition-colors"
                        >
                            <VideoIcon className="w-5 h-5" />
                            {t('exportAnimatic')}
                        </button>

                        <div className="border-t border-gray-700 my-2"></div>

                        <h4 className="font-semibold text-gray-300 text-sm uppercase">Export Data</h4>
                        <button
                            onClick={handleExportJSON}
                            disabled={isExporting}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-md font-medium transition-colors"
                        >
                            <DownloadIcon className="w-5 h-5" />
                            {t('exportJSON')}
                        </button>
                        <button
                            onClick={handleExportZIP}
                            disabled={isExporting}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-md font-medium transition-colors"
                        >
                            <DownloadIcon className="w-5 h-5" />
                            {t('exportZIP')}
                        </button>
                    </div>

                    {/* Import Column */}
                    <div className="space-y-4">
                        <h4 className="font-semibold text-gray-300 text-sm uppercase">Import</h4>

                        {!pendingJson ? (
                            <label className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md font-medium transition-colors cursor-pointer">
                                <UploadIcon className="w-5 h-5" />
                                {t('importProject')}
                                <input
                                    type="file"
                                    accept=".json5,.json"
                                    onChange={handleJsonFileChange}
                                    className="hidden"
                                    ref={fileInputRef}
                                />
                            </label>
                        ) : (
                            <div className="space-y-4 bg-gray-900/50 p-4 rounded-md">
                                <p className="text-sm text-green-400 font-medium">✓ JSON Loaded. {t('importImagesOptional')}:</p>
                                <label className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-sm transition-colors cursor-pointer border border-dashed border-gray-500">
                                    <UploadIcon className="w-4 h-4" />
                                    Select ZIP (Optional)
                                    <input
                                        type="file"
                                        accept=".zip"
                                        ref={zipInputRef}
                                        className="hidden"
                                    />
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setPendingJson(null); if (zipInputRef.current) zipInputRef.current.value = ''; }}
                                        className="flex-1 py-2 text-sm bg-gray-600 hover:bg-gray-500 rounded-md"
                                    >
                                        {t('cancel')}
                                    </button>
                                    <button
                                        onClick={handleFinalImport}
                                        disabled={isImporting}
                                        className="flex-1 py-2 text-sm bg-green-600 hover:bg-green-500 rounded-md font-bold"
                                    >
                                        {isImporting ? <LoadingSpinner /> : t('loadProject')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Regeneration Area */}
            <div className="bg-gray-800/50 p-8 rounded-xl border border-gray-700 mt-8">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <WandIcon className="w-5 h-5 text-indigo-400" />
                    {t('regenerateAllImages')}
                </h3>
                <p className="text-gray-300 mb-6 max-w-2xl">
                    {t('regenerateAllDescription')}
                </p>

                {isRegenerating ? (
                    <div className="space-y-4">
                        <div className="flex justify-between text-sm text-gray-300">
                            <span>{t('regenerationProgress')}</span>
                            <span>{regenerationProgress.current} / {regenerationProgress.total}</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-4">
                            <div
                                className="bg-indigo-600 h-4 rounded-full transition-all duration-300"
                                style={{ width: `${(regenerationProgress.current / Math.max(1, regenerationProgress.total)) * 100}%` }}
                            ></div>
                        </div>
                        <button
                            onClick={onStopRegeneration}
                            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors"
                        >
                            {t('stopRegeneration')}
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={onStartRegeneration}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md font-medium transition-colors shadow-lg hover:shadow-indigo-500/30"
                    >
                        <RefreshCwIcon className="w-5 h-5" />
                        {t('startRegeneration')}
                    </button>
                )}
            </div>
        </div>
    );
};
