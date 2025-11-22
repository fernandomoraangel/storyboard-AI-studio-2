
import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/languageContext';
import { Episode, Scene, Shot } from '../types';
import { FloppyDiskIcon, RefreshCwIcon, FilmIcon, ClapperboardIcon, ChevronDownIcon } from './icons';

interface VisualOrganizerProps {
    episodes: Episode[];
    onUpdateEpisodes: (newEpisodes: Episode[]) => void;
}

// Drag Types
const ITEM_TYPES = {
    EPISODE: 'EPISODE',
    SCENE: 'SCENE',
    SHOT: 'SHOT',
};

export const VisualOrganizer: React.FC<VisualOrganizerProps> = ({ episodes, onUpdateEpisodes }) => {
    const { t } = useLanguage();
    // Local state for the "Draft" version
    const [draftEpisodes, setDraftEpisodes] = useState<Episode[]>(JSON.parse(JSON.stringify(episodes)));
    const [openEpisodes, setOpenEpisodes] = useState<Record<number, boolean>>({});

    // Reset draft when external episodes change (if not dirty? simpler to just reset on mount or manual reset)
    useEffect(() => {
        setDraftEpisodes(JSON.parse(JSON.stringify(episodes)));
        // Default open all episodes
        const openState: Record<number, boolean> = {};
        episodes.forEach(ep => openState[ep.id] = true);
        setOpenEpisodes(openState);
    }, [episodes]);

    const handleUndo = () => {
        setDraftEpisodes(JSON.parse(JSON.stringify(episodes)));
    };

    const handleSave = () => {
        onUpdateEpisodes(draftEpisodes);
    };

    const toggleEpisode = (id: number) => {
        setOpenEpisodes(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // --- Drag & Drop Logic ---
    const dragItem = useRef<{ type: string; id: number; parentId?: number; index: number } | null>(null);
    const dragOverItem = useRef<{ type: string; id: number; parentId?: number; index: number } | null>(null);

    const handleDragStart = (e: React.DragEvent, type: string, id: number, index: number, parentId?: number) => {
        dragItem.current = { type, id, index, parentId };
        e.dataTransfer.effectAllowed = 'move';
        // HTML5 drag image handling is automatic, but we can customize if needed
    };

    const handleDragOver = (e: React.DragEvent, type: string, id: number, index: number, parentId?: number) => {
        e.preventDefault(); // Necessary to allow dropping
        e.stopPropagation();
        dragOverItem.current = { type, id, index, parentId };
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const source = dragItem.current;
        const target = dragOverItem.current;

        if (!source || !target) return;

        // Clone the state
        const newEpisodes = JSON.parse(JSON.stringify(draftEpisodes)) as Episode[];

        // 1. Reorder Episodes
        if (source.type === ITEM_TYPES.EPISODE && target.type === ITEM_TYPES.EPISODE) {
            const item = newEpisodes.splice(source.index, 1)[0];
            newEpisodes.splice(target.index, 0, item);
            setDraftEpisodes(newEpisodes);
        }

        // 2. Reorder Scenes (Same Episode)
        else if (source.type === ITEM_TYPES.SCENE && target.type === ITEM_TYPES.SCENE && source.parentId === target.parentId) {
            const epIndex = newEpisodes.findIndex(e => e.id === source.parentId);
            if (epIndex > -1) {
                const item = newEpisodes[epIndex].scenes.splice(source.index, 1)[0];
                newEpisodes[epIndex].scenes.splice(target.index, 0, item);
                setDraftEpisodes(newEpisodes);
            }
        }
        
        // 3. Move Scene to Different Episode (Target is Scene in another Ep)
        else if (source.type === ITEM_TYPES.SCENE && target.type === ITEM_TYPES.SCENE && source.parentId !== target.parentId) {
            const sourceEpIndex = newEpisodes.findIndex(e => e.id === source.parentId);
            const targetEpIndex = newEpisodes.findIndex(e => e.id === target.parentId);
            
            if (sourceEpIndex > -1 && targetEpIndex > -1) {
                const item = newEpisodes[sourceEpIndex].scenes.splice(source.index, 1)[0];
                newEpisodes[targetEpIndex].scenes.splice(target.index, 0, item);
                setDraftEpisodes(newEpisodes);
            }
        }

        // 4. Move Scene to Episode (Target is Episode Header)
        else if (source.type === ITEM_TYPES.SCENE && target.type === ITEM_TYPES.EPISODE) {
            const sourceEpIndex = newEpisodes.findIndex(e => e.id === source.parentId);
            const targetEpIndex = newEpisodes.findIndex(e => e.id === target.id); // Target ID is Episode ID
             if (sourceEpIndex > -1 && targetEpIndex > -1) {
                 const item = newEpisodes[sourceEpIndex].scenes.splice(source.index, 1)[0];
                 // Append to end of target episode
                 newEpisodes[targetEpIndex].scenes.push(item);
                 setDraftEpisodes(newEpisodes);
             }
        }

        // 5. Reorder Shots (Same Scene)
        else if (source.type === ITEM_TYPES.SHOT && target.type === ITEM_TYPES.SHOT && source.parentId === target.parentId) {
             // We need to find the scene. ParentId for Shot is SceneId.
             // We must traverse episodes to find the scene.
             for (const ep of newEpisodes) {
                 const sceneIndex = ep.scenes.findIndex(s => s.id === source.parentId);
                 if (sceneIndex > -1) {
                     const item = ep.scenes[sceneIndex].shots.splice(source.index, 1)[0];
                     ep.scenes[sceneIndex].shots.splice(target.index, 0, item);
                     break; 
                 }
             }
             setDraftEpisodes(newEpisodes);
        }
        
        // 6. Move Shot to Different Scene (Target is Shot in another Scene)
        else if (source.type === ITEM_TYPES.SHOT && target.type === ITEM_TYPES.SHOT && source.parentId !== target.parentId) {
            let item: Shot | null = null;
            // Remove from source
            for (const ep of newEpisodes) {
                const sIndex = ep.scenes.findIndex(s => s.id === source.parentId);
                if (sIndex > -1) {
                    item = ep.scenes[sIndex].shots.splice(source.index, 1)[0];
                    break;
                }
            }
            // Add to target
            if (item) {
                 for (const ep of newEpisodes) {
                    const sIndex = ep.scenes.findIndex(s => s.id === target.parentId);
                    if (sIndex > -1) {
                        ep.scenes[sIndex].shots.splice(target.index, 0, item);
                        break;
                    }
                }
                setDraftEpisodes(newEpisodes);
            }
        }
        
        // 7. Move Shot to Scene (Target is Scene Header)
        else if (source.type === ITEM_TYPES.SHOT && target.type === ITEM_TYPES.SCENE) {
             let item: Shot | null = null;
             // Remove
            for (const ep of newEpisodes) {
                const sIndex = ep.scenes.findIndex(s => s.id === source.parentId);
                if (sIndex > -1) {
                    item = ep.scenes[sIndex].shots.splice(source.index, 1)[0];
                    break;
                }
            }
            // Add
            if (item) {
                 for (const ep of newEpisodes) {
                    const sIndex = ep.scenes.findIndex(s => s.id === target.id); // Target ID is Scene ID
                    if (sIndex > -1) {
                        ep.scenes[sIndex].shots.push(item);
                        break;
                    }
                }
                setDraftEpisodes(newEpisodes);
            }
        }

        dragItem.current = null;
        dragOverItem.current = null;
    };

    // Helper to get image for Episode (First shot of first scene)
    const getEpisodeImage = (ep: Episode) => {
        if (ep.scenes.length > 0 && ep.scenes[0].shots.length > 0) {
            return ep.scenes[0].shots[0].imageUrl;
        }
        return null;
    };

    // Helper to get image for Scene (First shot)
    const getSceneImage = (scene: Scene) => {
        if (scene.shots.length > 0) {
            return scene.shots[0].imageUrl;
        }
        return null;
    };

    return (
        <div className="space-y-6">
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                             <FilmIcon className="w-6 h-6 text-indigo-400" />
                            {t('visualOrganizerTitle')}
                        </h2>
                        <p className="text-gray-400 text-sm mt-1">{t('visualOrganizerDescription')}</p>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={handleUndo}
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-gray-700 hover:bg-gray-600 text-white h-10 px-4 py-2 transition-colors"
                        >
                            <RefreshCwIcon className="w-4 h-4 mr-2" />
                            {t('undoReorganization')}
                        </button>
                        <button 
                            onClick={handleSave}
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white h-10 px-4 py-2 transition-colors"
                        >
                            <FloppyDiskIcon className="w-4 h-4 mr-2" />
                            {t('updateStoryOrder')}
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    {draftEpisodes.length === 0 ? (
                        <p className="text-center text-gray-500 py-10">{t('noEpisodes')}</p>
                    ) : (
                        draftEpisodes.map((episode, epIndex) => (
                            <div 
                                key={episode.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, ITEM_TYPES.EPISODE, episode.id, epIndex)}
                                onDragOver={(e) => handleDragOver(e, ITEM_TYPES.EPISODE, episode.id, epIndex)}
                                onDrop={handleDrop}
                                className="bg-gray-900/50 border border-gray-700 rounded-lg overflow-hidden transition-all hover:border-gray-500"
                            >
                                {/* Episode Header */}
                                <div 
                                    className="p-4 bg-gray-800 flex items-center gap-4 cursor-pointer"
                                    onClick={() => toggleEpisode(episode.id)}
                                >
                                    <div className="w-12 h-12 bg-gray-900 rounded overflow-hidden flex-shrink-0 border border-gray-700">
                                        {getEpisodeImage(episode) ? (
                                            <img src={getEpisodeImage(episode)!} className="w-full h-full object-cover" alt="Ep" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-600"><FilmIcon className="w-6 h-6"/></div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-white text-lg">{episode.title}</h3>
                                        <p className="text-xs text-gray-400">{episode.scenes.length} {t('scenes')}</p>
                                    </div>
                                    <ChevronDownIcon className={`w-5 h-5 text-gray-400 transition-transform ${openEpisodes[episode.id] ? 'rotate-180' : ''}`} />
                                </div>

                                {/* Scenes Grid */}
                                {openEpisodes[episode.id] && (
                                    <div className="p-4 bg-gray-900/30 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                        {episode.scenes.map((scene, scIndex) => (
                                            <div 
                                                key={scene.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, ITEM_TYPES.SCENE, scene.id, scIndex, episode.id)}
                                                onDragOver={(e) => handleDragOver(e, ITEM_TYPES.SCENE, scene.id, scIndex, episode.id)}
                                                onDrop={handleDrop}
                                                className="bg-gray-800 rounded-md border border-gray-700 flex flex-col overflow-hidden group hover:border-indigo-500/50 transition-colors"
                                            >
                                                <div className="relative aspect-video bg-black">
                                                     {getSceneImage(scene) ? (
                                                        <img src={getSceneImage(scene)!} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" alt="Scene" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-gray-700"><ClapperboardIcon className="w-8 h-8"/></div>
                                                    )}
                                                    <div className="absolute top-0 left-0 bg-black/70 px-2 py-1 text-xs font-bold text-white rounded-br">
                                                        {scIndex + 1}
                                                    </div>
                                                </div>
                                                <div className="p-2 border-t border-gray-700">
                                                    <p className="text-sm font-semibold truncate text-gray-200" title={scene.title}>{scene.title}</p>
                                                    <p className="text-xs text-gray-500">{scene.shots.length} {t('shot')}(s)</p>
                                                </div>
                                                
                                                {/* Shots Strip (Mini Grid inside Scene) */}
                                                <div className="p-2 bg-black/20 grid grid-cols-4 gap-1">
                                                    {scene.shots.map((shot, shIndex) => (
                                                        <div
                                                            key={shot.id}
                                                            draggable
                                                            onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, ITEM_TYPES.SHOT, shot.id, shIndex, scene.id); }}
                                                            onDragOver={(e) => { e.stopPropagation(); handleDragOver(e, ITEM_TYPES.SHOT, shot.id, shIndex, scene.id); }}
                                                            onDrop={handleDrop}
                                                            className="aspect-square bg-gray-700 rounded-sm overflow-hidden border border-gray-600 hover:border-white cursor-grab relative"
                                                            title={shot.description}
                                                        >
                                                            {shot.imageUrl ? (
                                                                <img src={shot.imageUrl} className="w-full h-full object-cover" alt="Shot" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-gray-500 text-[8px]">{shIndex + 1}</div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
