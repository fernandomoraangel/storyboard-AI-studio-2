import React, { useState, useEffect, useRef } from 'react';
import { Scene, Shot, Character } from '../types';
import { useLanguage } from '../contexts/languageContext';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, EyeIcon, EyeOffIcon } from './icons';

interface GalleryViewProps {
    scenes: Scene[];
    characters: Character[];
    onClose: () => void;
    initialShotId?: number;
}

export const GalleryView: React.FC<GalleryViewProps> = ({ scenes, characters, onClose, initialShotId }) => {
    const { t } = useLanguage();

    // Flatten all shots into a single array with metadata
    const allShots = React.useMemo(() => {
        const shots: { shot: Shot; scene: Scene; index: number }[] = [];
        let globalIndex = 0;
        scenes.forEach(scene => {
            scene.shots.forEach(shot => {
                shots.push({ shot, scene, index: globalIndex++ });
            });
        });
        return shots;
    }, [scenes]);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [showInfo, setShowInfo] = useState(true);
    const filmstripRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (initialShotId) {
            const foundIndex = allShots.findIndex(s => s.shot.id === initialShotId);
            if (foundIndex !== -1) setCurrentIndex(foundIndex);
        }
    }, [initialShotId, allShots]);

    // Scroll filmstrip to keep current shot in view
    useEffect(() => {
        if (filmstripRef.current) {
            const activeThumb = filmstripRef.current.children[currentIndex] as HTMLElement;
            if (activeThumb) {
                activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }, [currentIndex]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') {
                setCurrentIndex(prev => Math.max(0, prev - 1));
            } else if (e.key === 'ArrowRight') {
                setCurrentIndex(prev => Math.min(allShots.length - 1, prev + 1));
            } else if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [allShots.length, onClose]);

    if (allShots.length === 0) {
        return (
            <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center text-white">
                <p className="text-xl mb-4">{t('noShotsToDisplay') || "No shots to display"}</p>
                <button onClick={onClose} className="px-4 py-2 bg-gray-800 rounded hover:bg-gray-700">
                    {t('close') || "Close"}
                </button>
            </div>
        );
    }

    const currentItem = allShots[currentIndex];
    const { shot, scene } = currentItem;

    return (
        <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col text-white animate-fade-in">
            {/* Header */}
            <div className="h-14 border-b border-gray-800 flex items-center justify-between px-4 bg-gray-900/50 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                    <span className="font-mono text-sm text-gray-400">
                        {currentIndex + 1} / {allShots.length}
                    </span>
                    <span className="text-sm font-medium text-gray-300">
                        {scene.title} - Shot {shot.id.toString().slice(-4)}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowInfo(!showInfo)}
                        className="p-2 hover:bg-gray-800 rounded-full transition-colors"
                        title={showInfo ? "Hide Info" : "Show Info"}
                    >
                        {showInfo ? <EyeIcon className="w-5 h-5 text-gray-400" /> : <EyeOffIcon className="w-5 h-5 text-gray-400" />}
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-800 rounded-full transition-colors"
                        title={t('close') || "Close"}
                    >
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Previous Button */}
                <button
                    onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentIndex === 0}
                    className="w-16 flex items-center justify-center hover:bg-white/5 disabled:opacity-0 transition-colors z-10"
                >
                    <ChevronLeftIcon className="w-10 h-10 text-gray-400" />
                </button>

                {/* Main Image View */}
                <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
                    <div className="relative max-w-full max-h-[70vh] shadow-2xl ring-1 ring-white/10 bg-black rounded-lg overflow-hidden">
                        {shot.imageUrl ? (
                            <img
                                src={shot.imageUrl}
                                alt={shot.description}
                                className="max-w-full max-h-[70vh] object-contain"
                            />
                        ) : (
                            <div className="w-[800px] h-[450px] flex items-center justify-center bg-gray-900 text-gray-600">
                                <span className="text-lg italic">{t('noImageGenerated') || "No image generated"}</span>
                            </div>
                        )}

                        {/* Overlay Info */}
                        {showInfo && (
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6 pt-12 animate-fade-in">
                                <p className="text-lg font-medium text-white mb-1">{shot.description}</p>
                                <div className="flex gap-4 text-sm text-gray-300">
                                    <span className="px-2 py-0.5 bg-white/10 rounded">{shot.shotType}</span>
                                    <span className="px-2 py-0.5 bg-white/10 rounded">{shot.cameraMovement}</span>
                                    {shot.duration && <span className="px-2 py-0.5 bg-white/10 rounded">{shot.duration}s</span>}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Next Button */}
                <button
                    onClick={() => setCurrentIndex(prev => Math.min(allShots.length - 1, prev + 1))}
                    disabled={currentIndex === allShots.length - 1}
                    className="w-16 flex items-center justify-center hover:bg-white/5 disabled:opacity-0 transition-colors z-10"
                >
                    <ChevronRightIcon className="w-10 h-10 text-gray-400" />
                </button>
            </div>

            {/* Filmstrip Footer */}
            <div className="h-32 bg-black border-t border-gray-800 flex flex-col">
                <div
                    ref={filmstripRef}
                    className="flex-1 flex items-center gap-2 px-4 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
                >
                    {allShots.map((item, idx) => (
                        <button
                            key={`${item.scene.id}-${item.shot.id}`}
                            onClick={() => setCurrentIndex(idx)}
                            className={`flex-shrink-0 relative group transition-all duration-200 ${idx === currentIndex
                                    ? 'ring-2 ring-indigo-500 scale-105 z-10'
                                    : 'opacity-60 hover:opacity-100 hover:scale-105'
                                }`}
                        >
                            <div className="w-40 aspect-video bg-gray-900 rounded overflow-hidden relative">
                                {item.shot.imageUrl ? (
                                    <img
                                        src={item.shot.imageUrl}
                                        alt=""
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-600 bg-gray-800">
                                        No Image
                                    </div>
                                )}
                                {/* Film sprocket holes effect top/bottom */}
                                <div className="absolute top-0 left-0 right-0 h-1.5 bg-repeat-x bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI0IiB4PSIyIiB5PSIxIiBmaWxsPSIjMDAwIiBmaWxsLW9wYWNpdHk9IjAuNSIvPjwvc3ZnPg==')]"></div>
                                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-repeat-x bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI0IiB4PSIyIiB5PSIxIiBmaWxsPSIjMDAwIiBmaWxsLW9wYWNpdHk9IjAuNSIvPjwvc3ZnPg==')]"></div>
                            </div>
                            <div className="absolute bottom-1 right-1 text-[10px] bg-black/70 px-1 rounded text-gray-300 font-mono">
                                {idx + 1}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
