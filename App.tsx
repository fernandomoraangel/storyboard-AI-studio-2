import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  LanguageContext,
  LanguageContextType,
} from "./contexts/languageContext";
import { useAuth } from "./contexts/authContext";
import { translations, Language } from "./lib/translations";
import {
  Episode,
  Character,
  Scene,
  Shot,
  StoryboardStyle,
  ProjectState,
  Reference,
  ArcPoint,
  CustomStyle,
  Author,
  CreativeProfile,
} from "./types";
import {
  saveProject,
  getProjectsList,
  getProject,
  deleteProject,
  saveCustomStyle,
  getCustomStyles,
  deleteCustomStyle,
  Project,
} from "./lib/db";

// Components
import { Home } from "./components/Home";
import { Storyboard } from "./components/Storyboard";
import { GalleryView } from "./components/GalleryView";
import { GridGallery } from "./components/GridGallery";
import { AdvancedNarrativeArc } from "./components/AdvancedNarrativeArc";
import { SeriesBible } from "./components/SeriesBible";
import { StoryGenerator } from "./components/StoryGenerator";
import { VisualOrganizer } from "./components/VisualOrganizer";
import { NarrativeArcEditor } from "./components/NarrativeArcEditor";
import { VideoGenerator } from "./components/VideoGenerator";
import { Utilities } from "./components/Utilities";
import { ProjectAuthors } from "./components/ProjectAuthors";
import { CreativeProfileManager } from "./components/CreativeProfileManager";
import { EpisodeList } from "./components/EpisodeList";
import { LanguageSelector } from "./components/LanguageSelector";
import { PDFExportModal } from "./components/PDFExportModal";
import { AnimaticExportModal } from "./components/AnimaticExportModal";
import { ModificationModal } from "./components/ModificationModal";
import { ConsistencyModal } from "./components/ConsistencyModal";
import { ModificationPreviewModal } from "./components/ModificationPreviewModal";
import { SettingsModal } from "./components/SettingsModal";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { AlertModal } from "./components/AlertModal";
import {
  LayoutGridIcon,
  FilmIcon,
  UserIcon,
  BookOpenIcon,
  VideoIcon,
  ChartBarIcon,
  ActivityIcon,
  FloppyDiskIcon,
  FolderOpenIcon,
  TrashIcon,
  PlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  WandIcon,
  CloseIcon,
  UsersIcon,
  CheckCircleIcon,
  SettingsIcon,
  GalleryIcon,
  CameraIcon,
  HomeIcon,
} from "./components/icons";
import {
  ensureStoryConsistency,
  modifyStory,
  createCharacterImagePrompt,
  createImagePromptForShot,
  generateImage,
} from "./services/geminiService";

// Basic ID generator
const generateId = () => Date.now() + Math.random();

export const App: React.FC = () => {
  // Language State
  const [language, setLanguage] = useState<Language>("en");
  const { user } = useAuth();

  const t = useCallback(
    (
      key: keyof typeof translations.en,
      replacements?: { [key: string]: string | number }
    ) => {
      const val = translations[language][key] || translations["en"][key];
      let text = typeof val === "string" ? val : key; // Fallback to key if not a string
      if (replacements) {
        Object.entries(replacements).forEach(([k, v]) => {
          text = text.replace(`{${k}}`, String(v));
        });
      }
      return text;
    },
    [language]
  );

  const languageContextValue: LanguageContextType = {
    language,
    setLanguage,
    t,
    options: translations[language].options,
  };

  // Project State
  const [currentProjectId, setCurrentProjectId] = useState<number | undefined>(
    undefined
  );
  const [seriesTitle, setSeriesTitle] = useState("Untitled Project");
  const [authorName, setAuthorName] = useState("");
  const [storyboardStyle, setStoryboardStyle] =
    useState<StoryboardStyle>("Cinematic");
  const [aspectRatio, setAspectRatio] = useState("16:9");

  const [logline, setLogline] = useState("");
  const [treatment, setTreatment] = useState("");
  const [structuralAnalysis, setStructuralAnalysis] = useState("");
  const [subplots, setSubplots] = useState("");
  const [soundtrackPrompt, setSoundtrackPrompt] = useState("");
  const [references, setReferences] = useState<Reference[]>([]);
  const [narrativeArc, setNarrativeArc] = useState<ArcPoint[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [creativeProfiles, setCreativeProfiles] = useState<CreativeProfile[]>(
    []
  );
  const [activeProfileId, setActiveProfileId] = useState<string | undefined>(
    undefined
  );

  const [characters, setCharacters] = useState<Character[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);

  const [activeEpisodeId, setActiveEpisodeId] = useState<number | null>(null);
  const [workflowPhase, setWorkflowPhase] = useState("home"); // Default start
  const [bibleTab, setBibleTab] = useState<"general" | "characters" | "style">(
    "general"
  );

  // UI Reset Key - Incremented to force remounting of components with local state (like StoryGenerator inputs)
  const [resetKey, setResetKey] = useState(0);

  // Custom Styles
  const [customStyles, setCustomStyles] = useState<CustomStyle[]>([]);

  // Modals & Menus
  const [showPDFModal, setShowPDFModal] = useState(false);
  const [showAnimaticModal, setShowAnimaticModal] = useState(false);
  const [showModificationModal, setShowModificationModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showConsistencyModal, setShowConsistencyModal] = useState(false);
  const [showModificationPreview, setShowModificationPreview] = useState(false);
  const [modificationPreviewData, setModificationPreviewData] = useState<{
    explanation: string;
    state: ProjectState;
  } | null>(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);

  // Confirmation Modals
  const [showNewProjectConfirmation, setShowNewProjectConfirmation] =
    useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);

  // Alert Modal State
  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "info";
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });

  const showAlert = (
    title: string,
    message: string,
    type: "success" | "error" | "info" = "info"
  ) => {
    setAlertState({ isOpen: true, title, message, type });
  };

  const closeAlert = () => {
    setAlertState((prev) => ({ ...prev, isOpen: false }));
  };

  // Mass Generation State
  const [showGenerationOffer, setShowGenerationOffer] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenProgress, setRegenProgress] = useState({ current: 0, total: 0 });
  const shouldStopGeneration = useRef(false);

  // Layout State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Project Management
  const [projectsList, setProjectsList] = useState<
    { id: number; name: string; modified: Date }[]
  >([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [showLoadProjectModal, setShowLoadProjectModal] = useState(false);

  // Initial Load
  useEffect(() => {
    loadProjectsList();
    loadCustomStyles();
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Modify Story: Ctrl + Alt + M
      if (e.ctrlKey && e.altKey && (e.key === "m" || e.key === "M")) {
        e.preventDefault();
        setShowModificationModal(true);
      }
      // Check Consistency: Shift + Alt + A
      if (e.shiftKey && e.altKey && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        setShowConsistencyModal(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const loadProjectsList = async () => {
    setIsLoadingProjects(true);
    try {
      const list = await getProjectsList();
      setProjectsList(list);
    } catch (e) {
      console.error("Failed to load projects list:", e);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const loadCustomStyles = async () => {
    try {
      const styles = await getCustomStyles();
      setCustomStyles(styles);
    } catch (e) {
      console.error("Failed to load custom styles:", e);
    }
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
    authors,
    creativeProfiles,
    activeProfileId,
    episodes,
    characters,
  });

  const applyState = (state: ProjectState) => {
    setSeriesTitle(state.seriesTitle || "Untitled");
    setAuthorName(state.authorName || "");
    setStoryboardStyle(state.storyboardStyle || "Cinematic");
    setAspectRatio(state.aspectRatio || "16:9");
    setLogline(state.logline || "");
    setTreatment(state.treatment || "");
    setStructuralAnalysis(state.structuralAnalysis || "");
    setSubplots(state.subplots || "");
    setSoundtrackPrompt(state.soundtrackPrompt || "");
    setReferences(state.references || []);
    setNarrativeArc(state.narrativeArc || []);
    setAuthors(state.authors || []);
    setCreativeProfiles(state.creativeProfiles || []);
    setActiveProfileId(state.activeProfileId);
    setEpisodes(state.episodes || []);
    setCharacters(state.characters || []);

    // Reset active episode if it doesn't exist in new state
    if (state.episodes && state.episodes.length > 0) {
      setActiveEpisodeId(state.episodes[0].id);
    } else {
      setActiveEpisodeId(null);
    }

    // Force UI refresh
    setResetKey((prev) => prev + 1);
  };

  // --- Project Actions ---

  const handleSaveProjectClick = () => {
    setShowSaveConfirmation(true);
  };

  const confirmSaveProject = async (saveAsNew: boolean) => {
    try {
      setShowSaveConfirmation(false);
      const state = gatherState();

      const projectId = saveAsNew ? undefined : currentProjectId;

      const id = await saveProject({
        id: projectId,
        name: seriesTitle,
        state,
      });
      setCurrentProjectId(id);
      await loadProjectsList();
      showAlert(t("projectSaved"), "", "success");
    } catch (e) {
      console.error("Failed to save project:", e);
      showAlert(
        "Error",
        t("errorGeneric", { message: "Failed to save project." }),
        "error"
      );
    }
  };

  const handleLoadProject = async (id: number) => {
    try {
      const project = await getProject(id);
      if (project) {
        setCurrentProjectId(project.id);
        applyState(project.state);
        setShowLoadProjectModal(false);
      } else {
        showAlert("Error", "Project not found.", "error");
      }
    } catch (e) {
      console.error("Failed to load project:", e);
      showAlert(
        "Error",
        t("errorGeneric", { message: "Failed to load project." }),
        "error"
      );
    }
  };

  const handleNewProjectClick = () => {
    setShowNewProjectConfirmation(true);
  };

  const confirmNewProject = () => {
    try {
      setShowNewProjectConfirmation(false);
      setCurrentProjectId(undefined);

      // Explicitly reset ALL state variables
      setSeriesTitle(t("untitledProject"));
      setAuthorName("");
      setStoryboardStyle("Cinematic");
      setAspectRatio("16:9");
      setLogline("");
      setTreatment("");
      setStructuralAnalysis("");
      setSubplots("");
      setSoundtrackPrompt("");
      setReferences([]);
      setNarrativeArc([]);
      setAuthors([]);
      setCharacters([]);
      setEpisodes([]);

      setActiveEpisodeId(null);
      setWorkflowPhase("home");
      setBibleTab("general");

      // Force component remounting
      setResetKey((prev) => prev + 1);
    } catch (e) {
      console.error("Error creating new project:", e);
      showAlert(
        "Error",
        t("errorGeneric", { message: "Failed to reset project." }),
        "error"
      );
    }
  };

  const handleDeleteProject = async (id: number) => {
    if (window.confirm(t("confirmDeleteProject"))) {
      try {
        await deleteProject(id);
        await loadProjectsList();
        if (currentProjectId === id) {
          confirmNewProject(); // Reset interface if current project was deleted
        }
      } catch (e) {
        console.error("Failed to delete project:", e);
        showAlert("Error", "Failed to delete project.", "error");
      }
    }
  };

  // ... Handlers for sub-components ...
  const handleSaveStyle = async (
    images: { id: number; file: File; preview: string }[],
    prompt: string
  ) => {
    const styleImages = await Promise.all(
      images.map(async (img) => {
        return new Promise<{ data: string; mimeType: string }>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(",")[1];
            resolve({ data: base64, mimeType: img.file.type });
          };
          reader.readAsDataURL(img.file);
        });
      })
    );

    await saveCustomStyle({
      name: `Style ${customStyles.length + 1}`,
      images: styleImages,
      prompt,
    });
    loadCustomStyles();
  };

  const handleDeleteStyle = async (id: number) => {
    if (window.confirm(t("confirmDeleteStyle"))) {
      await deleteCustomStyle(id);
      loadCustomStyles();
    }
  };

  const handleStopRegeneration = () => {
    shouldStopGeneration.current = true;
    setIsRegenerating(false);
  };

  const handleStartRegeneration = async () => {
    setIsRegenerating(true);
    shouldStopGeneration.current = false;
    setShowGenerationOffer(false); // Hide modal if open

    // Collect all jobs
    const jobs: Array<() => Promise<void>> = [];

    // Character Jobs
    characters.forEach((char) => {
      jobs.push(async () => {
        const prompt = createCharacterImagePrompt(
          char,
          storyboardStyle,
          aspectRatio
        );
        try {
          const imageUrl = await generateImage(prompt);
          setCharacters((prev) =>
            prev.map((c) =>
              c.id === char.id ? { ...c, images: [imageUrl, ...c.images] } : c
            )
          );
        } catch (e) {
          console.error(`Failed to regen character ${char.name}`, e);
        }
      });
    });

    // Shot Jobs
    episodes.forEach((ep) => {
      ep.scenes.forEach((scene) => {
        scene.shots.forEach((shot) => {
          jobs.push(async () => {
            const prompt = createImagePromptForShot(
              shot,
              scene,
              characters,
              storyboardStyle,
              aspectRatio
            );
            try {
              const imageUrl = await generateImage(prompt);
              setEpisodes((prevEps) =>
                prevEps.map((e) =>
                  e.id === ep.id
                    ? {
                        ...e,
                        scenes: e.scenes.map((s) =>
                          s.id === scene.id
                            ? {
                                ...s,
                                shots: s.shots.map((sh) =>
                                  sh.id === shot.id ? { ...sh, imageUrl } : sh
                                ),
                              }
                            : s
                        ),
                      }
                    : e
                )
              );
            } catch (e) {
              console.error(`Failed to regen shot ${shot.id}`, e);
            }
          });
        });
      });
    });

    setRegenProgress({ current: 0, total: jobs.length });

    for (let i = 0; i < jobs.length; i++) {
      if (shouldStopGeneration.current) break;
      await jobs[i]();
      setRegenProgress((prev) => ({ ...prev, current: i + 1 }));
      // Small delay
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    setIsRegenerating(false);
    shouldStopGeneration.current = false;
  };

  const activeEpisode = episodes.find((e) => e.id === activeEpisodeId);

  const menuItems = [
    { id: "home", icon: HomeIcon, label: t("home") },
    { id: "generator", icon: LayoutGridIcon, label: t("storyGeneratorTab") },
    {
      id: "bible",
      icon: BookOpenIcon,
      label: t("storyBoardTab") + " / " + t("outlineTab"),
    },
    { id: "arc", icon: ActivityIcon, label: t("narrativeArcTitle") },
    { id: "advanced_arc", icon: ActivityIcon, label: "Advanced Arc" },
    { id: "episodes", icon: FolderOpenIcon, label: t("episodes") },
    { id: "organizer", icon: LayoutGridIcon, label: t("visualOrganizerTitle") },
    { id: "storyboard", icon: FilmIcon, label: t("storyBoardTab") },
    { id: "grid_gallery", icon: LayoutGridIcon, label: "Grid Gallery" },
    { id: "gallery", icon: GalleryIcon, label: t("galleryView") },
    { id: "video", icon: VideoIcon, label: t("videoGeneratorTab") },
    { id: "utilities", icon: ChartBarIcon, label: t("utilitiesTitle") },
    { id: "authors", icon: UsersIcon, label: t("authorsTitle") },
    { id: "creativeTeam", icon: CameraIcon, label: t("creativeTeam") },
  ];

  return (
    <LanguageContext.Provider value={languageContextValue}>
      <div className="flex h-screen bg-gray-900 text-white font-sans overflow-hidden">
        {/* SIDEBAR */}
        <aside
          className={`${
            isSidebarCollapsed ? "w-20" : "w-64"
          } bg-gray-800 border-r border-gray-700 flex flex-col flex-shrink-0 transition-all duration-300 z-30 relative`}
        >
          {/* Header / Toggle */}
          <div className="h-16 flex items-center px-4 border-b border-gray-700 justify-between flex-shrink-0">
            {!isSidebarCollapsed && (
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400 truncate">
                Storyboard AI
              </span>
            )}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className={`p-2 rounded hover:bg-gray-700 text-gray-400 hover:text-white ${
                isSidebarCollapsed ? "mx-auto" : ""
              }`}
            >
              {isSidebarCollapsed ? (
                <ChevronRightIcon className="w-5 h-5" />
              ) : (
                <ChevronLeftIcon className="w-5 h-5" />
              )}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 flex flex-col gap-1">
            {/* Navigation */}
            <nav className="px-3 space-y-1">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setWorkflowPhase(item.id)}
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center px-0" : "px-3"
                  } py-2.5 rounded-md text-sm font-medium transition-colors group relative ${
                    workflowPhase === item.id
                      ? "bg-indigo-600 text-white shadow-md"
                      : "text-gray-400 hover:text-white hover:bg-gray-700"
                  }`}
                  title={isSidebarCollapsed ? item.label : undefined}
                >
                  <item.icon
                    className={`w-5 h-5 ${!isSidebarCollapsed ? "mr-3" : ""} ${
                      workflowPhase === item.id
                        ? "text-white"
                        : "text-gray-500 group-hover:text-gray-300"
                    }`}
                  />
                  {!isSidebarCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </button>
              ))}
            </nav>

            <div className="my-2 border-t border-gray-700 mx-4"></div>

            {/* Project Actions */}
            <div className="px-3 space-y-1">
              {!isSidebarCollapsed && (
                <div className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-2">
                  {t("project")}
                </div>
              )}

              <button
                onClick={handleNewProjectClick}
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0" : "px-3"
                } py-2 rounded-md text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-700 transition-colors`}
                title={t("newProject")}
              >
                <PlusIcon
                  className={`w-5 h-5 ${!isSidebarCollapsed ? "mr-3" : ""}`}
                />
                {!isSidebarCollapsed && t("newProject")}
              </button>

              <button
                onClick={handleSaveProjectClick}
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0" : "px-3"
                } py-2 rounded-md text-sm font-medium text-gray-400 hover:text-indigo-400 hover:bg-gray-700 transition-colors`}
                title={t("saveProject")}
              >
                <FloppyDiskIcon
                  className={`w-5 h-5 ${!isSidebarCollapsed ? "mr-3" : ""}`}
                />
                {!isSidebarCollapsed && t("saveProject")}
              </button>

              <button
                onClick={() => {
                  loadProjectsList();
                  setShowLoadProjectModal(true);
                }}
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0" : "px-3"
                } py-2 rounded-md text-sm font-medium text-gray-400 hover:text-indigo-400 hover:bg-gray-700 transition-colors`}
                title={t("loadProject")}
              >
                <FolderOpenIcon
                  className={`w-5 h-5 ${!isSidebarCollapsed ? "mr-3" : ""}`}
                />
                {!isSidebarCollapsed && t("loadProject")}
              </button>

              <button
                onClick={() => setShowModificationModal(true)}
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0" : "px-3"
                } py-2 rounded-md text-sm font-medium text-gray-400 hover:text-purple-400 hover:bg-gray-700 transition-colors`}
                title={t("modifyStory")}
              >
                <WandIcon
                  className={`w-5 h-5 ${!isSidebarCollapsed ? "mr-3" : ""}`}
                />
                {!isSidebarCollapsed && t("modifyStory")}
              </button>

              <button
                onClick={() => setShowConsistencyModal(true)}
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0" : "px-3"
                } py-2 rounded-md text-sm font-medium text-gray-400 hover:text-yellow-400 hover:bg-gray-700 transition-colors`}
                title={t("checkConsistency")}
              >
                <CheckCircleIcon
                  className={`w-5 h-5 ${!isSidebarCollapsed ? "mr-3" : ""}`}
                />
                {!isSidebarCollapsed && t("checkConsistency")}
              </button>

              <button
                onClick={() => setShowSettingsModal(true)}
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? "justify-center px-0" : "px-3"
                } py-2 rounded-md text-sm font-medium text-gray-400 hover:text-indigo-400 hover:bg-gray-700 transition-colors`}
                title={t("settingsTitle")}
              >
                <SettingsIcon
                  className={`w-5 h-5 ${!isSidebarCollapsed ? "mr-3" : ""}`}
                />
                {!isSidebarCollapsed && t("settingsTitle")}
              </button>
            </div>
          </div>

          {/* Visual Settings */}
          {!isSidebarCollapsed && (
            <div className="px-3 pb-4 space-y-3 border-t border-gray-700 pt-4">
              <div className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {t("visualSettings")}
              </div>

              <div className="px-3">
                <label
                  htmlFor="sidebar-style"
                  className="block text-xs font-medium text-gray-400 mb-1.5"
                >
                  {t("storyboardStyle")}
                </label>
                <select
                  id="sidebar-style"
                  value={storyboardStyle}
                  onChange={(e) =>
                    setStoryboardStyle(e.target.value as StoryboardStyle)
                  }
                  className="block w-full rounded-md border-0 bg-gray-700/50 py-1.5 px-2 text-white text-sm shadow-sm ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                >
                  {Object.entries(
                    languageContextValue.options.storyboardStyleOptions
                  ).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="px-3">
                <label
                  htmlFor="sidebar-ratio"
                  className="block text-xs font-medium text-gray-400 mb-1.5"
                >
                  {t("aspectRatio")}
                </label>
                <select
                  id="sidebar-ratio"
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="block w-full rounded-md border-0 bg-gray-700/50 py-1.5 px-2 text-white text-sm shadow-sm ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                >
                  {Object.entries(
                    languageContextValue.options.aspectRatioOptions
                  ).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="p-4 border-t border-gray-700 flex-shrink-0">
            <LanguageSelector collapsed={isSidebarCollapsed} />
            {!isSidebarCollapsed && (
              <div className="text-xs text-gray-500 text-center mt-4">
                v1.6.6 Studio Edition
              </div>
            )}
          </div>
        </aside>

        {/* MAIN WRAPPER */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* TOP HEADER */}
          <header className="h-16 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-6 flex-shrink-0 shadow-sm z-20">
            {/* Left: Title */}
            <div className="flex items-center gap-4 w-full justify-center md:justify-start">
              <div className="flex flex-col w-full max-w-md">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                  {t("project")}
                </label>
                <input
                  type="text"
                  value={seriesTitle}
                  onChange={(e) => setSeriesTitle(e.target.value)}
                  className="bg-transparent border-none text-lg font-bold text-white focus:ring-0 placeholder-gray-500 p-0 w-full"
                  placeholder={t("untitledProject")}
                />
              </div>
            </div>
          </header>

          {/* CONTENT AREA */}
          <main className="flex-1 overflow-y-auto p-6 scroll-smooth bg-gray-900 relative">
            <div className="max-w-7xl mx-auto">
              {workflowPhase === "home" && (
                <Home
                  setWorkflowPhase={setWorkflowPhase}
                  onOpenModificationModal={() => setShowModificationModal(true)}
                  onOpenConsistencyModal={() => setShowConsistencyModal(true)}
                />
              )}
              {workflowPhase === "bible" && (
                <SeriesBible
                  key={resetKey}
                  logline={logline}
                  setLogline={setLogline}
                  treatment={treatment}
                  setTreatment={setTreatment}
                  subplots={subplots}
                  setSubplots={setSubplots}
                  references={references}
                  structuralAnalysis={structuralAnalysis}
                  setStructuralAnalysis={setStructuralAnalysis}
                  soundtrackPrompt={soundtrackPrompt}
                  setSoundtrackPrompt={setSoundtrackPrompt}
                  characters={characters}
                  updateCharacter={(c) =>
                    setCharacters((prev) =>
                      prev.map((char) => (char.id === c.id ? c : char))
                    )
                  }
                  deleteCharacter={(id) =>
                    setCharacters((prev) => prev.filter((c) => c.id !== id))
                  }
                  storyboardStyle={storyboardStyle}
                  aspectRatio={aspectRatio}
                  customStyles={customStyles}
                  onSaveAndApplyStyle={handleSaveStyle}
                  onDeleteStyle={handleDeleteStyle}
                  activeTab={bibleTab}
                  onTabChange={setBibleTab}
                  onAddCharacter={() =>
                    setCharacters([
                      ...characters,
                      {
                        id: generateId(),
                        name: "",
                        role: "",
                        personality: "",
                        appearance: "",
                        outfit: "",
                        behavior: "",
                        images: [],
                      },
                    ])
                  }
                />
              )}

              {workflowPhase === "arc" && (
                <NarrativeArcEditor
                  key={resetKey}
                  arc={narrativeArc}
                  setArc={setNarrativeArc}
                  currentLogline={logline}
                  currentTreatment={treatment}
                  currentEpisodes={episodes}
                  onStoryUpdated={(l, t, e) => {
                    setLogline(l);
                    setTreatment(
                      t
                    ); /* Logic to merge episodes needed if complex */
                  }}
                />
              )}

              {workflowPhase === "generator" && (
                <StoryGenerator
                  key={resetKey}
                  storyboardStyle={storyboardStyle}
                  setStoryboardStyle={setStoryboardStyle}
                  aspectRatio={aspectRatio}
                  setAspectRatio={setAspectRatio}
                  activeProfile={creativeProfiles.find(
                    (p) => p.id === activeProfileId
                  )}
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
                      authors: authors,
                      characters: preview.characters.map((c, i) => ({
                        ...c,
                        id: generateId() + i,
                        images: [],
                      })),
                      episodes: preview.episodes.map((ep, i) => ({
                        ...ep,
                        id: generateId() + i,
                        scenes: ep.scenes.map((s, j) => ({
                          ...s,
                          id: generateId() + j,
                          shots:
                            s.shots && s.shots.length > 0
                              ? s.shots.map((shot, k) => ({
                                  ...shot,
                                  id: generateId() + k,
                                  imageUrl: shot.imageUrl || null,
                                  videoUrl: shot.videoUrl || null,
                                }))
                              : [
                                  {
                                    id: generateId(),
                                    description: s.actions || "Scene action",
                                    shotType: "Wide Shot (WS)",
                                    cameraMovement: "Static",
                                    cameraType: "Digital Cinema Camera",
                                    lensType: "Standard (35mm-50mm)",
                                    lensBlur: "None",
                                    atmosphere: "Neutral",
                                    lighting: "Natural Light",
                                    style: "Cinematic",
                                    technicalNotes: "",
                                    colorGrade: "Neutral",
                                    filmGrain: "None",
                                    filmStock: "Digital",
                                    duration: 5,
                                    soundFx: "",
                                    notes: "",
                                    subplot: "",
                                  },
                                ],
                        })),
                      })),
                    });
                    setWorkflowPhase("bible");
                    setShowGenerationOffer(true);
                  }}
                />
              )}

              {workflowPhase === "episodes" && (
                <EpisodeList
                  key={resetKey}
                  episodes={episodes}
                  activeEpisodeId={activeEpisodeId}
                  onSelectEpisode={(id) => {
                    setActiveEpisodeId(id);
                    setWorkflowPhase("storyboard");
                  }}
                  onAddEpisode={() => {
                    const newEp = {
                      id: generateId(),
                      title: `Episode ${episodes.length + 1}`,
                      synopsis: "",
                      scenes: [],
                    };
                    setEpisodes([...episodes, newEp]);
                    setActiveEpisodeId(newEp.id);
                  }}
                  onDeleteEpisode={(id) => {
                    setEpisodes((prev) => prev.filter((e) => e.id !== id));
                    if (activeEpisodeId === id) setActiveEpisodeId(null);
                  }}
                  onUpdateEpisode={(id, data) =>
                    setEpisodes((prev) =>
                      prev.map((e) => (e.id === id ? { ...e, ...data } : e))
                    )
                  }
                />
              )}

              {workflowPhase === "organizer" && (
                <VisualOrganizer
                  key={resetKey}
                  episodes={episodes}
                  onUpdateEpisodes={(newEpisodes) => {
                    setEpisodes(newEpisodes);
                    // Trigger consistency check workflow automatically
                    if (
                      window.confirm(
                        t("updateStoryOrder") +
                          "? " +
                          t("consistencyModalDescription")
                      )
                    ) {
                      setShowConsistencyModal(true);
                    }
                  }}
                />
              )}

              {workflowPhase === "gallery" && (
                <GalleryView
                  scenes={episodes.flatMap((e) => e.scenes)}
                  characters={characters}
                  onClose={() => setWorkflowPhase("storyboard")}
                />
              )}

              {workflowPhase === "grid_gallery" && (
                <GridGallery episodes={episodes} characters={characters} />
              )}

              {workflowPhase === "advanced_arc" && (
                <AdvancedNarrativeArc
                  projectState={{
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
                    authors,
                    creativeProfiles,
                    activeProfileId,
                    episodes,
                    characters,
                  }}
                  onUpdate={(newState) => {
                    if (newState.episodes) setEpisodes(newState.episodes);
                    if (newState.narrativeArc)
                      setNarrativeArc(newState.narrativeArc);
                  }}
                />
              )}

              {workflowPhase === "storyboard" && activeEpisode ? (
                <div className="animate-fade-in">
                  <div className="mb-6 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                      <FilmIcon className="w-6 h-6 text-indigo-400" />
                      {activeEpisode.title}
                      <span className="text-sm font-normal text-gray-500 ml-2">
                        ({activeEpisode.scenes.length} scenes)
                      </span>
                    </h2>
                    <button
                      onClick={() => setWorkflowPhase("episodes")}
                      className="text-sm text-indigo-400 hover:underline"
                    >
                      &larr; Back to Episodes
                    </button>
                  </div>
                  <Storyboard
                    key={activeEpisode.id} // Force reset on episode change
                    scenes={activeEpisode.scenes}
                    characters={characters}
                    storyboardStyle={storyboardStyle}
                    aspectRatio={aspectRatio}
                    updateSceneDetails={(id, details) => {
                      setEpisodes((prev) =>
                        prev.map((ep) =>
                          ep.id === activeEpisode.id
                            ? {
                                ...ep,
                                scenes: ep.scenes.map((s) =>
                                  s.id === id ? { ...s, ...details } : s
                                ),
                              }
                            : ep
                        )
                      );
                    }}
                    deleteScene={(id) => {
                      setEpisodes((prev) =>
                        prev.map((ep) =>
                          ep.id === activeEpisode.id
                            ? {
                                ...ep,
                                scenes: ep.scenes.filter((s) => s.id !== id),
                              }
                            : ep
                        )
                      );
                    }}
                    addShot={(sceneId) => {
                      setEpisodes((prev) =>
                        prev.map((ep) =>
                          ep.id === activeEpisode.id
                            ? {
                                ...ep,
                                scenes: ep.scenes.map((s) =>
                                  s.id === sceneId
                                    ? {
                                        ...s,
                                        shots: [
                                          ...s.shots,
                                          {
                                            id: generateId(),
                                            description: "",
                                            imageUrl: null,
                                            videoUrl: null,
                                            shotType: "Medium Shot (MS)",
                                            cameraMovement: "Static",
                                            cameraType: "Digital Cinema Camera",
                                            lensType: "Standard",
                                            lensBlur: "None",
                                            atmosphere: "Neutral",
                                            lighting: "Natural Light",
                                            style: "Cinematic",
                                            technicalNotes: "",
                                            colorGrade: "Neutral",
                                            filmGrain: "None",
                                            filmStock: "Digital",
                                            duration: 2,
                                            soundFx: "",
                                            notes: "",
                                            subplot: "",
                                          },
                                        ],
                                      }
                                    : s
                                ),
                              }
                            : ep
                        )
                      );
                    }}
                    updateShot={(sceneId, shot) => {
                      setEpisodes((prev) =>
                        prev.map((ep) =>
                          ep.id === activeEpisode.id
                            ? {
                                ...ep,
                                scenes: ep.scenes.map((s) =>
                                  s.id === sceneId
                                    ? {
                                        ...s,
                                        shots: s.shots.map((sh) =>
                                          sh.id === shot.id ? shot : sh
                                        ),
                                      }
                                    : s
                                ),
                              }
                            : ep
                        )
                      );
                    }}
                    deleteShot={(sceneId, shotId) => {
                      setEpisodes((prev) =>
                        prev.map((ep) =>
                          ep.id === activeEpisode.id
                            ? {
                                ...ep,
                                scenes: ep.scenes.map((s) =>
                                  s.id === sceneId
                                    ? {
                                        ...s,
                                        shots: s.shots.filter(
                                          (sh) => sh.id !== shotId
                                        ),
                                      }
                                    : s
                                ),
                              }
                            : ep
                        )
                      );
                    }}
                    reorderScenes={(start, end) => {
                      const newScenes = [...activeEpisode.scenes];
                      const [removed] = newScenes.splice(start, 1);
                      newScenes.splice(end, 0, removed);
                      setEpisodes((prev) =>
                        prev.map((ep) =>
                          ep.id === activeEpisode.id
                            ? { ...ep, scenes: newScenes }
                            : ep
                        )
                      );
                    }}
                    reorderShots={(sceneId, start, end) => {
                      setEpisodes((prev) =>
                        prev.map((ep) =>
                          ep.id === activeEpisode.id
                            ? {
                                ...ep,
                                scenes: ep.scenes.map((s) => {
                                  if (s.id !== sceneId) return s;
                                  const newShots = [...s.shots];
                                  const [removed] = newShots.splice(start, 1);
                                  newShots.splice(end, 0, removed);
                                  return { ...s, shots: newShots };
                                }),
                              }
                            : ep
                        )
                      );
                    }}
                  />
                </div>
              ) : (
                workflowPhase === "storyboard" && (
                  <div className="text-center py-20 text-gray-500 bg-gray-800/20 rounded-xl border border-dashed border-gray-700">
                    <FilmIcon className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                    <p className="text-lg mb-2">No Episode Selected</p>
                    <button
                      onClick={() => setWorkflowPhase("episodes")}
                      className="text-indigo-400 hover:underline"
                    >
                      Go to Episodes List
                    </button>
                  </div>
                )
              )}

              {workflowPhase === "video" && <VideoGenerator />}

              {workflowPhase === "authors" && (
                <ProjectAuthors
                  authors={authors}
                  setAuthors={setAuthors}
                  currentUser={user?.email || "Current User"}
                />
              )}

              {workflowPhase === "creativeTeam" && (
                <CreativeProfileManager
                  profiles={creativeProfiles}
                  onUpdateProfiles={setCreativeProfiles}
                  activeProfileId={activeProfileId}
                  onSetActiveProfile={setActiveProfileId}
                />
              )}

              {workflowPhase === "utilities" && (
                <Utilities
                  key={resetKey}
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
                  isRegenerating={isRegenerating}
                  regenerationProgress={regenProgress}
                  onStartRegeneration={handleStartRegeneration}
                  onStopRegeneration={handleStopRegeneration}
                  showAlert={showAlert}
                />
              )}

              {workflowPhase === "authors" && (
                <ProjectAuthors
                  key={resetKey}
                  authors={authors}
                  setAuthors={setAuthors}
                />
              )}

              {workflowPhase === "creative-team" && (
                <CreativeProfileManager
                  profiles={creativeProfiles}
                  activeProfileId={activeProfileId}
                  onUpdateProfiles={setCreativeProfiles}
                  onSetActiveProfile={setActiveProfileId}
                />
              )}
            </div>
          </main>

          {/* --- MODALS --- */}

          {/* New Project Confirmation Modal */}
          {showNewProjectConfirmation && (
            <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-gray-800 rounded-xl shadow-2xl max-w-md w-full border border-gray-700 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-red-900/20 rounded-full">
                    <TrashIcon className="w-6 h-6 text-red-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">
                    {t("unsavedChangesTitle")}
                  </h3>
                </div>
                <p className="text-gray-300 mb-6">
                  {t("unsavedChangesMessage")}
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowNewProjectConfirmation(false)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-sm font-medium transition-colors"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    onClick={confirmNewProject}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors"
                  >
                    {t("proceed")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Save Project Confirmation Modal */}
          {showSaveConfirmation && (
            <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-gray-800 rounded-xl shadow-2xl max-w-md w-full border border-gray-700 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-indigo-900/20 rounded-full">
                    <FloppyDiskIcon className="w-6 h-6 text-indigo-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">
                    {t("confirmSaveTitle")}
                  </h3>
                </div>
                <p className="text-gray-300 mb-6">{t("confirmSaveMessage")}</p>
                <div className="flex flex-col gap-3">
                  {currentProjectId && (
                    <button
                      onClick={() => confirmSaveProject(false)}
                      className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-sm font-bold transition-colors flex items-center justify-center gap-2"
                    >
                      <FloppyDiskIcon className="w-4 h-4" />
                      {t("overwrite")}
                    </button>
                  )}
                  <button
                    onClick={() => confirmSaveProject(true)}
                    className={`w-full px-4 py-3 ${
                      currentProjectId
                        ? "bg-gray-700 hover:bg-gray-600"
                        : "bg-indigo-600 hover:bg-indigo-500"
                    } text-white rounded-md text-sm font-bold transition-colors`}
                  >
                    {t("saveAsNew")}
                  </button>
                  <button
                    onClick={() => setShowSaveConfirmation(false)}
                    className="w-full px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors mt-2"
                  >
                    {t("cancel")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showPDFModal && (
            <PDFExportModal
              onExport={(opts) => {
                import("./services/pdfService").then((mod) => {
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
                    narrativeArc,
                    authors, // Pass authors
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
              scenes={
                activeEpisode
                  ? activeEpisode.scenes
                  : episodes.flatMap((e) => e.scenes)
              }
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
                  const result = await modifyStory(
                    gatherState(),
                    settings,
                    language,
                    creativeProfiles.find((p) => p.id === activeProfileId)
                  );
                  setModificationPreviewData({
                    explanation: result.explanation,
                    state: result.state,
                  });
                  setShowModificationPreview(true);
                } catch (e) {
                  alert(t("coCreationError"));
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
                  const result = await ensureStoryConsistency(
                    gatherState(),
                    language,
                    settings
                  );
                  applyState(result.state);
                  setShowConsistencyModal(false);
                  alert(t("projectSaved") + "\n" + result.explanation);
                } catch (e) {
                  alert(t("errorGeneric", { message: (e as Error).message }));
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

          {/* Load Project Modal */}
          {showLoadProjectModal && (
            <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full border border-gray-700 flex flex-col max-h-[80vh]">
                <div className="flex justify-between items-center p-4 border-b border-gray-700">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <FolderOpenIcon className="w-6 h-6 text-indigo-400" />
                    {t("loadProject")}
                  </h3>
                  <button
                    onClick={() => setShowLoadProjectModal(false)}
                    className="p-2 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white transition-colors"
                  >
                    <CloseIcon className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                  {isLoadingProjects ? (
                    <div className="text-center py-12">
                      <LoadingSpinner />
                      <p className="mt-4 text-gray-400">
                        {t("fetchingProjects")}
                      </p>
                    </div>
                  ) : projectsList.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 flex flex-col items-center">
                      <FolderOpenIcon className="w-12 h-12 mb-3 opacity-30" />
                      <p>{t("noProjectsFoundError")}</p>
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {projectsList.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => handleLoadProject(p.id)}
                          className="flex items-center justify-between p-4 bg-gray-700/30 hover:bg-gray-700 rounded-lg cursor-pointer group border border-transparent hover:border-indigo-500/50 transition-all"
                        >
                          <div>
                            <h4 className="font-bold text-white text-lg">
                              {p.name || t("untitledProject")}
                            </h4>
                            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                              {t("modified")}:{" "}
                              {new Date(p.modified).toLocaleDateString()}{" "}
                              {new Date(p.modified).toLocaleTimeString()}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProject(p.id);
                            }}
                            className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                            title={t("deleteProject")}
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Generation Offer Modal */}
          {showGenerationOffer && (
            <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full border border-indigo-500/50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-indigo-900/50 rounded-full">
                    <WandIcon className="w-6 h-6 text-indigo-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">
                    {t("confirmMassGenerationTitle")}
                  </h3>
                </div>
                <p className="text-gray-300 mb-6">
                  {t("confirmMassGenerationMessage", {
                    count:
                      episodes.reduce(
                        (acc, ep) =>
                          acc +
                          ep.scenes.reduce(
                            (sAcc, s) => sAcc + s.shots.length,
                            0
                          ),
                        0
                      ) + characters.length,
                  })}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowGenerationOffer(false)}
                    className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-sm font-medium transition-colors"
                  >
                    {t("confirmMassGenerationNo")}
                  </button>
                  <button
                    onClick={handleStartRegeneration}
                    className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20"
                  >
                    {t("confirmMassGenerationYes")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Global Generation Progress Overlay */}
          {isRegenerating && (
            <div className="fixed bottom-6 right-6 z-50 bg-gray-800 border border-indigo-500/50 rounded-lg shadow-2xl p-4 w-80 animate-fade-in-up">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <WandIcon className="w-4 h-4 text-indigo-400 animate-pulse" />
                  {t("generating")}
                </h4>
                <button>{t("stopRegeneration")}</button>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                <div
                  className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      (regenProgress.current / regenProgress.total) * 100
                    }%`,
                  }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>
                  {regenProgress.current} / {regenProgress.total}
                </span>
                <span>
                  {Math.round(
                    (regenProgress.current / regenProgress.total) * 100
                  )}
                  %
                </span>
              </div>
            </div>
          )}

          <AlertModal
            isOpen={alertState.isOpen}
            onClose={closeAlert}
            title={alertState.title}
            message={alertState.message}
            type={alertState.type}
          />
        </div>
        {showSettingsModal && (
          <SettingsModal onClose={() => setShowSettingsModal(false)} />
        )}
      </div>
    </LanguageContext.Provider>
  );
};
