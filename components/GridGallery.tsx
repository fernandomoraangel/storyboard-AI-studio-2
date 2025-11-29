import React, { useState, useMemo } from 'react';
import { Episode, Scene, Shot, Character } from '../types';
import { useLanguage } from '../contexts/languageContext';
import {
    CloseIcon,
    LayoutGridIcon,
    FilmIcon,
    VideoIcon,
    ChevronDownIcon,
    ChevronLeftIcon,
    ChevronRightIcon
} from './icons';

interface GridGalleryProps {
    episodes: Episode[];
    characters: Character[];
    onClose?: () => void;
}

type ViewMode = 'episodes' | 'scenes' | 'shots';

export const GridGallery: React.FC<GridGalleryProps> = ({ episodes, characters, onClose }) => {
    const { t } = useLanguage();
    const [viewMode, setViewMode] = useState<ViewMode>('shots');
    const [filterText, setFilterText] = useState('');
    const [selectedSubplot, setSelectedSubplot] = useState<string>('');
    const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
    const [selectedSceneId, setSelectedSceneId] = useState<number | null>(null);
    const [selectedShot, setSelectedShot] = useState<{ shot: Shot; scene: Scene; episode: Episode } | null>(null);

    // Get unique subplots
    const uniqueSubplots = useMemo(() => {
        const subplots = new Set<string>();
        episodes.forEach(ep => {
            ep.scenes.forEach(scene => {
                scene.shots.forEach(shot => {
                    if (shot.subplot) subplots.add(shot.subplot);
                });
            });
        });
        return Array.from(subplots).sort();
    }, [episodes]);

    // --- Data Flattening & Filtering ---

    const filteredData = useMemo(() => {
        let resultEpisodes = episodes;

        // 1. Filter by Text (Global search)
        if (filterText) {
            const lowerFilter = filterText.toLowerCase();
            resultEpisodes = resultEpisodes.map(ep => ({
                ...ep,
                scenes: ep.scenes.map(scene => ({
                    ...scene,
                    shots: scene.shots.filter(shot =>
                        shot.description.toLowerCase().includes(lowerFilter) ||
                        shot.shotType.toLowerCase().includes(lowerFilter)
                    )
                })).filter(scene =>
                    scene.title.toLowerCase().includes(lowerFilter) ||
                    scene.shots.length > 0
                )
            })).filter(ep =>
                ep.title.toLowerCase().includes(lowerFilter) ||
                ep.scenes.length > 0
            );
        }

        // 2. Filter by Subplot
        if (selectedSubplot) {
            resultEpisodes = resultEpisodes.map(ep => ({
                ...ep,
                scenes: ep.scenes.map(scene => ({
                    ...scene,
                    shots: scene.shots.filter(shot => shot.subplot === selectedSubplot)
                })).filter(scene => scene.shots.length > 0)
            })).filter(ep => ep.scenes.length > 0);
        }

        // 3. Filter by Selection (Drill down)
        if (selectedEpisodeId) {
            resultEpisodes = resultEpisodes.filter(ep => ep.id === selectedEpisodeId);
        }

        // Flatten for Scenes View
        const allScenes = resultEpisodes.flatMap(ep =>
            ep.scenes.map(scene => ({ ...scene, episodeTitle: ep.title, episodeId: ep.id }))
        );

        // Filter Scenes by Selection
        const filteredScenes = selectedSceneId
            ? allScenes.filter(s => s.id === selectedSceneId)
            : allScenes;

        // Flatten for Shots View
        const allShots = filteredScenes.flatMap(scene =>
            scene.shots.map(shot => ({
                shot,
                scene,
                episode: resultEpisodes.find(e => e.id === scene.episodeId) || resultEpisodes[0] // Fallback safe
            }))
        );

        return {
            episodes: resultEpisodes,
            scenes: filteredScenes,
            shots: allShots
        };
    }, [episodes, filterText, selectedSubplot, selectedEpisodeId, selectedSceneId]);

    // --- Handlers ---

    const handleEpisodeClick = (epId: number) => {
        setSelectedEpisodeId(epId);
        setViewMode('scenes');
    };

    const handleSceneClick = (sceneId: number) => {
        setSelectedSceneId(sceneId);
        setViewMode('shots');
    };

    const handleShotClick = (item: { shot: Shot; scene: Scene; episode: Episode }) => {
        setSelectedShot(item);
    };

    const clearFilters = () => {
        setSelectedEpisodeId(null);
        setSelectedSceneId(null);
        setFilterText('');
        setSelectedSubplot('');
    };

    // --- Renderers ---

    const renderEpisodes = () => (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-6">
            {filteredData.episodes.map(ep => (
                <div
                    key={ep.id}
                    onClick={() => handleEpisodeClick(ep.id)}
                    className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-indigo-500 cursor-pointer transition-all hover:shadow-lg group"
                >
                    <div className="h-40 bg-gray-700 flex items-center justify-center group-hover:bg-gray-600 transition-colors">
                        <FilmIcon className="w-12 h-12 text-gray-500 group-hover:text-indigo-400" />
                    </div>
                    <div className="p-4">
                        <h3 className="font-bold text-white text-lg mb-1 truncate">{ep.title}</h3>
                        <p className="text-gray-400 text-sm line-clamp-2 mb-3 h-10">{ep.synopsis || "No synopsis"}</p>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>{ep.scenes.length} Scenes</span>
                            <span>{ep.scenes.reduce((acc, s) => acc + s.shots.length, 0)} Shots</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );

    const renderScenes = () => (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-6">
            {filteredData.scenes.map(scene => (
                <div
                    key={scene.id}
                    onClick={() => handleSceneClick(scene.id)}
                    className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-indigo-500 cursor-pointer transition-all hover:shadow-lg group"
                >
                    <div className="h-32 bg-gray-700 flex items-center justify-center group-hover:bg-gray-600 transition-colors relative">
                        {/* Preview first shot image if available */}
                        {scene.shots.find(s => s.imageUrl)?.imageUrl ? (
                            <img
                                src={scene.shots.find(s => s.imageUrl)?.imageUrl!}
                                alt=""
                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                            />
                        ) : (
                            <VideoIcon className="w-10 h-10 text-gray-500 group-hover:text-indigo-400" />
                        )}
                        <div className="absolute top-2 right-2 bg-black/60 px-2 py-0.5 rounded text-xs text-white">
                            {scene.shots.length} Shots
                        </div>
                    </div>
                    <div className="p-3">
                        <div className="text-xs text-indigo-400 mb-1">{scene.episodeTitle}</div>
                        <h3 className="font-medium text-white text-sm mb-1 truncate" title={scene.title}>{scene.title}</h3>
                        <p className="text-gray-500 text-xs truncate">{scene.location || "No location"}</p>
                    </div>
                </div>
            ))}
        </div>
    );

    const renderShots = () => (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-6">
            {filteredData.shots.map((item, idx) => (
                <div
                    key={`${item.scene.id}-${item.shot.id}`}
                    onClick={() => handleShotClick(item)}
                    className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-indigo-500 cursor-pointer transition-all hover:shadow-lg group flex flex-col"
                >
                    <div className="aspect-video bg-gray-900 relative overflow-hidden">
                        {item.shot.imageUrl ? (
                            <img
                                src={item.shot.imageUrl}
                                alt={item.shot.description}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-700">
                                <span className="text-xs">No Image</span>
                            </div>
                        )}
                        <div className="absolute top-1 left-1 bg-black/60 px-1.5 py-0.5 rounded text-[10px] text-white">
                            {item.shot.id.toString().slice(-3)}
                        </div>
                    </div>
                    <div className="p-2 flex-1 flex flex-col">
                        <p className="text-gray-300 text-xs line-clamp-2 mb-auto" title={item.shot.description}>
                            {item.shot.description || "No description"}
                        </p>
                        <div className="mt-2 pt-2 border-t border-gray-700 flex justify-between items-center">
                            <span className="text-[10px] text-indigo-400 truncate max-w-[60%]">
                                {item.scene.title}
                            </span>
                            <div className="flex gap-1">
                                {item.shot.subplot && (
                                    <span className="text-[9px] text-white bg-indigo-600/80 px-1 rounded" title={`Subplot: ${item.shot.subplot}`}>
                                        {item.shot.subplot.substring(0, 2).toUpperCase()}
                                    </span>
                                )}
                                <span className="text-[10px] text-gray-500 bg-gray-700 px-1 rounded">
                                    {item.shot.shotType}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-gray-900 text-white animate-fade-in">
            {/* Header */}
            <div className="h-16 border-b border-gray-700 flex items-center justify-between px-6 bg-gray-800/50 backdrop-blur-sm flex-shrink-0 z-10">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-lg font-bold">
                        <LayoutGridIcon className="w-6 h-6 text-indigo-400" />
                        Grid Gallery
                    </div>

                    {/* Breadcrumbs / Navigation */}
                    {(selectedEpisodeId || selectedSceneId) && (
                        <div className="flex items-center gap-2 text-sm text-gray-400 ml-4 pl-4 border-l border-gray-600">
                            {selectedEpisodeId && (
                                <button onClick={() => { setSelectedSceneId(null); setViewMode('scenes'); }} className="hover:text-white">
                                    Episode {episodes.find(e => e.id === selectedEpisodeId)?.title}
                                </button>
                            )}
                            {selectedSceneId && (
                                <>
                                    <ChevronRightIcon className="w-4 h-4" />
                                    <span className="text-white">
                                        Scene {filteredData.scenes.find(s => s.id === selectedSceneId)?.title}
                                    </span>
                                </>
                            )}
                            <button onClick={clearFilters} className="ml-2 p-1 hover:bg-gray-700 rounded-full" title="Clear Filters">
                                <CloseIcon className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    {/* View Mode Switcher */}
                    <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
                        {(['episodes', 'scenes', 'shots'] as ViewMode[]).map(mode => (
                            <button
                                key={mode}
                                onClick={() => { setViewMode(mode); setSelectedSceneId(null); if (mode === 'episodes') setSelectedEpisodeId(null); }}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${viewMode === mode
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-gray-400 hover:text-white hover:bg-gray-700'
                                    }`}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>

                    {/* Subplot Filter */}
                    {uniqueSubplots.length > 0 && (
                        <div className="relative group">
                            <select
                                value={selectedSubplot}
                                onChange={(e) => setSelectedSubplot(e.target.value)}
                                className="appearance-none bg-gray-800 border border-gray-700 rounded-md text-sm pl-3 pr-8 py-1.5 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer hover:bg-gray-700 transition-colors"
                            >
                                <option value="">All Subplots</option>
                                {uniqueSubplots.map(sub => (
                                    <option key={sub} value={sub}>{sub}</option>
                                ))}
                            </select>
                            <ChevronDownIcon className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                    )}

                    {/* Search */}
                    <input
                        type="text"
                        placeholder="Filter..."
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        className="bg-gray-800 border-gray-700 rounded-md text-sm px-3 py-1.5 focus:ring-indigo-500 focus:border-indigo-500 w-48"
                    />

                    {onClose && (
                        <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white">
                            <CloseIcon className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {viewMode === 'episodes' && renderEpisodes()}
                {viewMode === 'scenes' && renderScenes()}
                {viewMode === 'shots' && renderShots()}

                {/* Empty State */}
                {((viewMode === 'episodes' && filteredData.episodes.length === 0) ||
                    (viewMode === 'scenes' && filteredData.scenes.length === 0) ||
                    (viewMode === 'shots' && filteredData.shots.length === 0)) && (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                            <LayoutGridIcon className="w-12 h-12 mb-4 opacity-20" />
                            <p>No items found matching your filters.</p>
                            <button onClick={clearFilters} className="mt-4 text-indigo-400 hover:underline text-sm">
                                Clear all filters
                            </button>
                        </div>
                    )}
            </div>

            {/* Lightbox Overlay */}
            {selectedShot && (
                <div className="fixed inset-0 z-50 bg-black/95 flex flex-col animate-fade-in">
                    <div className="absolute top-4 right-4 z-50">
                        <button
                            onClick={() => setSelectedShot(null)}
                            className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                        >
                            <CloseIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex-1 flex items-center justify-center p-8">
                        {selectedShot.shot.imageUrl ? (
                            <img
                                src={selectedShot.shot.imageUrl}
                                alt={selectedShot.shot.description}
                                className="max-w-full max-h-full object-contain shadow-2xl"
                            />
                        ) : (
                            <div className="text-gray-500 text-xl">No Image Available</div>
                        )}
                    </div>

                    <div className="bg-gray-900/80 backdrop-blur-md p-6 border-t border-gray-800">
                        <div className="max-w-4xl mx-auto">
                            <div className="flex items-center gap-3 mb-2 text-indigo-400 text-sm font-mono">
                                <span>{selectedShot.episode.title}</span>
                                <ChevronRightIcon className="w-3 h-3" />
                                <span>{selectedShot.scene.title}</span>
                                <ChevronRightIcon className="w-3 h-3" />
                                <span>Shot {selectedShot.shot.id.toString().slice(-3)}</span>
                            </div>
                            <p className="text-xl text-white font-medium mb-4">{selectedShot.shot.description}</p>
                            <div className="flex flex-wrap gap-2">
                                <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300 border border-gray-700">
                                    {selectedShot.shot.shotType}
                                </span>
                                <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300 border border-gray-700">
                                    {selectedShot.shot.cameraMovement}
                                </span>
                                <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300 border border-gray-700">
                                    {selectedShot.shot.lighting}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
