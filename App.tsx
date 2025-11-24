
import React, { useState, useEffect, useCallback } from 'react';
import { LanguageContext, LanguageContextType } from './contexts/languageContext';
import { translations, Language } from './lib/translations';
import { Episode, Character, Scene, Shot, StoryboardStyle, ProjectState, Reference, ArcPoint, CustomStyle } from './types';
import { saveProject, getProjectsList, getProject, deleteProject, saveCustomStyle, getCustomStyles, deleteCustomStyle, Project } from './lib/db';

// Components
import { Storyboard } from './components/Storyboard';
import { SeriesBible } from './components/SeriesBible';
import { StoryGenerator } from './components/StoryGenerator';
import { VisualOrganizer } from './components/VisualOrganizer';
import { NarrativeArcEditor } from './components/NarrativeArcEditor';
import { VideoGenerator } from './components/VideoGenerator';
import { Utilities } from './components/Utilities';
import { EpisodeList } from './components/EpisodeList';
import { LanguageSelector } from './components/LanguageSelector';
import { PDFExportModal } from './components/PDFExportModal';
import { AnimaticExportModal } from './components/AnimaticExportModal';
import { ModificationModal } from './components/ModificationModal';
import { ConsistencyModal } from './components/ConsistencyModal';
import { ModificationPreviewModal } from './components/ModificationPreviewModal';
import { 
    LayoutGridIcon, FilmIcon, UserIcon, BookOpenIcon, VideoIcon, ChartBarIcon, 
    ActivityIcon, FloppyDiskIcon, FolderOpenIcon, TrashIcon, PlusIcon, 
    ChevronLeftIcon, ChevronRightIcon 
} from './components/icons';
import { ensureStoryConsistency, modifyStory } from './services/geminiService';

// Basic ID generator
const generateId = () => Date.now() + Math.random();

export const App: React.FC = () => {
  // Language State
  const [language, setLanguage] = useState<Language>('en');

  const t = useCallback((key: keyof typeof translations.en, replacements?: { [key: string]: string | number }) => {
    let text = translations[language][key] || translations['en'][key] || key;
    if (replacements) {
        Object.entries(replacements).forEach(([k, v]) => {
            text = text.replace(`{${k}}`, String(v));
        });
    }
    return text;
  }, [language]);

  const languageContextValue: LanguageContextType = {
    language,
    setLanguage,
    t,
    options: translations[language].options
  };

  // Project State
  const [currentProjectId, setCurrentProjectId] = useState<number | undefined>(undefined);
  const [seriesTitle, setSeriesTitle] = useState('Untitled Project');
  const [authorName, setAuthorName] = useState('');
  const [storyboardStyle, setStoryboardStyle] = useState<StoryboardStyle>('Cinematic');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  
  const [logline, setLogline] = useState('');
  const [treatment, setTreatment] = useState('');
  const [structuralAnalysis, setStructuralAnalysis] = useState('');
  const [subplots, setSubplots] = useState('');
  const [soundtrackPrompt, setSoundtrackPrompt] = useState('');
  const [references, setReferences] = useState<Reference[]>([]);
  const [narrativeArc, setNarrativeArc] = useState<ArcPoint[]>([]);
  
  const [characters, setCharacters] = useState<Character[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  
  const [activeEpisodeId, setActiveEpisodeId] = useState<number | null>(null);
  const [workflowPhase, setWorkflowPhase] = useState('generator'); // Default start
  const [bibleTab, setBibleTab] = useState<'general' | 'characters' | 'style'>('general');

  // Custom Styles
  const [customStyles, setCustomStyles] = useState<CustomStyle[]>([]);

  // Modals & Menus
  const [showPDFModal, setShowPDFModal] = useState(false);
  const [showAnimaticModal, setShowAnimaticModal] = useState(false);
  const [showModificationModal, setShowModificationModal] = useState(false);
  const [showConsistencyModal, setShowConsistencyModal] = useState(false);
  const [showModificationPreview, setShowModificationPreview] = useState(false);
  const [modificationPreviewData, setModificationPreviewData] = useState<{explanation: string, state: ProjectState} | null>(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  
  // Layout State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Project Management
  const [projectsList, setProjectsList] = useState<{id: number, name: string, modified: Date}[]>([]);
  const [showProjectList, setShowProjectList] = useState(false);

  // Initial Load
  useEffect(() => {
      loadProjectsList();
      loadCustomStyles();
  }, []);

  const loadProjectsList = async () => {
      const list = await getProjectsList();
      setProjectsList(list);
  };

  const loadCustomStyles = async () => {
      const styles = await getCustomStyles();
      setCustomStyles(styles);
  };

  const gatherState = (): ProjectState => ({
      seriesTitle,
      authorName,
      storyboardStyle,
      aspectRatio,
      logline,
      structuralAnalysis,
      treatment,
      subplots,
      soundtrackPrompt,
      references,
      narrativeArc,
      episodes,
      characters
  });

  const applyState = (state: ProjectState) => {
      setSeriesTitle(state.seriesTitle || 'Untitled');
      setAuthorName(state.authorName || '');
      setStoryboardStyle(state.storyboardStyle || 'Cinematic');
      setAspectRatio(state.aspectRatio || '16:9');
      setLogline(state.logline || '');
      setTreatment(state.treatment || '');
      setStructuralAnalysis(state.structuralAnalysis || '');
      setSubplots(state.subplots || '');
      setSoundtrackPrompt(state.soundtrackPrompt || '');
      setReferences(state.references || []);
      setNarrativeArc(state.narrativeArc || []);
      setEpisodes(state.episodes || []);
      setCharacters(state.characters || []);
      
      // Reset active episode if it doesn't exist in new state
      if (state.episodes && state.episodes.length > 0) {
          setActiveEpisodeId(state.episodes[0].id);
      } else {
          setActiveEpisodeId(null);
      }
  };

  const handleSaveProject = async () => {
      const state = gatherState();
      const id = await saveProject({
          id: currentProjectId,
          name: seriesTitle,
          state
      });
      setCurrentProjectId(id);
      loadProjectsList();
      alert(t('projectSaved'));
  };

  const handleLoadProject = async (id: number) => {
      const project = await getProject(id);
      if (project) {
          setCurrentProjectId(project.id);
          applyState(project.state);
          setShowProjectList(false);
      }
  };

  const handleNewProject = () => {
      if (window.confirm(t('unsavedChangesMessage'))) {
          setCurrentProjectId(undefined);
          setSeriesTitle('Untitled Project');
          setEpisodes([]);
          setCharacters([]);
          setLogline('');
          setTreatment('');
          setNarrativeArc([]);
          setReferences([]);
          setWorkflowPhase('generator');
      }
  };

  const handleDeleteProject = async (id: number) => {
      if (window.confirm(t('confirmDeleteProject'))) {
          await deleteProject(id);
          loadProjectsList();
          if (currentProjectId === id) {
              handleNewProject();
          }
      }
  };

  // ... Handlers for sub-components ...
  const handleSaveStyle = async (images: {id: number, file: File, preview: string}[], prompt: string) => {
      const styleImages = await Promise.all(images.map(async (img) => {
          return new Promise<{data: string, mimeType: string}>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                  const base64 = (reader.result as string).split(',')[1];
                  resolve({ data: base64, mimeType: img.file.type });
              };
              reader.readAsDataURL(img.file);
          });
      }));
      
      await saveCustomStyle({
          name: `Style ${customStyles.length + 1}`,
          images: styleImages,
          prompt
      });
      loadCustomStyles();
  };

  const handleDeleteStyle = async (id: number) => {
      if (window.confirm(t('confirmDeleteStyle'))) {
          await deleteCustomStyle(id);
          loadCustomStyles();
      }
  };

  const activeEpisode = episodes.find(e => e.id === activeEpisodeId);

  const menuItems = [
      { id: 'generator', icon: LayoutGridIcon, label: t('storyGeneratorTab') },
      { id: 'bible', icon: BookOpenIcon, label: t('storyBoardTab') + ' / ' + t('outlineTab') },
      { id: 'arc', icon: ActivityIcon, label: t('narrativeArcTitle') },
      { id: 'episodes', icon: FolderOpenIcon, label: t('episodes') },
      { id: 'organizer', icon: LayoutGridIcon, label: t('visualOrganizerTitle') },
      { id: 'storyboard', icon: FilmIcon, label: t('storyBoardTab') },
      { id: 'video', icon: VideoIcon, label: t('videoGeneratorTab') },
      { id: 'utilities', icon: ChartBarIcon, label: t('utilitiesTitle') },
  ];

  return (
    <LanguageContext.Provider value={languageContextValue}>
        <div className="flex h-screen bg-gray-900 text-white font-sans overflow-hidden">
            
            {/* SIDEBAR */}
            <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-gray-800 border-r border-gray-700 flex flex-col flex-shrink-0 transition-all duration-300 z-30 relative`}>
                {/* Header / Toggle */}
                <div className="h-16 flex items-center px-4 border-b border-gray-700 justify-between">
                    {!isSidebarCollapsed && (
                        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400 truncate">
                            Storyboard AI
                        </span>
                    )}
                    <button 
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
                        className={`p-2 rounded hover:bg-gray-700 text-gray-400 hover:text-white ${isSidebarCollapsed ? 'mx-auto' : ''}`}
                    >
                        {isSidebarCollapsed ? <ChevronRightIcon className="w-5 h-5"/> : <ChevronLeftIcon className="w-5 h-5"/>}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto overflow-x-visible py-4 flex flex-col gap-1">
                    {/* Navigation */}
                    <nav className="px-3 space-y-1">
                        {menuItems.map(item => (
                            <button
                                key={item.id}
                                onClick={() => setWorkflowPhase(item.id)}
                                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'px-3'} py-2.5 rounded-md text-sm font-medium transition-colors group relative ${
                                    workflowPhase === item.id 
                                    ? 'bg-indigo-600 text-white shadow-md' 
                                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                                }`}
                                title={isSidebarCollapsed ? item.label : undefined}
                            >
                                <item.icon className={`w-5 h-5 ${!isSidebarCollapsed ? 'mr-3' : ''} ${workflowPhase === item.id ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`} />
                                {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                            </button>
                        ))}
                    </nav>

                    <div className="my-2 border-t border-gray-700 mx-4"></div>

                    {/* Project Actions */}
                    <div className="px-3 space-y-1">
                        {!isSidebarCollapsed && <div className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-2">{t('project')}</div>}
                        
                        <button onClick={handleNewProject} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'px-3'} py-2 rounded-md text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-700 transition-colors`} title={t('newProject')}>
                            <PlusIcon className={`w-5 h-5 ${!isSidebarCollapsed ? 'mr-3' : ''}`} />
                            {!isSidebarCollapsed && t('newProject')}
                        </button>

                        <button onClick={handleSaveProject} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'px-3'} py-2 rounded-md text-sm font-medium text-gray-400 hover:text-indigo-400 hover:bg-gray-700 transition-colors`} title={t('saveProject')}>
                            <FloppyDiskIcon className={`w-5 h-5 ${!isSidebarCollapsed ? 'mr-3' : ''}`} />
                            {!isSidebarCollapsed && t('saveProject')}
                        </button>

                        {/* Load Project with Side Popout */}
                        <div className="relative group">
                            <button onClick={() => setShowProjectList(!showProjectList)} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'px-3'} py-2 rounded-md text-sm font-medium text-gray-400 hover:text-indigo-400 hover:bg-gray-700 transition-colors`} title={t('loadProject')}>
                                <FolderOpenIcon className={`w-5 h-5 ${!isSidebarCollapsed ? 'mr-3' : ''}`} />
                                {!isSidebarCollapsed && t('loadProject')}
                            </button>
                            
                            {showProjectList && (
                                <div className={`absolute ${isSidebarCollapsed ? 'left-full top-0 ml-2' : 'top-full left-0 mt-1 w-full'} w-64 bg-gray-800 border border-gray-700 rounded-md shadow-xl overflow-hidden z-50 animate-fade-in`}>
                                    <div className="p-2 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
                                        <span className="text-xs font-bold uppercase text-gray-500 px-2">{t('loadProject')}</span>
                                        <button onClick={() => setShowProjectList(false)} className="text-gray-500 hover:text-white p-1"><ChevronLeftIcon className="w-3 h-3"/></button>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto">
                                        {projectsList.map(p => (
                                            <div key={p.id} className="flex items-center justify-between p-2 hover:bg-gray-700 group cursor-pointer border-b border-gray-700/50 last:border-0">
                                                <button onClick={() => handleLoadProject(p.id)} className="flex-1 text-left text-sm text-gray-300 truncate px-1">
                                                    {p.name}
                                                    <span className="block text-[10px] text-gray-500">{new Date(p.modified).toLocaleDateString()}</span>
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteProject(p.id); }} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-600 rounded opacity-0 group-hover:opacity-100 transition-all">
                                                    <TrashIcon className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                        {projectsList.length === 0 && <div className="p-4 text-center text-xs text-gray-500">{t('noProjectsFoundError')}</div>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-700">
                    <LanguageSelector collapsed={isSidebarCollapsed} />
                    {!isSidebarCollapsed && (
                        <div className="text-xs text-gray-500 text-center mt-4">
                            v1.6.0 Studio Edition
                        </div>
                    )}
                </div>
            </aside>

            {/* MAIN WRAPPER */}
            <div className="flex-1 flex flex-col min-w-0">
                
                {/* TOP HEADER */}
                <header className="h-16 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-6 flex-shrink-0 shadow-sm z-20">
                    {/* Left: Title */}
                    <div className="flex items-center gap-4 w-full justify-center md:justify-start">
                        <div className="flex flex-col w-full max-w-md">
                            <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{t('project')}</label>
                            <input 
                                type="text" 
                                value={seriesTitle}
                                onChange={(e) => setSeriesTitle(e.target.value)}
                                className="bg-transparent border-none text-lg font-bold text-white focus:ring-0 placeholder-gray-500 p-0 w-full"
                                placeholder={t('untitledProject')}
                            />
                        </div>
                    </div>
                </header>

                {/* CONTENT AREA */}
                <main className="flex-1 overflow-y-auto p-6 scroll-smooth bg-gray-900 relative">
                    <div className="max-w-7xl mx-auto">
                        {workflowPhase === 'bible' && (
                            <SeriesBible 
                                logline={logline} setLogline={setLogline}
                                treatment={treatment} setTreatment={setTreatment}
                                subplots={subplots} setSubplots={setSubplots}
                                references={references}
                                structuralAnalysis={structuralAnalysis} setStructuralAnalysis={setStructuralAnalysis}
                                soundtrackPrompt={soundtrackPrompt} setSoundtrackPrompt={setSoundtrackPrompt}
                                characters={characters} updateCharacter={(c) => setCharacters(prev => prev.map(char => char.id === c.id ? c : char))}
                                deleteCharacter={(id) => setCharacters(prev => prev.filter(c => c.id !== id))}
                                storyboardStyle={storyboardStyle} aspectRatio={aspectRatio}
                                customStyles={customStyles} onSaveAndApplyStyle={handleSaveStyle} onDeleteStyle={handleDeleteStyle}
                                activeTab={bibleTab} onTabChange={setBibleTab}
                                onAddCharacter={() => setCharacters([...characters, { id: generateId(), name: '', role: '', personality: '', appearance: '', outfit: '', behavior: '', images: [] }])}
                            />
                        )}

                        {workflowPhase === 'arc' && (
                            <NarrativeArcEditor 
                                arc={narrativeArc} setArc={setNarrativeArc}
                                currentLogline={logline} currentTreatment={treatment} currentEpisodes={episodes}
                                onStoryUpdated={(l, t, e) => { setLogline(l); setTreatment(t); /* Logic to merge episodes needed if complex */ }}
                            />
                        )}

                        {workflowPhase === 'generator' && (
                            <StoryGenerator 
                                aspectRatio={aspectRatio}
                                onStoryGenerated={async (preview) => {
                                    applyState({
                                        ...gatherState(),
                                        seriesTitle: preview.title,
                                        logline: preview.logline,
                                        treatment: preview.treatment,
                                        structuralAnalysis: preview.structuralAnalysis,
                                        subplots: preview.subplots,
                                        soundtrackPrompt: preview.soundtrackPrompt,
                                        narrativeArc: preview.narrativeArc,
                                        references: preview.references,
                                        characters: preview.characters.map((c, i) => ({ ...c, id: generateId() + i, images: [] })),
                                        episodes: preview.episodes.map((ep, i) => ({
                                            ...ep,
                                            id: generateId() + i,
                                            scenes: ep.scenes.map((s, j) => ({ ...s, id: generateId() + j, shots: [] }))
                                        }))
                                    });
                                    setWorkflowPhase('bible');
                                }}
                            />
                        )}

                        {workflowPhase === 'episodes' && (
                            <EpisodeList 
                                episodes={episodes}
                                activeEpisodeId={activeEpisodeId}
                                onSelectEpisode={(id) => { setActiveEpisodeId(id); setWorkflowPhase('storyboard'); }}
                                onAddEpisode={() => {
                                    const newEp = { id: generateId(), title: `Episode ${episodes.length + 1}`, synopsis: '', scenes: [] };
                                    setEpisodes([...episodes, newEp]);
                                    setActiveEpisodeId(newEp.id);
                                }}
                                onDeleteEpisode={(id) => {
                                    setEpisodes(prev => prev.filter(e => e.id !== id));
                                    if (activeEpisodeId === id) setActiveEpisodeId(null);
                                }}
                                onUpdateEpisode={(id, data) => setEpisodes(prev => prev.map(e => e.id === id ? { ...e, ...data } : e))}
                            />
                        )}

                        {workflowPhase === 'organizer' && (
                            <VisualOrganizer 
                                episodes={episodes}
                                onUpdateEpisodes={(newEpisodes) => {
                                    setEpisodes(newEpisodes);
                                    // Trigger consistency check workflow automatically
                                    if (window.confirm(t('updateStoryOrder') + "? " + t('consistencyModalDescription'))) {
                                        setShowConsistencyModal(true);
                                    }
                                }}
                            />
                        )}

                        {workflowPhase === 'storyboard' && activeEpisode ? (
                            <div className="animate-fade-in">
                                <div className="mb-6 flex justify-between items-center">
                                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                        <FilmIcon className="w-6 h-6 text-indigo-400"/>
                                        {activeEpisode.title}
                                        <span className="text-sm font-normal text-gray-500 ml-2">({activeEpisode.scenes.length} scenes)</span>
                                    </h2>
                                    <button onClick={() => setWorkflowPhase('episodes')} className="text-sm text-indigo-400 hover:underline">
                                        &larr; Back to Episodes
                                    </button>
                                </div>
                                <Storyboard 
                                    scenes={activeEpisode.scenes}
                                    characters={characters}
                                    storyboardStyle={storyboardStyle}
                                    aspectRatio={aspectRatio}
                                    updateSceneDetails={(id, details) => {
                                        setEpisodes(prev => prev.map(ep => ep.id === activeEpisode.id ? {
                                            ...ep,
                                            scenes: ep.scenes.map(s => s.id === id ? { ...s, ...details } : s)
                                        } : ep));
                                    }}
                                    deleteScene={(id) => {
                                        setEpisodes(prev => prev.map(ep => ep.id === activeEpisode.id ? {
                                            ...ep,
                                            scenes: ep.scenes.filter(s => s.id !== id)
                                        } : ep));
                                    }}
                                    addShot={(sceneId) => {
                                        setEpisodes(prev => prev.map(ep => ep.id === activeEpisode.id ? {
                                            ...ep,
                                            scenes: ep.scenes.map(s => s.id === sceneId ? {
                                                ...s,
                                                shots: [...s.shots, { id: generateId(), description: '', imageUrl: null, videoUrl: null, shotType: 'Medium Shot (MS)', cameraMovement: 'Static', cameraType: 'Digital Cinema Camera', lensType: 'Standard', lensBlur: 'None', atmosphere: 'Neutral', lighting: 'Natural Light', style: 'Cinematic', technicalNotes: '', colorGrade: 'Neutral', filmGrain: 'None', filmStock: 'Digital', duration: 2, soundFx: '', notes: '' }]
                                            } : s)
                                        } : ep));
                                    }}
                                    updateShot={(sceneId, shot) => {
                                        setEpisodes(prev => prev.map(ep => ep.id === activeEpisode.id ? {
                                            ...ep,
                                            scenes: ep.scenes.map(s => s.id === sceneId ? {
                                                ...s,
                                                shots: s.shots.map(sh => sh.id === shot.id ? shot : sh)
                                            } : s)
                                        } : ep));
                                    }}
                                    deleteShot={(sceneId, shotId) => {
                                        setEpisodes(prev => prev.map(ep => ep.id === activeEpisode.id ? {
                                            ...ep,
                                            scenes: ep.scenes.map(s => s.id === sceneId ? {
                                                ...s,
                                                shots: s.shots.filter(sh => sh.id !== shotId)
                                            } : s)
                                        } : ep));
                                    }}
                                    reorderScenes={(start, end) => {
                                        const newScenes = [...activeEpisode.scenes];
                                        const [removed] = newScenes.splice(start, 1);
                                        newScenes.splice(end, 0, removed);
                                        setEpisodes(prev => prev.map(ep => ep.id === activeEpisode.id ? { ...ep, scenes: newScenes } : ep));
                                    }}
                                    reorderShots={(sceneId, start, end) => {
                                        setEpisodes(prev => prev.map(ep => ep.id === activeEpisode.id ? {
                                            ...ep,
                                            scenes: ep.scenes.map(s => {
                                                if (s.id !== sceneId) return s;
                                                const newShots = [...s.shots];
                                                const [removed] = newShots.splice(start, 1);
                                                newShots.splice(end, 0, removed);
                                                return { ...s, shots: newShots };
                                            })
                                        } : ep));
                                    }}
                                />
                            </div>
                        ) : workflowPhase === 'storyboard' && (
                            <div className="text-center py-20 text-gray-500 bg-gray-800/20 rounded-xl border border-dashed border-gray-700">
                                <FilmIcon className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                                <p className="text-lg mb-2">No Episode Selected</p>
                                <button onClick={() => setWorkflowPhase('episodes')} className="text-indigo-400 hover:underline">Go to Episodes List</button>
                            </div>
                        )}

                        {workflowPhase === 'video' && <VideoGenerator />}

                        {workflowPhase === 'utilities' && (
                            <Utilities 
                                episodes={episodes} 
                                characters={characters}
                                setEpisodes={setEpisodes}
                                setCharacters={setCharacters}
                                storyboardStyle={storyboardStyle}
                                aspectRatio={aspectRatio}
                                onGetProjectState={gatherState}
                                onImportProject={applyState}
                                onExportPDF={() => setShowPDFModal(true)}
                                onExportAnimatic={() => setShowAnimaticModal(true)}
                            />
                        )}
                    </div>
                </main>

                {/* --- MODALS --- */}
                {showPDFModal && (
                    <PDFExportModal
                        onExport={(opts) => {
                            import('./services/pdfService').then(mod => {
                                mod.exportStoryboardToPDF(
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
                                    opts
                                );
                                setShowPDFModal(false);
                            });
                        }}
                        onClose={() => setShowPDFModal(false)}
                    />
                )}

                {showAnimaticModal && (
                    <AnimaticExportModal
                        scenes={activeEpisode ? activeEpisode.scenes : episodes.flatMap(e => e.scenes)}
                        aspectRatio={aspectRatio}
                        storyTitle={seriesTitle}
                        onClose={() => setShowAnimaticModal(false)}
                    />
                )}

                {showModificationModal && (
                    <ModificationModal
                        onApply={async (settings) => {
                            setShowModificationModal(false);
                            setIsProcessingAI(true);
                            try {
                                const result = await modifyStory(gatherState(), settings, language);
                                setModificationPreviewData({ explanation: result.explanation, state: result.state });
                                setShowModificationPreview(true);
                            } catch (e) {
                                alert(t('coCreationError'));
                            } finally {
                                setIsProcessingAI(false);
                            }
                        }}
                        onClose={() => setShowModificationModal(false)}
                        isLoading={isProcessingAI}
                    />
                )}

                {showConsistencyModal && (
                    <ConsistencyModal
                        onApply={async (settings) => {
                            setIsProcessingAI(true);
                            try {
                                const result = await ensureStoryConsistency(gatherState(), language, settings);
                                applyState(result.state);
                                setShowConsistencyModal(false);
                                alert(t('projectSaved') + '\n' + result.explanation);
                            } catch(e) {
                                alert(t('errorGeneric', { message: (e as Error).message }));
                            } finally {
                                setIsProcessingAI(false);
                            }
                        }}
                        onClose={() => setShowConsistencyModal(false)}
                        isLoading={isProcessingAI}
                    />
                )}

                {showModificationPreview && modificationPreviewData && (
                    <ModificationPreviewModal
                        explanation={modificationPreviewData.explanation}
                        proposedState={modificationPreviewData.state}
                        onConfirm={(finalState) => {
                            applyState(finalState);
                            setShowModificationPreview(false);
                            setModificationPreviewData(null);
                        }}
                        onCancel={() => {
                            setShowModificationPreview(false);
                            setModificationPreviewData(null);
                        }}
                        onBack={() => {
                            setShowModificationPreview(false);
                            setShowModificationModal(true);
                        }}
                    />
                )}
            </div>
        </div>
    </LanguageContext.Provider>
  );
};
