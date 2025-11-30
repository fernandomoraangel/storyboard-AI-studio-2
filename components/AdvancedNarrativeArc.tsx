import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ProjectState, ArcPoint, Episode, Scene, Shot } from '../types';
import { useLanguage } from '../contexts/languageContext';
import {
    ActivityIcon,
    FilmIcon,
    ChevronRightIcon,
    ChevronDownIcon,
    RefreshCwIcon,
    WandIcon,
    SparklesIcon
} from './icons';
import { LoadingSpinner } from './LoadingSpinner';

interface AdvancedNarrativeArcProps {
    projectState: ProjectState;
    onUpdate: (newState: Partial<ProjectState>) => void;
}

type Scope = 'series' | 'episode' | 'scene';
type CurveType = 'linear' | 'natural' | 'step';

export const AdvancedNarrativeArc: React.FC<AdvancedNarrativeArcProps> = ({ projectState, onUpdate }) => {
    const { t } = useLanguage();
    const [scope, setScope] = useState<Scope>('series');
    const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
    const [selectedSceneId, setSelectedSceneId] = useState<number | null>(null);
    const [cursorProgress, setCursorProgress] = useState<number>(0); // 0-100
    const [isRewriting, setIsRewriting] = useState(false);

    // Editing State
    const [isDragging, setIsDragging] = useState(false);
    const [activePoint, setActivePoint] = useState<{ index: number; type: 'tension' | 'emotion' | 'conflict' } | null>(null);
    const keysPressed = useRef<{ n: boolean; d: boolean; shift: boolean }>({ n: false, d: false, shift: false });

    const [curveType, setCurveType] = useState<CurveType>('natural');
    const [selectedCurve, setSelectedCurve] = useState<'tension' | 'emotion' | 'conflict'>('tension');

    const svgRef = useRef<SVGSVGElement>(null);
    const filmstripRef = useRef<HTMLDivElement>(null);

    // --- Derived Data ---

    const currentEpisode = useMemo(() =>
        projectState.episodes.find(e => e.id === selectedEpisodeId),
        [projectState.episodes, selectedEpisodeId]);

    const currentScene = useMemo(() =>
        currentEpisode?.scenes.find(s => s.id === selectedSceneId),
        [currentEpisode, selectedSceneId]);

    // --- Arc Calculation Logic (Single Source of Truth: projectState.narrativeArc) ---

    // 1. Series Arc (The Master)


    const seriesArc = useMemo(() => {
        const sorted = (projectState.narrativeArc || []).sort((a, b) => (a.x || 0) - (b.x || 0));

        const withBoundaries = [...sorted];

        // Ensure Start Point (x=0)
        if (withBoundaries.length === 0 || (withBoundaries[0].x || 0) > 0) {
            withBoundaries.unshift({
                id: -1,
                label: 'Start',
                x: 0,
                tension: withBoundaries[0]?.tension ?? 5,
                emotion: withBoundaries[0]?.emotion ?? 5,
                conflict: withBoundaries[0]?.conflict ?? 5,
                isEpisodeAnchor: false
            });
        }

        // Ensure End Point (x=100)
        if (withBoundaries.length === 0 || (withBoundaries[withBoundaries.length - 1].x || 0) < 100) {
            withBoundaries.push({
                id: -2,
                label: 'End',
                x: 100,
                tension: withBoundaries[withBoundaries.length - 1]?.tension ?? 5,
                emotion: withBoundaries[withBoundaries.length - 1]?.emotion ?? 5,
                conflict: withBoundaries[withBoundaries.length - 1]?.conflict ?? 5,
                isEpisodeAnchor: false
            });
        }

        return withBoundaries;
    }, [projectState.narrativeArc]);

    // 2. Episode Arc (Slice of Series Arc)
    const episodeArc = useMemo(() => {
        if (!currentEpisode) return [];
        const totalEpisodes = projectState.episodes.length;
        const index = projectState.episodes.findIndex(e => e.id === currentEpisode.id);
        if (index === -1) return [];

        const startPercent = (index / totalEpisodes) * 100;
        const endPercent = ((index + 1) / totalEpisodes) * 100;
        const range = endPercent - startPercent;

        // Robust Logic: Include boundary points
        const sortedSeries = [...seriesArc].sort((a, b) => (a.x || 0) - (b.x || 0));

        const mappedAll = sortedSeries.map(p => ({
            ...p,
            x: ((p.x || 0) - startPercent) / range * 100
        }));

        // Keep points inside [0, 100] AND immediate neighbors
        const insideIndices = mappedAll.map((p, i) => (p.x! >= 0 && p.x! <= 100) ? i : -1).filter(i => i !== -1);

        let indicesToKeep = new Set<number>(insideIndices);

        if (insideIndices.length > 0) {
            const first = insideIndices[0];
            const last = insideIndices[insideIndices.length - 1];
            if (first > 0) indicesToKeep.add(first - 1);
            if (last < mappedAll.length - 1) indicesToKeep.add(last + 1);
        } else {
            // No points inside. Find the gap.
            const firstAfter = mappedAll.findIndex(p => p.x! > 100);
            if (firstAfter !== -1) {
                indicesToKeep.add(firstAfter);
                if (firstAfter > 0) indicesToKeep.add(firstAfter - 1);
            } else {
                if (mappedAll.length > 0) indicesToKeep.add(mappedAll.length - 1);
            }
        }

        return mappedAll.filter((_, i) => indicesToKeep.has(i)).sort((a, b) => (a.x || 0) - (b.x || 0));
    }, [seriesArc, currentEpisode, projectState.episodes]);

    // 3. Scene Arc (Slice of Series Arc)
    const sceneArc = useMemo(() => {
        if (!currentEpisode || !currentScene) return [];

        const totalEpisodes = projectState.episodes.length;
        const epIndex = projectState.episodes.findIndex(e => e.id === currentEpisode.id);

        const totalScenes = currentEpisode.scenes.length;
        const sceneIndex = currentEpisode.scenes.findIndex(s => s.id === currentScene.id);

        // Calculate Global Range for this Scene
        const epStart = (epIndex / totalEpisodes) * 100;
        const epEnd = ((epIndex + 1) / totalEpisodes) * 100;
        const epRange = epEnd - epStart;

        const sceneStartLocal = (sceneIndex / totalScenes);
        const sceneEndLocal = ((sceneIndex + 1) / totalScenes);

        const startPercent = epStart + (sceneStartLocal * epRange);
        const endPercent = epStart + (sceneEndLocal * epRange);
        const range = endPercent - startPercent;

        // Robust Logic
        const sortedSeries = [...seriesArc].sort((a, b) => (a.x || 0) - (b.x || 0));

        const mappedAll = sortedSeries.map(p => ({
            ...p,
            x: ((p.x || 0) - startPercent) / range * 100
        }));

        const insideIndices = mappedAll.map((p, i) => (p.x! >= 0 && p.x! <= 100) ? i : -1).filter(i => i !== -1);

        let indicesToKeep = new Set<number>(insideIndices);

        if (insideIndices.length > 0) {
            const first = insideIndices[0];
            const last = insideIndices[insideIndices.length - 1];
            if (first > 0) indicesToKeep.add(first - 1);
            if (last < mappedAll.length - 1) indicesToKeep.add(last + 1);
        } else {
            const firstAfter = mappedAll.findIndex(p => p.x! > 100);
            if (firstAfter !== -1) {
                indicesToKeep.add(firstAfter);
                if (firstAfter > 0) indicesToKeep.add(firstAfter - 1);
            } else {
                if (mappedAll.length > 0) indicesToKeep.add(mappedAll.length - 1);
            }
        }

        return mappedAll.filter((_, i) => indicesToKeep.has(i)).sort((a, b) => (a.x || 0) - (b.x || 0));
    }, [seriesArc, currentEpisode, currentScene, projectState.episodes]);

    // Active Arc based on Scope
    const activeArc = useMemo(() => {
        if (scope === 'scene') return sceneArc;
        if (scope === 'episode') return episodeArc;
        return seriesArc;
    }, [scope, sceneArc, episodeArc, seriesArc]);

    const activeShots = useMemo(() => {
        if (scope === 'scene' && currentScene) return currentScene.shots;
        if (scope === 'episode' && currentEpisode) return currentEpisode.scenes.flatMap(s => s.shots);
        return projectState.episodes.flatMap(e => e.scenes.flatMap(s => s.shots));
    }, [scope, currentScene, currentEpisode, projectState.episodes]);

    // --- Helpers ---

    const padding = 40;
    const height = 300;
    const width = 800;

    const getCoordinates = (xPercent: number, value: number) => {
        const x = padding + (xPercent / 100) * (width - 2 * padding);
        const y = height - padding - (value / 10) * (height - 2 * padding);
        return { x, y };
    };

    const getValueFromCoordinates = (svgX: number, svgY: number) => {
        const innerWidth = width - 2 * padding;
        const innerHeight = height - 2 * padding;

        let xPercent = ((svgX - padding) / innerWidth) * 100;
        let value = 10 * (height - padding - svgY) / innerHeight;

        xPercent = Math.max(0, Math.min(100, xPercent));
        value = Math.max(0, Math.min(10, value));

        return { x: xPercent, value };
    };

    // --- Update Logic ---



    const handleUpdate = (newPoints: ArcPoint[]) => {
        // We always update the MASTER seriesArc (projectState.narrativeArc)
        // We need to map the modified points back to Global Coordinates

        let updatedSeriesArc = [...projectState.narrativeArc];

        if (scope === 'series') {
            updatedSeriesArc = newPoints;
        } else if (scope === 'episode' && currentEpisode) {
            const totalEpisodes = projectState.episodes.length;
            const index = projectState.episodes.findIndex(e => e.id === currentEpisode.id);
            const startPercent = (index / totalEpisodes) * 100;
            const endPercent = ((index + 1) / totalEpisodes) * 100;
            const range = endPercent - startPercent;

            // 1. Remove points in this episode's range from master
            updatedSeriesArc = updatedSeriesArc.filter(p => {
                const x = p.x || 0;
                return x < startPercent || x > endPercent;
            });

            // 2. Map new points to global
            const mappedPoints = newPoints.map(p => ({
                ...p,
                x: startPercent + ((p.x || 0) / 100) * range
            }));

            // 3. Merge
            updatedSeriesArc = [...updatedSeriesArc, ...mappedPoints];

        } else if (scope === 'scene' && currentEpisode && currentScene) {
            const totalEpisodes = projectState.episodes.length;
            const epIndex = projectState.episodes.findIndex(e => e.id === currentEpisode.id);
            const totalScenes = currentEpisode.scenes.length;
            const sceneIndex = currentEpisode.scenes.findIndex(s => s.id === currentScene.id);

            const epStart = (epIndex / totalEpisodes) * 100;
            const epEnd = ((epIndex + 1) / totalEpisodes) * 100;
            const epRange = epEnd - epStart;

            const sceneStartLocal = (sceneIndex / totalScenes);
            const sceneEndLocal = ((sceneIndex + 1) / totalScenes);

            const startPercent = epStart + (sceneStartLocal * epRange);
            const endPercent = epStart + (sceneEndLocal * epRange);
            const range = endPercent - startPercent;

            // 1. Remove points in this scene's range from master
            updatedSeriesArc = updatedSeriesArc.filter(p => {
                const x = p.x || 0;
                return x < startPercent || x > endPercent;
            });

            // 2. Map new points to global
            const mappedPoints = newPoints.map(p => ({
                ...p,
                x: startPercent + ((p.x || 0) / 100) * range
            }));

            // 3. Merge
            updatedSeriesArc = [...updatedSeriesArc, ...mappedPoints];
        }

        updatedSeriesArc.sort((a, b) => (a.x || 0) - (b.x || 0));
        onUpdate({ narrativeArc: updatedSeriesArc });
    };

    // --- Shot Positions for Sync ---
    const shotPositions = useMemo(() => {
        const positions: { id: number; start: number; end: number; center: number }[] = [];

        if (scope === 'series') {
            const totalEpisodes = projectState.episodes.length;
            projectState.episodes.forEach((ep, epIndex) => {
                const epWidth = 100 / totalEpisodes;
                const epStart = epIndex * epWidth;

                const totalShots = ep.scenes.reduce((acc, s) => acc + s.shots.length, 0);
                let currentShotIndex = 0;

                ep.scenes.forEach(scene => {
                    scene.shots.forEach(shot => {
                        const shotWidth = totalShots > 0 ? epWidth / totalShots : 0;
                        const start = epStart + (currentShotIndex * shotWidth);
                        const end = start + shotWidth;
                        positions.push({ id: shot.id, start, end, center: (start + end) / 2 });
                        currentShotIndex++;
                    });
                });
            });
        } else if (scope === 'episode' && currentEpisode) {
            const totalScenes = currentEpisode.scenes.length;
            currentEpisode.scenes.forEach((scene, sceneIndex) => {
                const sceneWidth = 100 / totalScenes;
                const sceneStart = sceneIndex * sceneWidth;

                const totalShots = scene.shots.length;
                scene.shots.forEach((shot, shotIndex) => {
                    const shotWidth = totalShots > 0 ? sceneWidth / totalShots : 0;
                    const start = sceneStart + (shotIndex * shotWidth);
                    const end = start + shotWidth;
                    positions.push({ id: shot.id, start, end, center: (start + end) / 2 });
                });
            });
        } else if (scope === 'scene' && currentScene) {
            const totalShots = currentScene.shots.length;
            currentScene.shots.forEach((shot, shotIndex) => {
                const shotWidth = totalShots > 0 ? 100 / totalShots : 0;
                const start = shotIndex * shotWidth;
                const end = start + shotWidth;
                positions.push({ id: shot.id, start, end, center: (start + end) / 2 });
            });
        }
        return positions;
    }, [scope, projectState.episodes, currentEpisode, currentScene]);

    // --- Arc Path Calculation ---
    const arcPath = useMemo(() => {
        if (activeArc.length === 0) return '';

        const points = activeArc.map(p => getCoordinates(p.x || 0, p[selectedCurve] || 0));
        if (points.length === 0) return '';

        let d = `M ${points[0].x} ${points[0].y}`;

        if (curveType === 'linear') {
            points.forEach((p, i) => {
                if (i > 0) d += ` L ${p.x} ${p.y}`;
            });
        } else if (curveType === 'step') {
            points.forEach((p, i) => {
                if (i > 0) {
                    d += ` H ${p.x} V ${p.y}`;
                }
            });
        } else {
            // Natural (Catmull-Rom or similar, simplified here to cubic bezier for smoothness)
            for (let i = 0; i < points.length - 1; i++) {
                const p0 = points[i === 0 ? 0 : i - 1];
                const p1 = points[i];
                const p2 = points[i + 1];
                const p3 = points[i + 2] || p2;

                const cp1x = p1.x + (p2.x - p0.x) / 6;
                const cp1y = p1.y + (p2.y - p0.y) / 6;

                const cp2x = p2.x - (p3.x - p1.x) / 6;
                const cp2y = p2.y - (p3.y - p1.y) / 6;

                d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
            }
        }


        return d;
    }, [activeArc, curveType, selectedCurve]);

    // --- Interaction Handlers ---
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!svgRef.current) return;
        const { x, value } = getValueFromCoordinates(e.nativeEvent.offsetX, e.nativeEvent.offsetY);

        // Add Node Logic: Shift + N + Click
        if (keysPressed.current.shift && keysPressed.current.n) {
            const newPoint: ArcPoint = {
                id: Date.now(),
                label: 'Beat',
                x: Number(x.toFixed(1)),
                tension: 5,
                emotion: 5,
                conflict: 5,
                [selectedCurve]: Number(value.toFixed(1)),
                isEpisodeAnchor: false
            };

            const newPoints = [...activeArc, newPoint].sort((a, b) => (a.x || 0) - (b.x || 0));
            handleUpdate(newPoints);
            return;
        }

        setCursorProgress(x);
        setIsDragging(true);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const scaleX = width / rect.width;
        const svgX = (e.clientX - rect.left) * scaleX;
        const svgY = (e.clientY - rect.top) * (height / rect.height);

        // Cursor Logic
        const { x: progress, value } = getValueFromCoordinates(svgX, svgY);

        if (isDragging && activePoint) {
            // Dragging a point
            const newPoints = [...activeArc];
            if (newPoints[activePoint.index]) {
                newPoints[activePoint.index] = {
                    ...newPoints[activePoint.index],
                    x: progress,
                    [selectedCurve]: value
                };
                handleUpdate(newPoints);
            }
        } else {
            // Just moving cursor
            setCursorProgress(progress);

            // Sync Filmstrip Scroll
            const targetShotIndex = shotPositions.findIndex(p => progress >= p.start && progress < p.end);
            if (targetShotIndex !== -1 && filmstripRef.current) {
                const shotElement = filmstripRef.current.children[targetShotIndex] as HTMLElement;
                if (shotElement) {
                    const containerCenter = filmstripRef.current.clientWidth / 2;
                    const shotCenter = shotElement.offsetLeft + (shotElement.clientWidth / 2);
                    filmstripRef.current.scrollLeft = shotCenter - containerCenter;
                }
            }
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setActivePoint(null);
    };

    const handlePointMouseDown = (e: React.MouseEvent, index: number) => {
        e.stopPropagation();

        // Delete Logic: Shift + D + Click
        if (keysPressed.current.shift && keysPressed.current.d) {
            const pointToDelete = activeArc[index];
            // Prevent deleting synthetic start/end points
            if (pointToDelete.id < 0) return;

            const newPoints = activeArc.filter((_, i) => i !== index);
            handleUpdate(newPoints);
            return;
        }

        setActivePoint({ index, type: selectedCurve });
        setIsDragging(true);
    };

    const handleFilmstripClick = (index: number) => {
        if (activeShots.length === 0) return;
        const progress = (index / activeShots.length) * 100 + (100 / activeShots.length) / 2; // Center of shot
        setCursorProgress(progress);
    };

    const selectedPointIndex = activePoint?.index;

    // --- Key Listeners ---
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'n') keysPressed.current.n = true;
            if (e.key.toLowerCase() === 'd') keysPressed.current.d = true;
            if (e.key === 'Shift') keysPressed.current.shift = true;
        };
        const up = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'n') keysPressed.current.n = false;
            if (e.key.toLowerCase() === 'd') keysPressed.current.d = false;
            if (e.key === 'Shift') keysPressed.current.shift = false;
        };
        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);
        return () => {
            window.removeEventListener('keydown', down);
            window.removeEventListener('keyup', up);
        };
    }, []);

    // Assuming this is the main component's return statement
    return (
        <div className="flex flex-col gap-4 p-4">
            {/* Header & Filters */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-gray-800 p-4 rounded-xl border border-gray-700">
                <div className="flex items-center gap-4">
                    <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700">
                        {(['series', 'episode', 'scene'] as Scope[]).map((s) => (
                            <button
                                key={s}
                                onClick={() => setScope(s)}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${scope === s ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                            >
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                            </button>
                        ))}
                    </div>

                    {scope !== 'series' && (
                        <div className="flex items-center gap-2">
                            <ChevronRightIcon className="w-4 h-4 text-gray-500" />
                            <select
                                value={selectedEpisodeId || ''}
                                onChange={(e) => {
                                    const id = Number(e.target.value);
                                    setSelectedEpisodeId(id);
                                    // Reset scene when episode changes
                                    if (projectState.episodes.find(ep => ep.id === id)?.scenes.length) {
                                        setSelectedSceneId(projectState.episodes.find(ep => ep.id === id)!.scenes[0].id);
                                    }
                                }}
                                className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="" disabled>Select Episode</option>
                                {projectState.episodes.map(ep => (
                                    <option key={ep.id} value={ep.id}>Episode {ep.id}: {ep.title}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {scope === 'scene' && currentEpisode && (
                        <div className="flex items-center gap-2">
                            <ChevronRightIcon className="w-4 h-4 text-gray-500" />
                            <select
                                value={selectedSceneId || ''}
                                onChange={(e) => setSelectedSceneId(Number(e.target.value))}
                                className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="" disabled>Select Scene</option>
                                {currentEpisode.scenes.map(s => (
                                    <option key={s.id} value={s.id}>Scene {s.id}: {s.title}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700 mr-2">
                        {(['tension', 'emotion', 'conflict'] as const).map((c) => (
                            <button
                                key={c}
                                onClick={() => setSelectedCurve(c)}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${selectedCurve === c ?
                                    (c === 'tension' ? 'bg-red-500 text-white' : c === 'emotion' ? 'bg-cyan-500 text-white' : 'bg-yellow-500 text-white')
                                    : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => setIsRewriting(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                        <WandIcon className="w-4 h-4" />
                        <span>AI Reconstruct</span>
                    </button>
                </div>
            </div>

            {/* Arc Editor Area */}
            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                <div className="flex items-center gap-2 mb-3 text-gray-400 text-sm">
                    <SparklesIcon className="w-4 h-4" />
                    <span>Narrative Arc ({scope.charAt(0).toUpperCase() + scope.slice(1)} Scope)</span>
                </div>
                <div className="relative" style={{ width: width, height: height }}>
                    <svg
                        ref={svgRef}
                        width={width}
                        height={height}
                        className="bg-gray-900 rounded-lg border border-gray-700"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    >
                        <defs>
                            <linearGradient id="arcGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor={selectedCurve === 'tension' ? '#ef4444' : selectedCurve === 'emotion' ? '#06b6d4' : '#f59e0b'} />
                                <stop offset="100%" stopColor={selectedCurve === 'tension' ? '#b91c1c' : selectedCurve === 'emotion' ? '#0891b2' : '#d97706'} />
                            </linearGradient>
                        </defs>

                        {/* Grid Lines */}
                        {Array.from({ length: 11 }).map((_, i) => {
                            const y = padding + i * ((height - 2 * padding) / 10);
                            return (
                                <line
                                    key={`grid - h - ${i} `}
                                    x1={padding}
                                    y1={y}
                                    x2={width - padding}
                                    y2={y}
                                    stroke="#374151"
                                    strokeWidth="0.5"
                                />
                            );
                        })}
                        {Array.from({ length: 11 }).map((_, i) => {
                            const x = padding + i * ((width - 2 * padding) / 10);
                            return (
                                <line
                                    key={`grid - v - ${i} `}
                                    x1={x}
                                    y1={padding}
                                    x2={x}
                                    y2={height - padding}
                                    stroke="#374151"
                                    strokeWidth="0.5"
                                />
                            );
                        })}

                        {/* Arc Path */}
                        <path
                            d={arcPath}
                            fill="none"
                            stroke="url(#arcGradient)"
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />

                        {/* Arc Points */}
                        {activeArc.map((point, index) => {
                            const { x, y } = getCoordinates(point.x || 0, point[selectedCurve] || 0);
                            const isSelected = selectedPointIndex === index;
                            return (
                                <circle
                                    key={point.id}
                                    cx={x}
                                    cy={y}
                                    r={isSelected ? 8 : 6}
                                    fill={isSelected ? 'white' : (selectedCurve === 'tension' ? '#ef4444' : selectedCurve === 'emotion' ? '#06b6d4' : '#f59e0b')}
                                    stroke={isSelected ? (selectedCurve === 'tension' ? '#ef4444' : selectedCurve === 'emotion' ? '#06b6d4' : '#f59e0b') : 'white'}
                                    strokeWidth={isSelected ? 3 : 1.5}
                                    className="cursor-grab transition-all duration-100 ease-out"
                                    onMouseDown={(e) => handlePointMouseDown(e, index)}
                                />
                            );
                        })}

                        {/* Cursor Line */}
                        <line
                            x1={getCoordinates(cursorProgress, 0).x}
                            y1={padding}
                            x2={getCoordinates(cursorProgress, 0).x}
                            y2={height - padding}
                            stroke="white"
                            strokeWidth="2"
                            strokeDasharray="4"
                            className="pointer-events-none"
                        />
                    </svg>
                </div>
            </div>

            {/* Filmstrip Area */}
            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                <div className="flex items-center gap-2 mb-3 text-gray-400 text-sm">
                    <FilmIcon className="w-4 h-4" />
                    <span>Visual Timeline ({activeShots.length} Shots)</span>
                </div>

                <div
                    ref={filmstripRef}
                    className="flex gap-2 overflow-x-auto pb-4 custom-scrollbar scroll-smooth"
                >
                    {activeShots.length > 0 ? activeShots.map((shot, idx) => {
                        const pos = shotPositions.find(p => p.id === shot.id);
                        const isActive = pos && cursorProgress >= pos.start && cursorProgress < pos.end;

                        return (
                            <div
                                key={shot.id}
                                onClick={() => handleFilmstripClick(idx)}
                                className={`flex-shrink-0 w-40 aspect-video bg-gray-900 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${isActive ? 'border-indigo-500 scale-105 shadow-lg shadow-indigo-500/20' : 'border-transparent opacity-60 hover:opacity-100'}`}
                            >
                                {shot.imageUrl ? (
                                    <img src={shot.imageUrl} alt={shot.description} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-600 p-2 text-center">
                                        {shot.description || "No Image"}
                                    </div>
                                )}
                            </div>
                        );
                    }) : (
                        <div className="w-full h-24 flex items-center justify-center text-gray-500 text-sm italic">
                            No shots available for this scope.
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
};
