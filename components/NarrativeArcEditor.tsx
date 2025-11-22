
import React, { useState, useRef, useEffect } from 'react';
import { ArcPoint, ProjectState } from '../types';
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

export const NarrativeArcEditor: React.FC<NarrativeArcEditorProps> = ({ 
    arc, setArc, currentLogline, currentTreatment, currentEpisodes, onStoryUpdated 
}) => {
    const { t, language } = useLanguage();
    const svgRef = useRef<SVGSVGElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [activePoint, setActivePoint] = useState<{ index: number; type: 'tension' | 'emotion' | 'conflict' } | null>(null);
    const [isRewriting, setIsRewriting] = useState(false);

    const padding = 40;
    const height = 400;
    const width = 800; // internal SVG coordinate space width
    
    const getCoordinates = (index: number, value: number) => {
        const x = padding + (index / (arc.length - 1)) * (width - 2 * padding);
        const y = height - padding - (value / 10) * (height - 2 * padding);
        return { x, y };
    };

    const handleMouseDown = (index: number, type: 'tension' | 'emotion' | 'conflict') => {
        setIsDragging(true);
        setActivePoint({ index, type });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !activePoint || !svgRef.current) return;

        const svgRect = svgRef.current.getBoundingClientRect();
        const relativeY = e.clientY - svgRect.top;
        
        // Map relativeY back to 0-10 scale
        // y = height - padding - (value / 10) * innerHeight
        // value = 10 * (height - padding - y) / innerHeight
        
        // We need to account for SVG scaling if the rendered size != internal size
        const scaleY = height / svgRect.height;
        const scaledY = relativeY * scaleY;
        
        const innerHeight = height - 2 * padding;
        let newValue = 10 * (height - padding - scaledY) / innerHeight;
        
        newValue = Math.max(0, Math.min(10, newValue));
        
        const newArc = [...arc];
        newArc[activePoint.index] = {
            ...newArc[activePoint.index],
            [activePoint.type]: Number(newValue.toFixed(1))
        };
        
        setArc(newArc);
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setActivePoint(null);
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

    // Render paths
    const renderPath = (type: 'tension' | 'emotion' | 'conflict', color: string) => {
        if (arc.length === 0) return null;
        const d = arc.map((point, i) => {
            const { x, y } = getCoordinates(i, point[type]);
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ');
        return <path d={d} fill="none" stroke={color} strokeWidth="3" />;
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
             <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <RefreshCwIcon className="w-6 h-6 text-indigo-400" />
                            {t('narrativeArcTitle')}
                        </h2>
                        <p className="text-gray-400 text-sm mt-1">{t('narrativeArcDescription')}</p>
                    </div>
                    <div className="flex gap-4 text-sm">
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
                </div>

                {arc.length > 0 ? (
                    <div className="w-full overflow-x-auto">
                        <svg 
                            ref={svgRef}
                            viewBox={`0 0 ${width} ${height}`} 
                            className="w-full h-auto bg-gray-900/50 rounded-lg cursor-crosshair select-none min-w-[600px]"
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                        >
                            {/* Grid Lines */}
                            {[0, 2.5, 5, 7.5, 10].map(val => {
                                const y = height - padding - (val / 10) * (height - 2 * padding);
                                return (
                                    <g key={val}>
                                        <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#374151" strokeWidth="1" strokeDasharray="4" />
                                        <text x={padding - 10} y={y + 4} fill="#6B7280" fontSize="12" textAnchor="end">{val}</text>
                                    </g>
                                );
                            })}

                            {/* Lines */}
                            {renderPath('tension', '#ef4444')}
                            {renderPath('emotion', '#06b6d4')}
                            {renderPath('conflict', '#f59e0b')}

                            {/* Interactive Points */}
                            {arc.map((point, i) => {
                                const tCoord = getCoordinates(i, point.tension);
                                const eCoord = getCoordinates(i, point.emotion);
                                const cCoord = getCoordinates(i, point.conflict);
                                return (
                                    <g key={point.id}>
                                        {/* Tension Point */}
                                        <circle 
                                            cx={tCoord.x} cy={tCoord.y} r="6" fill="#ef4444" stroke="white" strokeWidth="2"
                                            className="cursor-grab hover:scale-125 transition-transform"
                                            onMouseDown={() => handleMouseDown(i, 'tension')}
                                        />
                                        {/* Emotion Point */}
                                        <circle 
                                            cx={eCoord.x} cy={eCoord.y} r="6" fill="#06b6d4" stroke="white" strokeWidth="2"
                                            className="cursor-grab hover:scale-125 transition-transform"
                                            onMouseDown={() => handleMouseDown(i, 'emotion')}
                                        />
                                        {/* Conflict Point */}
                                        <circle 
                                            cx={cCoord.x} cy={cCoord.y} r="6" fill="#f59e0b" stroke="white" strokeWidth="2"
                                            className="cursor-grab hover:scale-125 transition-transform"
                                            onMouseDown={() => handleMouseDown(i, 'conflict')}
                                        />
                                        
                                        {/* X-Axis Label */}
                                        <text x={tCoord.x} y={height - 10} fill="#9CA3AF" fontSize="12" textAnchor="middle">{point.label}</text>
                                        <line x1={tCoord.x} y1={height-padding} x2={tCoord.x} y2={padding} stroke="#374151" strokeWidth="1" strokeDasharray="2" opacity="0.3"/>
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
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 h-10 px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {isRewriting ? <LoadingSpinner /> : <WandIcon className="w-4 h-4 mr-2" />}
                        {isRewriting ? t('rewritingStory') : t('rewriteStoryFromArc')}
                    </button>
                </div>
             </div>
        </div>
    );
};
