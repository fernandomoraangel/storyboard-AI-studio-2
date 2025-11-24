
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ArcPoint } from '../types';
import { updateStoryFromArc } from '../services/geminiService';
import { useLanguage } from '../contexts/languageContext';
import { RefreshCwIcon, WandIcon } from './icons';
import { LoadingSpinner } from './LoadingSpinner';

interface NarrativeArcEditorProps {
    arc: ArcPoint[];
    setArc: (arc: ArcPoint[]) => void;
    currentLogline: string;
    currentTreatment: string;
    currentEpisodes: { title: string; synopsis: string }[];
    onStoryUpdated: (newLogline: string, newTreatment: string, newEpisodes: { title: string; synopsis: string }[]) => void;
}

type CurveType = 'linear' | 'natural' | 'step';

// Helper for Catmull-Rom interpolation
function interpolateSpline(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const v0 = (p2 - p0) * 0.5;
    const v1 = (p3 - p1) * 0.5;
    const t2 = t * t;
    const t3 = t * t2;
    return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1;
}

// Helper for Linear Interpolation
function interpolateLinear(y1: number, y2: number, t: number): number {
    return y1 + (y2 - y1) * t;
}

export const NarrativeArcEditor: React.FC<NarrativeArcEditorProps> = ({ 
    arc, setArc, currentLogline, currentTreatment, currentEpisodes, onStoryUpdated 
}) => {
    const { t, language } = useLanguage();
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    
    const [isDragging, setIsDragging] = useState(false);
    const [activePoint, setActivePoint] = useState<{ index: number; type: 'tension' | 'emotion' | 'conflict' } | null>(null);
    const [isRewriting, setIsRewriting] = useState(false);
    const [curveType, setCurveType] = useState<CurveType>('natural');
    
    const keysPressed = useRef<{ n: boolean; d: boolean; shift: boolean }>({ n: false, d: false, shift: false });

    const padding = 40;
    const height = 400;
    const width = 800; // internal SVG coordinate space width

    // Initialize X coordinates if missing (legacy support)
    useEffect(() => {
        if (arc.length > 0 && arc.some(p => p.x === undefined)) {
            const newArc = arc.map((p, i) => ({
                ...p,
                x: (i / (arc.length - 1 || 1)) * 100,
                modifiedCurves: undefined, // Legacy points show all
                isEpisodeAnchor: true // Assume initial points are anchors
            }));
            setArc(newArc);
        }
    }, [arc.length]);

    // Key Tracking
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

    const points = useMemo(() => {
        return arc.map((p, i) => ({
            ...p,
            x: p.x !== undefined ? p.x : (i / (arc.length - 1 || 1)) * 100
        })).sort((a, b) => (a.x || 0) - (b.x || 0));
    }, [arc]);

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

    const handleReset = () => {
        // Restore arc based on current episode count
        const count = currentEpisodes.length > 0 ? currentEpisodes.length : 3;
        const newArc: ArcPoint[] = [];
        
        for (let i = 0; i < count; i++) {
            const x = count > 1 ? (i / (count - 1)) * 100 : 50;
            // Create a default "Rising Action" curve
            const progress = i / Math.max(1, count - 1);
            
            newArc.push({
                id: Date.now() + i,
                label: currentEpisodes[i]?.title || `${t('episode')} ${i + 1}`,
                x: Number(x.toFixed(1)),
                tension: Number((2 + progress * 6).toFixed(1)), // 2 -> 8
                conflict: Number((1 + progress * 7).toFixed(1)), // 1 -> 8
                emotion: 5, // Flat emotion
                modifiedCurves: ['tension', 'emotion', 'conflict'],
                isEpisodeAnchor: true
            });
        }
        setArc(newArc);
    };

    const handleSvgClick = (e: React.MouseEvent) => {
        // Add Node Logic: Shift + N + Click
        if (keysPressed.current.shift && keysPressed.current.n && svgRef.current) {
            const rect = svgRef.current.getBoundingClientRect();
            const scaleX = width / rect.width;
            const scaleY = height / rect.height;
            const svgX = (e.clientX - rect.left) * scaleX;
            const svgY = (e.clientY - rect.top) * scaleY;
            
            const { x, value } = getValueFromCoordinates(svgX, svgY);
            
            // Calculate interpolated values for ALL curves at this X
            const interpolatedValues = { tension: 0, emotion: 0, conflict: 0 };
            (['tension', 'emotion', 'conflict'] as const).forEach(prop => {
                const sortedPoints = [...points].sort((a, b) => (a.x || 0) - (b.x || 0));
                let idx = sortedPoints.findIndex(p => (p.x || 0) >= x);
                if (idx === -1) idx = sortedPoints.length;
                
                const p1 = sortedPoints[Math.max(0, idx - 1)];
                const p2 = sortedPoints[Math.min(idx, sortedPoints.length - 1)];
                
                if (p1 && p2 && p1 !== p2) {
                    const range = (p2.x || 0) - (p1.x || 0);
                    const t = ((x - (p1.x || 0)) / range);
                    
                    if (curveType === 'linear' || curveType === 'step') {
                        interpolatedValues[prop] = interpolateLinear(p1[prop], p2[prop], t);
                    } else {
                        const p0 = sortedPoints[Math.max(0, idx - 2)];
                        const p3 = sortedPoints[Math.min(idx + 1, sortedPoints.length - 1)];
                        interpolatedValues[prop] = interpolateSpline(p0[prop], p1[prop], p2[prop], p3[prop], t);
                    }
                } else if (p1) {
                    interpolatedValues[prop] = p1[prop];
                } else {
                    interpolatedValues[prop] = 5; 
                }
            });

            // Determine closest curve to click
            const distances = [
                { type: 'tension', dist: Math.abs(value - interpolatedValues.tension) },
                { type: 'emotion', dist: Math.abs(value - interpolatedValues.emotion) },
                { type: 'conflict', dist: Math.abs(value - interpolatedValues.conflict) }
            ];
            distances.sort((a, b) => a.dist - b.dist);
            const targetCurve = distances[0].type as 'tension' | 'emotion' | 'conflict';

            // CHECK FOR NEARBY POINT (within 2% tolerance)
            const nearbyIndex = points.findIndex(p => Math.abs((p.x || 0) - x) < 2);

            if (nearbyIndex !== -1) {
                // Update existing point
                const newArc = [...points];
                const pt = newArc[nearbyIndex];
                
                // Update value for the clicked curve
                pt[targetCurve] = Number(value.toFixed(1));
                
                // Reveal this curve's node
                const currentCurves = pt.modifiedCurves || ['tension', 'emotion', 'conflict'];
                if (!currentCurves.includes(targetCurve)) {
                    pt.modifiedCurves = [...currentCurves, targetCurve];
                }
                
                setArc(newArc);
            } else {
                // Create new point (Intermediate Beat)
                const newPoint: ArcPoint = {
                    id: Date.now(),
                    label: `Beat`,
                    x: Number(x.toFixed(1)),
                    tension: targetCurve === 'tension' ? Number(value.toFixed(1)) : Number(interpolatedValues.tension.toFixed(1)),
                    emotion: targetCurve === 'emotion' ? Number(value.toFixed(1)) : Number(interpolatedValues.emotion.toFixed(1)),
                    conflict: targetCurve === 'conflict' ? Number(value.toFixed(1)) : Number(interpolatedValues.conflict.toFixed(1)),
                    modifiedCurves: [targetCurve], // Only visible on the target curve
                    isEpisodeAnchor: false // Mark as intermediate
                };

                // Clamp values
                newPoint.tension = Math.max(0, Math.min(10, newPoint.tension));
                newPoint.emotion = Math.max(0, Math.min(10, newPoint.emotion));
                newPoint.conflict = Math.max(0, Math.min(10, newPoint.conflict));

                const newArc = [...arc, newPoint].sort((a, b) => (a.x || 0) - (b.x || 0));
                setArc(newArc);
            }
        }
    };

    const handleMouseDown = (index: number, type: 'tension' | 'emotion' | 'conflict', e: React.MouseEvent) => {
        e.stopPropagation();
        
        // Delete Logic: Shift + D + Click (on node)
        if (keysPressed.current.shift && keysPressed.current.d) {
            const targetPoint = points[index];
            const currentCurves = targetPoint.modifiedCurves || ['tension', 'emotion', 'conflict'];
            
            // 1. Remove the specific curve from visibility
            const newCurves = currentCurves.filter(c => c !== type);
            
            if (newCurves.length > 0) {
                // Point still has other curves, just update modifiedCurves
                const newArc = [...points];
                newArc[index] = { ...targetPoint, modifiedCurves: newCurves as ('tension' | 'emotion' | 'conflict')[] };
                setArc(newArc);
            } else {
                // No curves left on this point.
                // If it's an Episode Anchor, we generally keep it but hidden? 
                // Or if user explicitly deletes all nodes on an anchor, maybe they want it gone (e.g. deleting an ep?)
                // For safety, if it's an anchor, we might want to keep the point object but with empty curves? 
                // Actually, let's allow full deletion. If the user deletes the anchor points, they are reshaping the arc.
                const newArc = points.filter((_, i) => i !== index);
                setArc(newArc);
            }
            return;
        }

        setIsDragging(true);
        setActivePoint({ index, type });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !activePoint || !svgRef.current) return;

        const rect = svgRef.current.getBoundingClientRect();
        const scaleX = width / rect.width;
        const scaleY = height / rect.height;
        
        const svgX = (e.clientX - rect.left) * scaleX;
        const svgY = (e.clientY - rect.top) * scaleY;
        
        const { x, value } = getValueFromCoordinates(svgX, svgY);
        
        const newArc = [...points]; 
        const point = newArc[activePoint.index];
        
        // Update Value (Y)
        newArc[activePoint.index] = {
            ...point,
            [activePoint.type]: Number(value.toFixed(1))
        };

        // Update Position (X) - Lock X if it is an Episode Anchor
        if (!point.isEpisodeAnchor) {
            newArc[activePoint.index].x = Number(x.toFixed(1));
        }

        setArc(newArc);
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setActivePoint(null);
        const sorted = [...points].sort((a, b) => (a.x || 0) - (b.x || 0));
        setArc(sorted);
    };

    const handleRewrite = async () => {
        if (arc.length === 0) return;
        setIsRewriting(true);
        try {
            const result = await updateStoryFromArc(currentLogline, currentTreatment, currentEpisodes, arc, language);
            onStoryUpdated(result.logline, result.treatment, result.episodes);
        } catch (error) {
            console.error("Rewrite failed:", error);
            alert(t('storyGenerationError', { message: (error as Error).message }));
        } finally {
            setIsRewriting(false);
        }
    };

    const getPathData = (prop: 'tension' | 'emotion' | 'conflict') => {
        if (points.length === 0) return "";

        const coords = points.map(p => getCoordinates(p.x || 0, p[prop]));

        if (points.length === 1) return `M ${coords[0].x} ${coords[0].y}`;

        if (curveType === 'linear') {
            return coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        }
        
        if (curveType === 'step') {
            let path = `M ${coords[0].x} ${coords[0].y}`;
            for (let i = 0; i < coords.length - 1; i++) {
                path += ` H ${coords[i+1].x} V ${coords[i+1].y}`;
            }
            return path;
        }

        // Catmull-Rom Spline conversion to Cubic Bezier
        let path = `M ${coords[0].x} ${coords[0].y}`;
        
        for (let i = 0; i < coords.length - 1; i++) {
            const p0 = coords[Math.max(i - 1, 0)];
            const p1 = coords[i];
            const p2 = coords[i + 1];
            const p3 = coords[Math.min(i + 2, coords.length - 1)];

            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;

            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;

            path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
        }

        return path;
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto" ref={containerRef}>
             <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <RefreshCwIcon className="w-6 h-6 text-indigo-400" />
                            {t('narrativeArcTitle')}
                        </h2>
                        <p className="text-gray-400 text-sm mt-1">
                            {t('narrativeArcDescription')} 
                            <span className="block text-xs text-gray-500 mt-1">
                                Shift + N + Click to Add Node | Shift + D + Click Node to Delete
                            </span>
                        </p>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <button onClick={handleReset} className="px-3 py-1.5 bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded text-xs font-bold uppercase tracking-wider border border-red-900/50 transition-colors">
                            {t('resetArc')}
                        </button>
                        <div className="flex items-center gap-2 bg-gray-900/50 p-2 rounded-lg">
                            <div className="flex gap-2 text-xs font-bold uppercase tracking-wider">
                                <button onClick={() => setCurveType('linear')} className={`px-2 py-1 rounded ${curveType === 'linear' ? 'bg-gray-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Linear</button>
                                <button onClick={() => setCurveType('natural')} className={`px-2 py-1 rounded ${curveType === 'natural' ? 'bg-gray-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Natural</button>
                                <button onClick={() => setCurveType('step')} className={`px-2 py-1 rounded ${curveType === 'step' ? 'bg-gray-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Step</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-6 mb-4 text-sm justify-center">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <span className="text-gray-300">{t('arcTension')}</span>
                    </div>
                        <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
                        <span className="text-gray-300">{t('arcEmotion')}</span>
                    </div>
                        <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <span className="text-gray-300">{t('arcConflict')}</span>
                    </div>
                </div>

                {arc.length > 0 ? (
                    <div className="w-full overflow-x-auto relative select-none">
                        <svg 
                            ref={svgRef}
                            viewBox={`0 0 ${width} ${height}`} 
                            className="w-full h-auto bg-gray-900/50 rounded-lg cursor-crosshair min-w-[600px]"
                            onClick={handleSvgClick}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                        >
                            {/* Background Grid */}
                            {[0, 2.5, 5, 7.5, 10].map(val => {
                                const y = height - padding - (val / 10) * (height - 2 * padding);
                                return (
                                    <g key={val}>
                                        <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#374151" strokeWidth="1" strokeDasharray="4" />
                                        <text x={padding - 10} y={y + 4} fill="#6B7280" fontSize="12" textAnchor="end">{val}</text>
                                    </g>
                                );
                            })}
                            
                            {/* Vertical Grid (Time) */}
                            {[0, 25, 50, 75, 100].map(val => {
                                const x = padding + (val / 100) * (width - 2 * padding);
                                return (
                                    <line key={`v-${val}`} x1={x} y1={padding} x2={x} y2={height - padding} stroke="#374151" strokeWidth="1" strokeDasharray="4" opacity="0.3" />
                                );
                            })}

                            {/* Paths */}
                            <path d={getPathData('tension')} fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none" />
                            <path d={getPathData('emotion')} fill="none" stroke="#06b6d4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none" />
                            <path d={getPathData('conflict')} fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none" />

                            {/* Interactive Points */}
                            {points.map((point, i) => {
                                const tCoord = getCoordinates(point.x || 0, point.tension);
                                const eCoord = getCoordinates(point.x || 0, point.emotion);
                                const cCoord = getCoordinates(point.x || 0, point.conflict);
                                
                                const isActiveTension = activePoint?.index === i && activePoint?.type === 'tension';
                                const isActiveEmotion = activePoint?.index === i && activePoint?.type === 'emotion';
                                const isActiveConflict = activePoint?.index === i && activePoint?.type === 'conflict';

                                const showTension = !point.modifiedCurves || point.modifiedCurves.includes('tension');
                                const showEmotion = !point.modifiedCurves || point.modifiedCurves.includes('emotion');
                                const showConflict = !point.modifiedCurves || point.modifiedCurves.includes('conflict');

                                return (
                                    <g key={point.id}>
                                        {/* Vertical Guide Line for Node (Only if dragging one of them or all visible) */}
                                        <line 
                                            x1={tCoord.x} y1={height - padding} x2={tCoord.x} y2={padding} 
                                            stroke={point.isEpisodeAnchor ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.05)"} 
                                            strokeWidth={point.isEpisodeAnchor ? 2 : 1} 
                                            strokeDasharray={point.isEpisodeAnchor ? "" : "4"}
                                            className="pointer-events-none"
                                        />

                                        {/* Tension Control */}
                                        {showTension && (
                                            <circle 
                                                cx={tCoord.x} cy={tCoord.y} r={isActiveTension ? 8 : 6} 
                                                fill="#ef4444" stroke="white" strokeWidth="2"
                                                className={`cursor-grab hover:r-8 transition-all ${point.isEpisodeAnchor ? '' : 'hover:fill-red-400'}`}
                                                onMouseDown={(e) => handleMouseDown(i, 'tension', e)}
                                            />
                                        )}
                                        {/* Emotion Control */}
                                        {showEmotion && (
                                            <circle 
                                                cx={eCoord.x} cy={eCoord.y} r={isActiveEmotion ? 8 : 6} 
                                                fill="#06b6d4" stroke="white" strokeWidth="2"
                                                className={`cursor-grab hover:r-8 transition-all ${point.isEpisodeAnchor ? '' : 'hover:fill-cyan-400'}`}
                                                onMouseDown={(e) => handleMouseDown(i, 'emotion', e)}
                                            />
                                        )}
                                        {/* Conflict Control */}
                                        {showConflict && (
                                            <circle 
                                                cx={cCoord.x} cy={cCoord.y} r={isActiveConflict ? 8 : 6} 
                                                fill="#f59e0b" stroke="white" strokeWidth="2"
                                                className={`cursor-grab hover:r-8 transition-all ${point.isEpisodeAnchor ? '' : 'hover:fill-yellow-400'}`}
                                                onMouseDown={(e) => handleMouseDown(i, 'conflict', e)}
                                            />
                                        )}
                                        
                                        {/* Label */}
                                        {(showTension || showEmotion || showConflict) && (
                                            <text 
                                                x={tCoord.x} 
                                                y={height - 15} 
                                                fill={point.isEpisodeAnchor ? "#FFFFFF" : "#9CA3AF"} 
                                                fontSize={point.isEpisodeAnchor ? "12" : "10"} 
                                                fontWeight={point.isEpisodeAnchor ? "bold" : "normal"}
                                                textAnchor="middle" 
                                                style={{ pointerEvents: 'none' }}
                                            >
                                                {point.label || (point.isEpisodeAnchor ? `${i + 1}` : '')}
                                            </text>
                                        )}
                                    </g>
                                );
                            })}
                        </svg>
                    </div>
                ) : (
                    <div className="text-center py-12 text-gray-500">
                        {t('arcNoData')}
                    </div>
                )}
                
                <div className="mt-6 flex justify-end">
                    <button 
                        onClick={handleRewrite} 
                        disabled={isRewriting || arc.length === 0}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 h-10 px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20"
                    >
                        {isRewriting ? <LoadingSpinner /> : <WandIcon className="w-4 h-4 mr-2" />}
                        {isRewriting ? t('rewritingStory') : t('rewriteStoryFromArc')}
                    </button>
                </div>
             </div>
        </div>
    );
};
