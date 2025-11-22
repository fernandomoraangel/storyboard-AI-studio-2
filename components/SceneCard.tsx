import React, { useState, ChangeEvent, useRef } from 'react';
import type { Scene, Character, Shot, StoryboardStyle } from '../types';
import { TrashIcon, ChevronDownIcon, PlusIcon, GripVerticalIcon } from './icons';
import { useLanguage } from '../contexts/languageContext';
import { ShotCard } from './ShotCard';

const TextAreaField: React.FC<{ label: string; value: string; onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void; name: string; rows?: number; placeholder?: string }> = ({ label, rows = 2, ...props }) => (
  <div>
    <label className="block text-sm font-medium text-gray-400 mb-1">{label}</label>
    <textarea
      className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
      rows={rows}
      {...props}
    />
  </div>
);

interface SceneCardProps {
  scene: Scene;
  sceneNumber: number;
  characters: Character[];
  updateSceneDetails: (sceneId: number, details: Partial<Scene>) => void;
  deleteScene: (sceneId: number) => void;
  addShot: (sceneId: number) => void;
  updateShot: (sceneId: number, updatedShot: Shot) => void;
  deleteShot: (sceneId: number, shotId: number) => void;
  isLastScene: boolean;
  storyboardStyle: StoryboardStyle;
  aspectRatio: string;
  reorderShots: (sceneId: number, startIndex: number, endIndex: number) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
}

export const SceneCard: React.FC<SceneCardProps> = ({ scene, sceneNumber, characters, updateSceneDetails, deleteScene, addShot, updateShot, deleteShot, isLastScene, storyboardStyle, aspectRatio, reorderShots, isExpanded, onToggleExpand, isDragging, onDragStart, onDragEnd }) => {
  const { t, options } = useLanguage();

  const handleSceneChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    updateSceneDetails(scene.id, { [e.target.name]: e.target.value });
  };
  
  const handleUpdateShot = (updatedShot: Shot) => {
    updateShot(scene.id, updatedShot);
  };
  
  const handleDeleteShot = (shotId: number) => {
    deleteShot(scene.id, shotId);
  };
  
  const sceneDuration = scene.shots.reduce((total, shot) => total + (shot.duration || 0), 0);
  const formatDuration = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '0s';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}${t('secondsAbbr')}`;
    }
    return `${remainingSeconds}${t('secondsAbbr')}`;
  };

  const shotDragItemIndex = useRef<number | null>(null);
  const shotDragOverItemIndex = useRef<number | null>(null);
  const [isShotDragging, setIsShotDragging] = useState(false);

  const handleShotDragStart = (e: React.DragEvent, index: number) => {
    e.stopPropagation();
    shotDragItemIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => setIsShotDragging(true), 0);
  };
  
  const handleShotDragEnter = (index: number) => {
    shotDragOverItemIndex.current = index;
  };

  const handleShotDragEnd = (e: React.DragEvent) => {
    e.stopPropagation();
    if (shotDragItemIndex.current !== null && shotDragOverItemIndex.current !== null && shotDragItemIndex.current !== shotDragOverItemIndex.current) {
        reorderShots(scene.id, shotDragItemIndex.current, shotDragOverItemIndex.current);
    }
    shotDragItemIndex.current = null;
    shotDragOverItemIndex.current = null;
    setIsShotDragging(false);
  };

  return (
    <div className={`bg-gray-800/50 rounded-lg shadow-lg overflow-hidden border border-gray-700 ${isDragging ? 'dragging-item' : ''}`} onDragOver={(e) => e.preventDefault()}>
      <div 
        className="p-4 bg-gray-800/30 flex items-center gap-2"
      >
        <div 
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            className="p-2 drag-handle text-gray-500 hover:text-white"
            title={t('dragToReorder')}
        >
            <GripVerticalIcon className="w-5 h-5" />
        </div>
        <div className="flex-1 cursor-pointer" onClick={onToggleExpand}>
            <div className="flex justify-between items-start">
                <div className="flex-1 mr-4">
                  <h3 className="text-xl font-bold text-white flex-1">
                      {t('scene')} {sceneNumber}: <input type="text" name="title" value={scene.title} onChange={handleSceneChange} onClick={(e) => e.stopPropagation()} className="bg-transparent border-b border-gray-600 focus:border-indigo-500 focus:outline-none w-2/3"/>
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider">{t('duration')}: {formatDuration(sceneDuration)}</p>
                </div>
                <div className="flex items-center space-x-2">
                    <button onClick={(e) => { e.stopPropagation(); deleteScene(scene.id); }} className="text-red-500 hover:text-red-400 transition-colors">
                        <TrashIcon className="w-5 h-5" />
                    </button>
                    <ChevronDownIcon className={`w-6 h-6 text-gray-400 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
            </div>
        </div>
      </div>
      
      <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[10000px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="p-6 space-y-6">
            <TextAreaField
                label={t('characters')}
                name="characters"
                value={scene.characters}
                onChange={handleSceneChange}
                rows={2}
                placeholder={t('charactersPlaceholder')}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextAreaField 
                label={t('setting')} 
                name="setting" 
                value={scene.setting} 
                onChange={handleSceneChange} 
                rows={3} 
                placeholder={t('settingPlaceholder')}
              />
              <TextAreaField 
                label={t('location')} 
                name="location" 
                value={scene.location} 
                onChange={handleSceneChange} 
                rows={3}
                placeholder={t('locationPlaceholder')}
              />
            </div>
            
            <div>
              <div className="flex justify-between items-baseline mb-1">
                <label className="block text-sm font-medium text-gray-400">{t('dialogueNarration')}</label>
                <select
                  name="dialogueType"
                  value={scene.dialogueType}
                  onChange={handleSceneChange}
                  className="text-xs rounded border-0 bg-white/5 py-0.5 px-2 text-gray-300 ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                >
                  <option value="dialogue">{t('withDialogue')}</option>
                  <option value="mos">{t('mosSilent')}</option>
                </select>
              </div>
              <TextAreaField
                label=""
                name="dialogue"
                value={scene.dialogue}
                onChange={handleSceneChange}
                rows={5}
                placeholder={scene.dialogueType === 'mos' ? t('silentPlaceholder') : t('dialoguePlaceholder')}
              />
            </div>
            
            <div>
                <TextAreaField
                    label={t('musicPrompt')}
                    name="musicPrompt"
                    value={scene.musicPrompt}
                    onChange={handleSceneChange}
                    rows={4}
                    placeholder={t('musicPromptPlaceholder')}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextAreaField
                    label={t('keyObjects')}
                    name="keyObjects"
                    value={scene.keyObjects}
                    onChange={handleSceneChange}
                    rows={3}
                    placeholder={t('keyObjectsPlaceholder')}
                />
                <TextAreaField
                    label={t('actions')}
                    name="actions"
                    value={scene.actions}
                    onChange={handleSceneChange}
                    rows={3}
                    placeholder={t('actionsPlaceholder')}
                />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextAreaField
                    label={t('tone')}
                    name="tone"
                    value={scene.tone}
                    onChange={handleSceneChange}
                    rows={2}
                    placeholder={t('tonePlaceholder')}
                />
                <TextAreaField
                    label={t('notes')}
                    name="notes"
                    value={scene.notes}
                    onChange={handleSceneChange}
                    rows={2}
                    placeholder={t('notesPlaceholder')}
                />
            </div>

            <div className="border-t border-gray-700 pt-6 space-y-6">
              {scene.shots.map((shot, index) => (
                <div 
                    key={shot.id}
                    className={`relative ${shotDragOverItemIndex.current === index && isShotDragging ? 'drag-over-placeholder' : ''}`}
                    onDragEnter={() => handleShotDragEnter(index)}
                >
                    <ShotCard
                      shot={shot}
                      shotNumber={index + 1}
                      scene={scene}
                      characters={characters}
                      updateShot={handleUpdateShot}
                      deleteShot={handleDeleteShot}
                      isLastShot={scene.shots.length === 1}
                      storyboardStyle={storyboardStyle}
                      aspectRatio={aspectRatio}
                      isDragging={isShotDragging && shotDragItemIndex.current === index}
                      onDragStart={(e) => handleShotDragStart(e, index)}
                      onDragEnd={handleShotDragEnd}
                    />
                </div>
              ))}
            </div>

            <div className="flex justify-center">
              <button onClick={() => addShot(scene.id)} className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-dashed border-gray-600 bg-transparent hover:bg-gray-700 h-10 px-4 py-2 text-blue-400 hover:text-blue-300">
                  <PlusIcon className="w-4 h-4 mr-2" /> {t('addShot')}
              </button>
            </div>
          </div>

          {!isLastScene && (
            <div className="border-t border-gray-700 px-6 py-4 bg-gray-900/20">
              <div className="flex items-center justify-center gap-4">
                <div className="flex-1 border-t border-dashed border-gray-600"></div>
                <div className="flex items-center gap-3">
                  <label htmlFor={`transition-${scene.id}`} className="text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    {t('transitionToNextScene')}
                  </label>
                  <select
                    id={`transition-${scene.id}`}
                    name="transitionType"
                    value={scene.transitionType}
                    onChange={handleSceneChange}
                    className="block w-full rounded-md border-0 bg-white/5 py-1.5 pl-3 pr-8 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                  >
                    {options.transitionTypeOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="flex-1 border-t border-dashed border-gray-600"></div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
};