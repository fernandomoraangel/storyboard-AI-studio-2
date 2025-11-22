
import React from 'react';
import type { Episode } from '../types';
import { PlusIcon, TrashIcon, FilmIcon } from './icons';
import { useLanguage } from '../contexts/languageContext';

interface EpisodeListProps {
    episodes: Episode[];
    activeEpisodeId: number | null;
    onSelectEpisode: (id: number) => void;
    onAddEpisode: () => void;
    onDeleteEpisode: (id: number) => void;
    onUpdateEpisode: (id: number, data: Partial<Episode>) => void;
}

export const EpisodeList: React.FC<EpisodeListProps> = ({ 
    episodes, 
    activeEpisodeId, 
    onSelectEpisode, 
    onAddEpisode, 
    onDeleteEpisode,
    onUpdateEpisode 
}) => {
    const { t } = useLanguage();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-gray-700 pb-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Episodes</h2>
                    <p className="text-sm text-gray-400">Manage the structure of your series.</p>
                </div>
                <button 
                    onClick={onAddEpisode}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-indigo-600 text-indigo-50 hover:bg-indigo-600/90 h-10 px-4 py-2 shadow-sm transition-all hover:scale-105"
                >
                    <PlusIcon className="w-4 h-4 mr-2" /> Add Episode
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {episodes.map((episode, index) => (
                    <div 
                        key={episode.id} 
                        className={`group relative p-6 rounded-xl border transition-all duration-200 ${
                            activeEpisodeId === episode.id 
                            ? 'bg-indigo-900/20 border-indigo-500/50 shadow-lg shadow-indigo-900/20' 
                            : 'bg-gray-800/40 border-gray-700 hover:border-gray-600 hover:bg-gray-800/60'
                        }`}
                    >
                        <div className="flex items-start justify-between gap-6">
                            <div className="flex-shrink-0 flex flex-col items-center justify-center w-16 pt-1">
                                <div className="bg-gray-900 text-gray-400 text-xs font-bold px-2 py-1 rounded mb-2 uppercase tracking-wider border border-gray-700">
                                    EP {index + 1}
                                </div>
                            </div>

                            <div className="flex-1 space-y-3">
                                <input 
                                    type="text" 
                                    value={episode.title}
                                    onChange={(e) => onUpdateEpisode(episode.id, { title: e.target.value })}
                                    className="bg-transparent border-b border-transparent hover:border-gray-600 focus:border-indigo-500 focus:outline-none text-xl font-bold text-white w-full transition-colors placeholder-gray-600"
                                    placeholder="Episode Title"
                                />
                                <textarea 
                                    value={episode.synopsis}
                                    onChange={(e) => onUpdateEpisode(episode.id, { synopsis: e.target.value })}
                                    className="w-full bg-black/20 rounded-md border border-transparent hover:border-gray-700 focus:border-indigo-500 focus:outline-none text-sm text-gray-300 p-3 resize-none transition-all placeholder-gray-600"
                                    rows={2}
                                    placeholder="Brief synopsis of this episode..."
                                />
                                <div className="flex items-center gap-4 pt-2">
                                    <button 
                                        onClick={() => onSelectEpisode(episode.id)}
                                        className="inline-flex items-center gap-2 text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-400/10 px-3 py-1.5 rounded-full hover:bg-indigo-400/20"
                                    >
                                        <FilmIcon className="w-4 h-4" /> 
                                        {episode.scenes.length === 0 ? 'Start Storyboard' : `Open Storyboard (${episode.scenes.length} scenes)`}
                                    </button>
                                </div>
                            </div>
                            
                            <button 
                                onClick={(e) => { e.stopPropagation(); onDeleteEpisode(episode.id); }}
                                className="p-2 text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                title="Delete Episode"
                            >
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                ))}

                {episodes.length === 0 && (
                    <div className="text-center py-16 border-2 border-dashed border-gray-700 rounded-xl bg-gray-800/20 flex flex-col items-center">
                        <FilmIcon className="w-12 h-12 text-gray-600 mb-4" />
                        <p className="text-gray-400 text-lg font-medium">No episodes created yet.</p>
                        <p className="text-gray-500 text-sm mb-6">Start by creating the first episode of your series.</p>
                        <button onClick={onAddEpisode} className="text-indigo-400 hover:text-indigo-300 font-medium hover:underline">Create Episode 1</button>
                    </div>
                )}
            </div>
        </div>
    );
};
