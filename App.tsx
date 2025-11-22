
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Storyboard } from './components/Storyboard';
import { ChatWidget } from './components/ChatWidget';
import { SeriesBible } from './components/SeriesBible';
import { EpisodeList } from './components/EpisodeList';
import { CharacterDesigner } from './components/CharacterDesigner';
import { StoryGenerator } from './components/StoryGenerator';
import { NarrativeArcEditor } from './components/NarrativeArcEditor';
import { VisualOrganizer } from './components/VisualOrganizer';
import type { Scene, Character, Reference, Shot, StoryboardStyle, ProjectMeta, CustomStyle, CustomStyleImage, Episode, ProjectState, ArcPoint } from './types';
import { FilmIcon, PlusIcon, DownloadIcon, UserIcon, BookOpenIcon, TrashIcon, FloppyDiskIcon, FolderOpenIcon, ShareIcon, WandIcon, VideoIcon, CheckCircleIcon, RowsIcon, ActivityIcon, LayoutGridIcon } from './components/icons';
import { createImagePromptForShot, generateImage, generateSynopsis, createCharacterImagePrompt, ensureStoryConsistency, modifyStory } from './services/geminiService';
import { exportStoryboardToPDF } from './services/pdfService';
import { translations, Language } from './lib/translations';
import { LanguageSelector } from './components/LanguageSelector';
import { LoadingSpinner } from './components/LoadingSpinner';
import { saveProject, getProjectsList, getProject, deleteProject, getCustomStyles, saveCustomStyle, deleteCustomStyle } from './lib/db';
import { FrameIOExportModal } from './components/FrameIOExportModal';
import { AnimaticExportModal } from './components/AnimaticExportModal';
import { ModificationModal, ModificationSettings } from './components/ModificationModal';
import { ModificationPreviewModal } from './components/ModificationPreviewModal';
import { ConsistencyModal, ConsistencySettings } from './components/ConsistencyModal';
import { LanguageContext } from './contexts/languageContext';
import { VideoGenerator } from './components/VideoGenerator';
import { PDFExportModal, PDFExportOptions } from './components/PDFExportModal';

type WorkflowPhase = 'bible' | 'arc' | 'organizer' | 'episodes' | 'storyboard' | 'generator' | 'export';

type GenerationJob = {
    type: 'character' | 'shot';
    id: number;
    parentId?: number; 
    name: string;
    prompt: string;
};

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const App: React.FC = () => {
  const [language, setLanguage] = useState<Language>('es');
  
  const t = useCallback((key: keyof typeof translations.en, replacements?: { [key: string]: string | number }): string => {
    const translationValue = translations[language][key] || translations.en[key];
    if (typeof translationValue !== 'string') return '';
    let translation = translationValue as string;
    if (replacements) {
      Object.entries(replacements).forEach(([placeholder, value]) => {
        const regex = new RegExp(`{${placeholder}}`, 'g');
        translation = translation.replace(regex, String(value));
      });
    }
    return translation;
  }, [language]);

  const options = translations[language].options;

  // Series Data
  const [seriesTitle, setSeriesTitle] = useState<string>('');
  const [authorName, setAuthorName] = useState<string>('');
  const [storyboardStyle, setStoryboardStyle] = useState<StoryboardStyle>('Cinematic');
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');
  
  // Bible Data
  const [logline, setLogline] = useState<string>('');
  const [structuralAnalysis, setStructuralAnalysis] = useState<string>('');
  const [treatment, setTreatment] = useState<string>('');
  const [subplots, setSubplots] = useState<string>('');
  const [soundtrackPrompt, setSoundtrackPrompt] = useState<string>('');
  const [references, setReferences] = useState<Reference[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [bibleTab, setBibleTab] = useState<'general' | 'characters' | 'style'>('general');
  const [narrativeArc, setNarrativeArc] = useState<ArcPoint[]>([]);
  
  // Episode Data
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [activeEpisodeId, setActiveEpisodeId] = useState<number | null>(null);

  // Workflow State
  const [workflowPhase, setWorkflowPhase] = useState<WorkflowPhase>('bible');
  const [selectedCustomStyleId, setSelectedCustomStyleId] = useState<number | null>(null);

  // Modals & Generators
  const [showMassGenConfirmModal, setShowMassGenConfirmModal] = useState<GenerationJob[] | null>(null);
  const [isMassGenerating, setIsMassGenerating] = useState(false);
  const [massGenProgress, setMassGenProgress] = useState({ current: 0, total: 0 });
  const [generationReport, setGenerationReport] = useState<{ successes: string[]; failures: { name: string; error: string }[] } | null>(null);

  const [currentProjectId, setCurrentProjectId] = useState<number | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const lastSavedState = useRef<string | null>(null);
  
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: string; payload?: any } | null>(null);

  const [showFrameIOModal, setShowFrameIOModal] = useState(false);
  const [showAnimaticModal, setShowAnimaticModal] = useState(false);
  const [showPDFModal, setShowPDFModal] = useState(false);
  
  // Co-Creation
  const [isCoCreating, setIsCoCreating] = useState(false);
  const [coCreationStatus, setCoCreationStatus] = useState<'loading' | 'success' | 'error' | null>(null);
  const [showConsistencyModal, setShowConsistencyModal] = useState(false);
  const [lastConsistencySettings, setLastConsistencySettings] = useState<ConsistencySettings | undefined>(undefined);
  const [showNoChangesModal, setShowNoChangesModal] = useState(false);
  const [showModificationModal, setShowModificationModal] = useState(false);
  const [isModifying, setIsModifying] = useState(false);
  const [lastModificationSettings, setLastModificationSettings] = useState<ModificationSettings | undefined>(undefined);
  const [pendingModification, setPendingModification] = useState<{ state: ProjectState; explanation: string } | null>(null);

  // State helper
  const gatherState = useCallback((): ProjectState => ({
      seriesTitle, authorName, storyboardStyle, aspectRatio, soundtrackPrompt, logline,
      structuralAnalysis, treatment, references, episodes, characters, subplots, narrativeArc
  }), [
      seriesTitle, authorName, storyboardStyle, aspectRatio, soundtrackPrompt, logline,
      structuralAnalysis, treatment, references, episodes, characters, subplots, narrativeArc
  ]);

  // Apply State
  const applyState = (state: ProjectState | null) => {
      setSeriesTitle(state?.seriesTitle || '');
      setAuthorName(state?.authorName || '');
      setStoryboardStyle(state?.storyboardStyle || 'Cinematic');
      setAspectRatio(state?.aspectRatio || '16:9');
      setSelectedCustomStyleId(null);
      setSoundtrackPrompt(state?.soundtrackPrompt || '');
      setLogline(state?.logline || '');
      setSubplots(state?.subplots || '');
      setStructuralAnalysis(state?.structuralAnalysis || '');
      setTreatment(state?.treatment || '');
      setReferences(state?.references || []);
      setCharacters(state?.characters || []);
      setNarrativeArc(state?.narrativeArc || []);
      
      // Handle legacy 'scenes' migration if necessary, otherwise use 'episodes'
      if (state && 'scenes' in state && (!state.episodes || state.episodes.length === 0)) {
          // Migrate old single-story project to Episode 1
          const legacyScenes = (state as any).scenes as Scene[];
          if (legacyScenes.length > 0) {
             setEpisodes([{
                 id: Date.now(),
                 title: 'Episode 1',
                 synopsis: 'Imported from legacy project',
                 scenes: legacyScenes
             }]);
             setActiveEpisodeId(null); // Force user to select
          } else {
             setEpisodes([]);
          }
      } else {
          setEpisodes(state?.episodes || []);
      }
  };

  useEffect(() => {
      const currentState = JSON.stringify(gatherState());
      if (lastSavedState.current !== null && currentState !== lastSavedState.current) {
          setIsDirty(true);
      }
  }, [gatherState]);

  useEffect(() => {
    const initialState = JSON.stringify(gatherState());
    lastSavedState.current = initialState;
  }, []);

  // Auto-select first episode if none selected
  useEffect(() => {
      if (activeEpisodeId === null && episodes.length > 0) {
          setActiveEpisodeId(episodes[0].id);
      }
  }, [episodes, activeEpisodeId]);

  // Episode Management Helpers
  const getCurrentEpisode = () => episodes.find(e => e.id === activeEpisodeId);
  
  const addEpisode = () => {
      const newEp: Episode = {
          id: Date.now(),
          title: `Episode ${episodes.length + 1}`,
          synopsis: '',
          scenes: []
      };
      setEpisodes(prev => [...prev, newEp]);
      setActiveEpisodeId(newEp.id);
      setWorkflowPhase('episodes');
  };

  const updateEpisode = (id: number, data: Partial<Episode>) => {
      setEpisodes(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));
  };

  const deleteEpisode = (id: number) => {
      if(window.confirm(t('confirmDeleteProject'))) { // reusing translation
          setEpisodes(prev => prev.filter(e => e.id !== id));
          if (activeEpisodeId === id) setActiveEpisodeId(null);
      }
  };

  const handleSceneUpdate = (updatedScenes: Scene[]) => {
      if (activeEpisodeId === null) return;
      setEpisodes(prev => prev.map(ep => ep.id === activeEpisodeId ? { ...ep, scenes: updatedScenes } : ep));
  };

  // --- Scene/Shot Helpers using handleSceneUpdate ---
  const activeScenes: Scene[] = getCurrentEpisode()?.scenes || [];
  
  const addScene = (sceneData?: Partial<Scene>): Scene => {
    if (activeEpisodeId === null) return {} as Scene;
    const newId = Date.now();
    const newShot: Shot = { id: Date.now() + 1, description: '', imageUrl: null, videoUrl: null, shotType: '', cameraMovement: '', cameraType: '', lensType: '', lensBlur: '', atmosphere: '', lighting: '', style: '', technicalNotes: '', colorGrade: '', filmGrain: '', filmStock: '', duration: 5, soundFx: '', notes: '' };
    const fullNewScene: Scene = { id: newId, title: sceneData?.title || `${t('scene')} ${activeScenes.length + 1}`, characters: sceneData?.characters || '', setting: sceneData?.setting || '', location: sceneData?.location || '', dialogueType: sceneData?.dialogueType || 'dialogue', dialogue: sceneData?.dialogue || '', musicPrompt: sceneData?.musicPrompt || '', keyObjects: sceneData?.keyObjects || '', actions: sceneData?.actions || '', tone: sceneData?.tone || '', notes: sceneData?.notes || '', shots: sceneData?.shots || [newShot], transitionType: options.transitionTypeOptions[0] };
    
    handleSceneUpdate([...activeScenes, fullNewScene]);
    return fullNewScene;
  };
  
  const updateSceneDetails = (sceneId: number, details: Partial<Scene>) => {
      handleSceneUpdate(activeScenes.map(s => s.id === sceneId ? { ...s, ...details } : s));
  };

  const deleteScene = (sceneId: number) => {
      handleSceneUpdate(activeScenes.filter(s => s.id !== sceneId));
  };

  const addShot = (sceneId: number) => {
      handleSceneUpdate(activeScenes.map(s => s.id === sceneId ? { ...s, shots: [...s.shots, { id: Date.now(), description: '', imageUrl: null, videoUrl: null, shotType: '', cameraMovement: '', cameraType: '', lensType: '', lensBlur: '', atmosphere: '', lighting: '', style: '', technicalNotes: '', colorGrade: '', filmGrain: '', filmStock: '', duration: 5, soundFx: '', notes: '' }] } : s));
  };

  const updateShot = (sceneId: number, updatedShot: Shot) => {
      handleSceneUpdate(activeScenes.map(s => s.id === sceneId ? { ...s, shots: s.shots.map(shot => shot.id === updatedShot.id ? updatedShot : shot) } : s));
  };

  const deleteShot = (sceneId: number, shotId: number) => {
      handleSceneUpdate(activeScenes.map(s => (s.id === sceneId && s.shots.length > 1) ? { ...s, shots: s.shots.filter(shot => shot.id !== shotId) } : s));
  };

  const reorderScenes = (startIndex: number, endIndex: number) => {
      const r = [...activeScenes];
      const [rem] = r.splice(startIndex, 1);
      r.splice(endIndex, 0, rem);
      handleSceneUpdate(r);
  };
  
  const reorderShots = (sceneId: number, startIndex: number, endIndex: number) => {
       handleSceneUpdate(activeScenes.map(s => {
           if (s.id !== sceneId) return s;
           const nShots = Array.from(s.shots);
           const [rem] = nShots.splice(startIndex, 1);
           nShots.splice(endIndex, 0, rem);
           return { ...s, shots: nShots };
       }));
  };

  // Character Helpers
  const updateCharacter = (updatedCharacter: Character) => setCharacters(c => c.map(char => char.id === updatedCharacter.id ? updatedCharacter : char));
  const deleteCharacter = (characterId: number) => setCharacters(c => c.filter(char => char.id !== characterId));
  const addCharacterFromAI = (characterData: Omit<Character, 'id' | 'images'>) => { setCharacters(p => [...p, { ...characterData, id: Date.now(), images: [] }]); };
  const addVisualToCharacter = (characterName: string, imageUrl: string) => { setCharacters(p => p.map(c => c.name.toLowerCase() === characterName.toLowerCase() ? { ...c, images: [...c.images, imageUrl] } : c)); };
  
  const addCharacter = () => {
      const newChar: Character = {
          id: Date.now(),
          name: t('newCharacterName'),
          role: 'Protagonist',
          personality: '',
          appearance: '',
          outfit: '',
          behavior: '',
          images: []
      };
      setCharacters(prev => [...prev, newChar]);
  };

  // Styles
  const [customStyles, setCustomStyles] = useState<CustomStyle[]>([]);
  const [showSaveStyleModal, setShowSaveStyleModal] = useState(false);
  const [newStyleName, setNewStyleName] = useState('');
  const [pendingStyleTransferData, setPendingStyleTransferData] = useState<{ referenceImages: CustomStyleImage[], referencePrompt: string } | null>(null);

  useEffect(() => {
    const loadStyles = async () => {
        const styles = await getCustomStyles();
        setCustomStyles(styles);
    };
    loadStyles();
  }, []);

  const handleSaveStyle = async (referenceImages: {id: number, file: File, preview: string}[], referencePrompt: string) => {
      const customStyleImages: CustomStyleImage[] = [];
      for (const img of referenceImages) {
          try {
             const base64 = await blobToBase64(img.file);
             customStyleImages.push({ data: base64, mimeType: img.file.type });
          } catch (e) { console.error(e); }
      }
      if (customStyleImages.length === 0) return;
      setPendingStyleTransferData({ referenceImages: customStyleImages, referencePrompt });
      setNewStyleName(`Custom Style ${customStyles.length + 1}`);
      setShowSaveStyleModal(true);
  };

  const confirmSaveStyle = async () => {
      if (!pendingStyleTransferData || !newStyleName) return;
      const newStyle: Omit<CustomStyle, 'id'> = { name: newStyleName, images: pendingStyleTransferData.referenceImages, prompt: pendingStyleTransferData.referencePrompt };
      const id = await saveCustomStyle(newStyle);
      setCustomStyles(prev => [...prev, { ...newStyle, id }]);
      setShowSaveStyleModal(false);
      setStoryboardStyle('Custom');
      setSelectedCustomStyleId(id);
      setPendingStyleTransferData(null);
  };

  const handleDeleteCustomStyle = async (id: number) => {
    if (window.confirm(t('confirmDeleteStyle'))) {
        await deleteCustomStyle(id);
        setCustomStyles(await getCustomStyles());
    }
  };

  // Project Loading/Saving Logic
  const resetState = () => {
    applyState(null);
    setCurrentProjectId(null);
    const newState = JSON.stringify({ seriesTitle: '', authorName: '', storyboardStyle: 'Cinematic', aspectRatio: '16:9', soundtrackPrompt: '', logline: '', structuralAnalysis: '', treatment: '', references: [], episodes: [], characters: [], subplots: '', narrativeArc: [] });
    lastSavedState.current = newState;
    setIsDirty(false);
    setWorkflowPhase('bible');
  };

  const handleNewProject = () => {
    if (isDirty) {
        setPendingAction({ type: 'new' });
        setShowUnsavedChangesModal(true);
    } else {
        resetState();
    }
  };

  const handleSave = async () => {
      const state = gatherState();
      if (currentProjectId) {
          const projectId = await saveProject({ id: currentProjectId, name: state.seriesTitle || 'Untitled', state });
          setCurrentProjectId(projectId);
          lastSavedState.current = JSON.stringify(state);
          setIsDirty(false);
      } else {
          setNewProjectName(state.seriesTitle || 'Untitled Project');
          setShowSaveModal(true);
      }
  };
  
  const handleConfirmSave = async () => {
      if (!newProjectName.trim()) return;
      let state = gatherState();
      state.seriesTitle = newProjectName;
      setSeriesTitle(newProjectName);
      const projectId = await saveProject({ name: newProjectName, state });
      setCurrentProjectId(projectId);
      lastSavedState.current = JSON.stringify(state);
      setIsDirty(false);
      setShowSaveModal(false);
      setNewProjectName('');
  };

  const handleLoadProject = async (id: number) => {
      const project = await getProject(id);
      if (project) {
          applyState(project.state);
          setCurrentProjectId(project.id);
          lastSavedState.current = JSON.stringify(project.state);
          setIsDirty(false);
          setWorkflowPhase('bible');
      }
      setShowLoadModal(false);
  };
  
  const handleOpenLoad = async () => {
    const projectList = await getProjectsList();
    setProjects(projectList);
    setShowLoadModal(true);
  };

  const handleDeleteProject = async (id: number) => {
      if (window.confirm(t('confirmDeleteProject'))) {
        await deleteProject(id);
        setProjects(await getProjectsList());
        if (id === currentProjectId) resetState();
      }
  };

  const handleUnsavedChangesConfirmation = async (proceed: boolean) => {
      setShowUnsavedChangesModal(false);
      if (proceed && pendingAction) {
          setIsDirty(false);
          if (pendingAction.type === 'new') resetState();
          else if (pendingAction.type === 'loadProject' && pendingAction.payload) await handleLoadProject(pendingAction.payload.id);
      }
      setPendingAction(null);
  };

  // Story Generator Handler
  const handleStoryGenerated = async (story: any) => {
      setSeriesTitle(story.title);
      setLogline(story.logline);
      setSoundtrackPrompt(story.soundtrackPrompt);
      setStructuralAnalysis(story.structuralAnalysis);
      setTreatment(story.treatment);
      setReferences(story.references);
      setSubplots(story.subplots);
      setNarrativeArc(story.narrativeArc || []);
      
      const newCharacters: Character[] = story.characters.map((char: any, i: number) => ({ ...char, id: Date.now() + i, images: [] }));
      setCharacters(newCharacters);
      
      // Process episodes from the generator
      const newEpisodes: Episode[] = story.episodes.map((ep: any, i: number) => ({
          id: Date.now() + i,
          title: ep.title,
          synopsis: ep.synopsis,
          // If scenes exist (usually just for Ep 1), process them
          scenes: (ep.scenes || []).map((scene: any, sIdx: number) => ({
              ...scene,
              id: Date.now() + i * 1000 + sIdx,
              shots: (scene.shots || []).map((shot: any) => ({ ...shot, imageUrl: null, videoUrl: null }))
          }))
      }));

      setEpisodes(newEpisodes);
      
      if (newEpisodes.length > 0) {
          setActiveEpisodeId(newEpisodes[0].id);
          setWorkflowPhase('storyboard');
      } else {
          setWorkflowPhase('episodes');
      }

      // Trigger Mass Gen for characters and scenes of ALL episodes
      const jobs: GenerationJob[] = [];
      
      newCharacters.forEach(char => {
          jobs.push({ type: 'character', id: char.id, name: char.name, prompt: createCharacterImagePrompt(char, storyboardStyle, aspectRatio) });
      });

      // Generate shots for ALL episodes
      newEpisodes.forEach((ep, epIdx) => {
          ep.scenes.forEach(scene => {
              scene.shots.forEach((shot: any, sIdx: number) => {
                  jobs.push({ 
                      type: 'shot', 
                      id: shot.id, 
                      parentId: scene.id, 
                      name: `Ep${epIdx + 1} - ${scene.title} - Shot ${sIdx + 1}`, 
                      prompt: createImagePromptForShot(shot, scene, newCharacters, storyboardStyle, aspectRatio) 
                  });
              });
          });
      });

      if (jobs.length > 0) {
          setShowMassGenConfirmModal(jobs);
      }
  };

   const handleMassGeneration = async () => {
      if (!showMassGenConfirmModal) return;
      setIsMassGenerating(true);
      setMassGenProgress({ current: 0, total: showMassGenConfirmModal.length });
      const successes: string[] = [];
      const failures: { name: string; error: string }[] = [];

      for (const job of showMassGenConfirmModal) {
          try {
              const imageUrl = await generateImage(job.prompt);
              successes.push(job.name);
              if (job.type === 'character') {
                  setCharacters(prev => prev.map(c => c.id === job.id ? { ...c, images: [...c.images, imageUrl] } : c));
              } else {
                  // Find the episode containing the scene. Since mass gen is mostly for Ep 1 right now, we scan episodes.
                  setEpisodes(prevEps => prevEps.map(ep => ({
                      ...ep,
                      scenes: ep.scenes.map(s => s.id === job.parentId ? {
                          ...s,
                          shots: s.shots.map(shot => shot.id === job.id ? { ...shot, imageUrl } : shot)
                      } : s)
                  })));
              }
          } catch (error) {
              failures.push({ name: job.name, error: (error as Error).message });
          }
          setMassGenProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }
      setIsMassGenerating(false);
      setShowMassGenConfirmModal(null);
      setGenerationReport({ successes, failures });
  };

  // PDF Export
  const [isExporting, setIsExporting] = useState(false);
  
  const handleExportPDFClick = () => {
     setShowPDFModal(true);
  };

  const executePDFExport = async (exportOptions: PDFExportOptions) => {
    setShowPDFModal(false);
    setIsExporting(true);
    try {
      await exportStoryboardToPDF(
          seriesTitle, 
          authorName, 
          episodes, 
          activeEpisodeId, 
          characters, 
          storyboardStyle, 
          aspectRatio, 
          t, 
          soundtrackPrompt, 
          logline,
          structuralAnalysis,
          treatment,
          references,
          exportOptions
      );
    } catch (error) { 
        console.error("PDF Export failed:", error); 
        alert('PDF Export Failed. Check console for details.'); 
    } 
    finally { setIsExporting(false); }
  };

  // Consistency Check Logic
  const handleConsistencyApply = async (settings: ConsistencySettings) => {
        setIsCoCreating(true);
        try {
            const currentState = gatherState();
            const result = await ensureStoryConsistency(currentState, language, settings);
            applyState(result.state);
            setPendingModification({ state: result.state, explanation: result.explanation });
            setShowModificationModal(false); 
            setCoCreationStatus('success');
            setShowConsistencyModal(false);
            alert('Consistency check complete! Explanation: ' + result.explanation);
        } catch (error) {
            console.error("Consistency check failed", error);
            setCoCreationStatus('error');
            alert(t('coCreationError'));
        } finally {
            setIsCoCreating(false);
        }
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, options }}>
    <div className="flex h-screen bg-gray-900 text-white font-sans overflow-hidden selection:bg-indigo-500 selection:text-white">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col z-20">
         <div className="p-4 border-b border-gray-700 flex items-center gap-3">
            <FilmIcon className="w-6 h-6 text-indigo-500" />
            <span className="font-bold text-lg tracking-tight">Storyboard AI</span>
         </div>

         <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <button onClick={() => { setWorkflowPhase('bible'); setBibleTab('general'); }} className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${workflowPhase === 'bible' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}>
                <BookOpenIcon className="w-5 h-5" /> Series Bible
            </button>
            <button onClick={() => setWorkflowPhase('arc')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${workflowPhase === 'arc' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}>
                <ActivityIcon className="w-5 h-5" /> Narrative Arc
            </button>
             <button onClick={() => setWorkflowPhase('organizer')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${workflowPhase === 'organizer' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}>
                <LayoutGridIcon className="w-5 h-5" /> Visual Organizer
            </button>
            <button onClick={() => setWorkflowPhase('episodes')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${workflowPhase === 'episodes' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}>
                <RowsIcon className="w-5 h-5" /> Episodes
            </button>
            <button onClick={() => {
                if (activeEpisodeId === null && episodes.length > 0) setActiveEpisodeId(episodes[0].id);
                if (episodes.length === 0) { alert('Create an episode first.'); return; }
                setWorkflowPhase('storyboard');
            }} className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${workflowPhase === 'storyboard' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}>
                <FilmIcon className="w-5 h-5" /> Storyboard
            </button>
            <button onClick={() => setWorkflowPhase('generator')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${workflowPhase === 'generator' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}>
                <WandIcon className="w-5 h-5" /> AI Generator
            </button>
            <div className="my-4 border-t border-gray-700"></div>
            <button onClick={() => {
                if (activeEpisodeId === null && episodes.length > 0) setActiveEpisodeId(episodes[0].id);
                setWorkflowPhase('export');
            }} className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${workflowPhase === 'export' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}>
                <VideoIcon className="w-5 h-5" /> Export & Video
            </button>
         </nav>
         
         <div className="p-4 border-t border-gray-700 space-y-2">
            <button onClick={handleSave} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-700 rounded">
                <FloppyDiskIcon className="w-4 h-4" /> {t('saveProject')}
            </button>
            <button onClick={handleOpenLoad} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-700 rounded">
                <FolderOpenIcon className="w-4 h-4" /> {t('loadProject')}
            </button>
            <button onClick={handleNewProject} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-700 rounded">
                <PlusIcon className="w-4 h-4" /> {t('newProject')}
            </button>
            <LanguageSelector />
         </div>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
         <header className="bg-gray-800/50 border-b border-gray-700 h-16 px-6 flex items-center justify-between z-10">
            <div>
                <h1 className="text-xl font-bold text-white">{seriesTitle || 'Untitled Series'}</h1>
                {workflowPhase === 'storyboard' && activeEpisodeId && (
                    <p className="text-xs text-gray-400">Editing: {episodes.find(e => e.id === activeEpisodeId)?.title}</p>
                )}
            </div>
            <div className="flex items-center gap-4">
                {/* Global Project Settings Inputs */}
                 <div className="flex items-center gap-2">
                     <select
                        value={storyboardStyle}
                        onChange={(e) => setStoryboardStyle(e.target.value as StoryboardStyle)}
                        className="bg-gray-700 border-gray-600 text-xs text-white rounded focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        {Object.entries(options.storyboardStyleOptions).map(([value, label]) => (
                            <option key={value} value={value}>{label as string}</option>
                        ))}
                    </select>
                    <select
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value)}
                        className="bg-gray-700 border-gray-600 text-xs text-white rounded focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        {Object.entries(options.aspectRatioOptions).map(([value, label]) => (
                            <option key={value} value={value}>{label as string}</option>
                        ))}
                    </select>
                 </div>
            </div>
         </header>

         <div className="flex-1 overflow-y-auto p-8">
            {workflowPhase === 'bible' && (
                <div className="max-w-5xl mx-auto">
                     <div className="mb-6 grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">{t('storyTitleLabel')}</label>
                            <input type="text" value={seriesTitle} onChange={(e) => setSeriesTitle(e.target.value)} className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">{t('authorLabel')}</label>
                            <input type="text" value={authorName} onChange={(e) => setAuthorName(e.target.value)} className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm" />
                        </div>
                     </div>
                    <SeriesBible 
                        logline={logline} setLogline={setLogline}
                        treatment={treatment} setTreatment={setTreatment}
                        subplots={subplots} setSubplots={setSubplots}
                        references={references}
                        structuralAnalysis={structuralAnalysis} setStructuralAnalysis={setStructuralAnalysis}
                        soundtrackPrompt={soundtrackPrompt} setSoundtrackPrompt={setSoundtrackPrompt}
                        characters={characters} updateCharacter={updateCharacter} deleteCharacter={deleteCharacter}
                        storyboardStyle={storyboardStyle} aspectRatio={aspectRatio}
                        customStyles={customStyles} onSaveAndApplyStyle={handleSaveStyle} onDeleteStyle={handleDeleteCustomStyle}
                        activeTab={bibleTab}
                        onTabChange={setBibleTab}
                        onAddCharacter={addCharacter}
                    />
                </div>
            )}

            {workflowPhase === 'arc' && (
                <NarrativeArcEditor
                    arc={narrativeArc}
                    setArc={setNarrativeArc}
                    currentLogline={logline}
                    currentTreatment={treatment}
                    currentEpisodes={episodes.map(e => ({ title: e.title, synopsis: e.synopsis }))}
                    onStoryUpdated={(newLogline, newTreatment, newEpisodesData) => {
                        setLogline(newLogline);
                        setTreatment(newTreatment);
                        // Update episode synopses while keeping IDs and scenes
                        setEpisodes(prev => prev.map((ep, i) => {
                            const newData = newEpisodesData[i];
                            return newData ? { ...ep, title: newData.title, synopsis: newData.synopsis } : ep;
                        }));
                        alert('Story updated based on new narrative arc!');
                    }}
                />
            )}

            {workflowPhase === 'organizer' && (
                <VisualOrganizer 
                    episodes={episodes} 
                    onUpdateEpisodes={(newEpisodes) => {
                        setEpisodes(newEpisodes);
                        // Trigger the consistency check modal immediately after reordering
                        setLastConsistencySettings({ intensity: 5, weirdness: 3, instructions: 'Review logic and continuity after manual scene reordering.' });
                        setShowConsistencyModal(true);
                    }} 
                />
            )}

            {workflowPhase === 'episodes' && (
                <div className="max-w-4xl mx-auto">
                    <EpisodeList 
                        episodes={episodes}
                        activeEpisodeId={activeEpisodeId}
                        onAddEpisode={addEpisode}
                        onDeleteEpisode={deleteEpisode}
                        onUpdateEpisode={updateEpisode}
                        onSelectEpisode={(id) => { setActiveEpisodeId(id); setWorkflowPhase('storyboard'); }}
                    />
                </div>
            )}

            {workflowPhase === 'storyboard' && activeEpisodeId !== null && (
                <div className="max-w-6xl mx-auto">
                    <div className="flex justify-between mb-4">
                        <div className="flex items-center gap-2">
                             <h2 className="text-2xl font-bold">{episodes.find(e => e.id === activeEpisodeId)?.title}</h2>
                             <span className="bg-indigo-900 text-indigo-300 text-xs px-2 py-1 rounded-full">{activeScenes.length} Scenes</span>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => addScene()} className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white h-9 px-3">
                                <PlusIcon className="w-4 h-4 mr-2" /> Add Scene
                            </button>
                        </div>
                    </div>
                    
                    {activeScenes.length === 0 ? (
                         <div className="text-center py-20 px-6 bg-gray-800/30 rounded-lg border-2 border-dashed border-gray-700 flex flex-col items-center">
                            <FilmIcon className="w-16 h-16 text-gray-600 mb-4" />
                            <p className="text-xl text-gray-400 font-semibold">This episode is empty.</p>
                            <button onClick={() => addScene()} className="mt-6 inline-flex items-center justify-center rounded-md text-sm font-medium bg-indigo-600 text-indigo-50 hover:bg-indigo-600/90 h-10 px-4 py-2">
                                <PlusIcon className="w-4 h-4 mr-2" /> Add First Scene
                            </button>
                        </div>
                    ) : (
                        <Storyboard
                          scenes={activeScenes}
                          characters={characters}
                          updateSceneDetails={updateSceneDetails}
                          deleteScene={deleteScene}
                          addShot={addShot}
                          updateShot={updateShot}
                          deleteShot={deleteShot}
                          storyboardStyle={storyboardStyle}
                          aspectRatio={aspectRatio}
                          reorderScenes={reorderScenes}
                          reorderShots={reorderShots}
                        />
                    )}
                </div>
            )}

            {workflowPhase === 'generator' && (
                <div className="max-w-4xl mx-auto">
                    <StoryGenerator onStoryGenerated={handleStoryGenerated} aspectRatio={aspectRatio} />
                </div>
            )}

            {workflowPhase === 'export' && (
                <div className="max-w-6xl mx-auto space-y-8">
                     <div className="flex items-center justify-between">
                         <h2 className="text-3xl font-bold">Export & Production</h2>
                         
                         {/* Episode Selector to ensure we export the right content */}
                         <div className="flex items-center gap-3">
                            <label className="text-sm text-gray-400">Active Episode:</label>
                            <select 
                                value={activeEpisodeId || ''} 
                                onChange={(e) => setActiveEpisodeId(Number(e.target.value))}
                                className="bg-gray-700 border-gray-600 text-white text-sm rounded-md focus:ring-indigo-500 focus:border-indigo-500 p-2"
                            >
                                {episodes.map(ep => (
                                    <option key={ep.id} value={ep.id}>{ep.title}</option>
                                ))}
                            </select>
                         </div>
                     </div>
        
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         {/* Export PDF Card */}
                         <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 hover:border-indigo-500 transition-all hover:shadow-lg hover:shadow-indigo-500/10 group">
                             <div className="flex items-start justify-between mb-4">
                                 <div className="p-3 bg-red-500/10 rounded-lg">
                                     <DownloadIcon className="w-8 h-8 text-red-400" />
                                 </div>
                             </div>
                             <h3 className="text-xl font-bold text-white mb-2">Export to PDF</h3>
                             <p className="text-gray-400 text-sm mb-6">
                                Compile scenes, shots, and metadata into a professional storyboard PDF document. Choose which episodes to include.
                             </p>
                             <button 
                                onClick={handleExportPDFClick} 
                                disabled={isExporting || episodes.length === 0}
                                className="w-full inline-flex items-center justify-center rounded-md text-sm font-bold bg-white text-gray-900 hover:bg-gray-200 h-10 px-4 py-2 transition-colors disabled:opacity-50"
                            >
                                {isExporting ? <LoadingSpinner /> : 'Download PDF'}
                            </button>
                         </div>
        
                         {/* Generate Animatic Card */}
                         <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 hover:border-indigo-500 transition-all hover:shadow-lg hover:shadow-indigo-500/10 group">
                             <div className="flex items-start justify-between mb-4">
                                 <div className="p-3 bg-purple-500/10 rounded-lg">
                                     <VideoIcon className="w-8 h-8 text-purple-400" />
                                 </div>
                             </div>
                             <h3 className="text-xl font-bold text-white mb-2">Generate Animatic</h3>
                             <p className="text-gray-400 text-sm mb-6">
                                Create a video animatic for <strong>{episodes.find(e => e.id === activeEpisodeId)?.title || 'Selected Episode'}</strong> using your generated shots and estimated durations. Includes shots without images.
                             </p>
                             <button 
                                onClick={() => setShowAnimaticModal(true)} 
                                disabled={activeScenes.length === 0}
                                className="w-full inline-flex items-center justify-center rounded-md text-sm font-bold bg-white text-gray-900 hover:bg-gray-200 h-10 px-4 py-2 transition-colors disabled:opacity-50"
                            >
                                Open Animatic Studio
                            </button>
                         </div>
                     </div>
        
                     {/* AI Video Generator Section */}
                     <div className="pt-8 border-t border-gray-700">
                         <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <WandIcon className="w-5 h-5 text-indigo-400" />
                            AI Video Generator
                         </h3>
                         <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                             <VideoGenerator />
                         </div>
                     </div>
                </div>
            )}
         </div>
         
         {/* Floating Chat Widget */}
         <div className="absolute bottom-6 right-6 z-50">
              <ChatWidget
                addScene={addScene}
                updateScene={(s) => handleSceneUpdate(activeScenes.map(sc => sc.id === s.id ? s : sc))}
                scenes={activeScenes}
                characters={characters}
                updateCharacter={updateCharacter}
                addCharacterFromAI={addCharacterFromAI}
                addVisualToCharacter={addVisualToCharacter}
                storyboardStyle={storyboardStyle}
                aspectRatio={aspectRatio}
              />
         </div>

      </main>

      {/* Modals */}
      {showPDFModal && (
          <PDFExportModal 
             onExport={executePDFExport}
             onClose={() => setShowPDFModal(false)}
          />
      )}

      {showSaveModal && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full border border-gray-700">
                  <h3 className="text-lg font-semibold mb-4">{t('confirmSaveTitle')}</h3>
                  <input type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm mb-4" autoFocus />
                  <div className="flex justify-end gap-2">
                      <button onClick={() => setShowSaveModal(false)} className="px-4 py-2 text-sm rounded-md bg-gray-700 hover:bg-gray-600">{t('cancel')}</button>
                      <button onClick={handleConfirmSave} className="px-4 py-2 text-sm rounded-md bg-indigo-600 hover:bg-indigo-500 text-white" disabled={!newProjectName.trim()}>{t('save')}</button>
                  </div>
              </div>
          </div>
      )}
      
      {showLoadModal && (
           <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-gray-800 rounded-lg shadow-xl p-6 max-w-2xl w-full border border-gray-700 max-h-[80vh] flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold">{t('loadProjectTitle')}</h3>
                      <button onClick={() => setShowLoadModal(false)}><UserIcon className="w-5 h-5 transform rotate-45" /></button>
                  </div>
                  <div className="overflow-y-auto flex-1 space-y-2">
                      {projects.map(project => (
                          <div key={project.id} className="flex justify-between items-center bg-gray-700/50 p-3 rounded-md hover:bg-gray-700 transition-colors">
                              <div>
                                  <h4 className="font-semibold">{project.name}</h4>
                                  <p className="text-xs text-gray-400">{new Date(project.modified).toLocaleDateString()}</p>
                              </div>
                              <div className="flex gap-2">
                                   <button onClick={() => { 
                                       if(isDirty) { setPendingAction({type:'loadProject', payload:{id:project.id}}); setShowUnsavedChangesModal(true); }
                                       else handleLoadProject(project.id); 
                                    }} className="px-3 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-500 text-white">{t('loadProject')}</button>
                                   <button onClick={() => handleDeleteProject(project.id)} className="p-2 text-red-500 hover:text-red-400"><TrashIcon className="w-4 h-4" /></button>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

       {showUnsavedChangesModal && (
           <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full border border-gray-700">
                  <h3 className="text-lg font-semibold mb-4 text-yellow-400">{t('unsavedChangesTitle')}</h3>
                  <p className="mb-6 text-gray-300">{t('unsavedChangesMessage')}</p>
                  <div className="flex justify-end gap-3">
                      <button onClick={() => handleUnsavedChangesConfirmation(false)} className="px-4 py-2 text-sm rounded-md bg-gray-700 hover:bg-gray-600">{t('cancel')}</button>
                      <button onClick={() => handleUnsavedChangesConfirmation(true)} className="px-4 py-2 text-sm rounded-md bg-red-600 hover:bg-red-500 text-white">{t('proceed')}</button>
                  </div>
              </div>
          </div>
      )}
      
      {showMassGenConfirmModal && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
               <div className="bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full border border-gray-700">
                   {isMassGenerating ? (
                       <div className="text-center">
                           <h3 className="text-lg font-semibold mb-4">{t('generating')}</h3>
                           <div className="w-full bg-gray-700 rounded-full h-2.5 mb-4">
                               <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${(massGenProgress.current / massGenProgress.total) * 100}%` }}></div>
                           </div>
                           <p className="text-sm text-gray-400">{massGenProgress.current} / {massGenProgress.total}</p>
                       </div>
                   ) : (
                       <>
                           <h3 className="text-lg font-semibold mb-4">{t('confirmMassGenerationTitle')}</h3>
                           <p className="mb-6 text-gray-300">{t('confirmMassGenerationMessage', { count: showMassGenConfirmModal.length })}</p>
                           <div className="flex justify-end gap-3">
                               <button onClick={() => setShowMassGenConfirmModal(null)} className="px-4 py-2 text-sm rounded-md bg-gray-700 hover:bg-gray-600">{t('confirmMassGenerationNo')}</button>
                               <button onClick={handleMassGeneration} className="px-4 py-2 text-sm rounded-md bg-indigo-600 hover:bg-indigo-500 text-white">{t('confirmMassGenerationYes')}</button>
                           </div>
                       </>
                   )}
               </div>
          </div>
      )}
      
      {showSaveStyleModal && (
           <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full border border-gray-700">
                  <h3 className="text-lg font-semibold mb-4">{t('applyStyle')}</h3>
                  <p className="mb-2 text-sm text-gray-400">Enter a name for this custom style:</p>
                   <input type="text" value={newStyleName} onChange={(e) => setNewStyleName(e.target.value)} className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm mb-4" autoFocus />
                   <div className="flex justify-end gap-3">
                       <button onClick={() => setShowSaveStyleModal(false)} className="px-4 py-2 text-sm rounded-md bg-gray-700 hover:bg-gray-600">{t('cancel')}</button>
                       <button onClick={confirmSaveStyle} className="px-4 py-2 text-sm rounded-md bg-indigo-600 hover:bg-indigo-500 text-white" disabled={!newStyleName.trim()}>{t('save')}</button>
                   </div>
              </div>
           </div>
      )}

      {showConsistencyModal && (
          <ConsistencyModal 
            onApply={handleConsistencyApply} 
            onClose={() => setShowConsistencyModal(false)} 
            isLoading={isCoCreating}
            initialValues={lastConsistencySettings}
          />
      )}

      {showFrameIOModal && (
          <FrameIOExportModal scenes={activeScenes} aspectRatio={aspectRatio} storyTitle={seriesTitle} onClose={() => setShowFrameIOModal(false)} />
      )}

      {showAnimaticModal && (
          <AnimaticExportModal scenes={activeScenes} aspectRatio={aspectRatio} storyTitle={seriesTitle} onClose={() => setShowAnimaticModal(false)} />
      )}

    </div>
    </LanguageContext.Provider>
  );
};
