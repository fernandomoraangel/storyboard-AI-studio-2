
import React, { useState, useEffect, useCallback } from 'react';
import type { Scene } from '../types';
import { useLanguage } from '../contexts/languageContext';
import { LoadingSpinner } from './LoadingSpinner';
import { CloseIcon, WandIcon, CheckCircleIcon, RefreshCwIcon, VideoIcon } from './icons';
import { generateAnimatic } from '../services/animaticService';
import { 
    uploadToFrameIO, 
    getFrameIOProjects, 
    createFrameIOProject, 
    FrameIOProject,
    isFrameIOConfigured,
    setDeveloperToken,
    disconnectFrameIO,
    forgetFrameIOConfig,
    testFrameIOConnection,
} from '../services/frameioService';

interface FrameIOExportModalProps {
    scenes: Scene[];
    aspectRatio: string;
    storyTitle: string;
    onClose: () => void;
}

export const FrameIOExportModal: React.FC<FrameIOExportModalProps> = ({ scenes, aspectRatio, storyTitle, onClose }) => {
    const { t } = useLanguage();
    
    const [isConfigured, setIsConfigured] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [initialFetchDone, setInitialFetchDone] = useState(false);

    const [projects, setProjects] = useState<FrameIOProject[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [newProjectName, setNewProjectName] = useState(storyTitle || 'New Storyboard Project');
    
    const [isFetchingProjects, setIsFetchingProjects] = useState(false);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [animaticPreviewUrl, setAnimaticPreviewUrl] = useState<string | null>(null);
    const [animaticBlob, setAnimaticBlob] = useState<Blob | null>(null);

    const [isLoading, setIsLoading] = useState(false);
    const [progressMessage, setProgressMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [successUrl, setSuccessUrl] = useState<string | null>(null);

    // --- State for Setup Flow ---
    const [developerTokenInput, setDeveloperTokenInput] = useState('');
    const [isTestingConnection, setIsTestingConnection] = useState(false);

    // --- State for Isolated Project Creation ---
    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const [creationSuccess, setCreationSuccess] = useState<string | null>(null);
    
    const handleDisconnect = useCallback(() => {
        disconnectFrameIO();
        setIsConfigured(false);
        setProjects([]);
        setSelectedProjectId('');
        setInitialFetchDone(false);
    }, []);
    
    const checkAuthStatus = useCallback(async () => {
        setIsCheckingAuth(true);
        setIsConfigured(isFrameIOConfigured());
        setIsCheckingAuth(false);
    }, []);

    useEffect(() => {
        checkAuthStatus();
    }, [checkAuthStatus]);
    
    const handleFetchProjects = useCallback(async () => {
        setIsFetchingProjects(true);
        setError(null);
        try {
            const fetchedProjects = await getFrameIOProjects();
            setProjects(fetchedProjects);
        } catch (err) {
            console.error(err);
            setError(t('errorFetchProjects'));
            if ((err as Error).message.includes('401')) {
                handleDisconnect();
            }
        } finally {
            setIsFetchingProjects(false);
            setInitialFetchDone(true);
        }
    }, [t, handleDisconnect]);

    useEffect(() => {
        if(isConfigured && !initialFetchDone && !isFetchingProjects) {
            handleFetchProjects();
        }
    }, [isConfigured, isFetchingProjects, initialFetchDone, handleFetchProjects]);

    const handlePreviewAnimatic = async () => {
        const allShots = scenes.flatMap(s => s.shots);
        if (!allShots.some(shot => shot.imageUrl)) {
            setError(t('noImagesError'));
            return;
        }
        
        setIsPreviewing(true);
        setError(null);
        try {
            const videoBlob = await generateAnimatic(scenes, aspectRatio, {
                width: 1280,
                t: t,
                includeSceneTitles: true,
                includeShotDescriptions: true,
                fontSize: 2,
                fontColor: '#FFFFFF',
                backgroundColor: '#111827',
                textBackgroundColor: 'rgba(0, 0, 0, 0.7)',
            });
            setAnimaticBlob(videoBlob);
            setAnimaticPreviewUrl(URL.createObjectURL(videoBlob));
        } catch (err) {
            console.error("Animatic preview failed:", err);
            setError((err as Error).message);
        } finally {
            setIsPreviewing(false);
        }
    };

    const handleCreateProject = async () => {
        if (!newProjectName.trim()) return;
        setIsCreatingProject(true);
        setError(null);
        setCreationSuccess(null);
        try {
            const newProject = await createFrameIOProject(newProjectName);
            setCreationSuccess(`${t('projectCreatedSuccess')} ID: ${newProject.id}`);
            setProjects(prev => [...prev, newProject].sort((a, b) => a.name.localeCompare(b.name)));
            setSelectedProjectId(newProject.id);
        } catch (err) {
            console.error('Frame.io project creation failed:', err);
            setError((err as Error).message);
        } finally {
            setIsCreatingProject(false);
        }
    };

    const handleExport = async () => {
        if (!animaticBlob && !scenes.flatMap(s => s.shots).some(shot => shot.imageUrl)) {
            setError(t('noImagesError'));
            return;
        }
        if (!selectedProjectId || selectedProjectId === 'CREATE_NEW') {
            setError("Please create or select a project before exporting.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setSuccessUrl(null);

        try {
            const finalProjectId = selectedProjectId;

            let videoToUpload = animaticBlob;
            if (!videoToUpload) {
                setProgressMessage(t('generatingVideo'));
                videoToUpload = await generateAnimatic(scenes, aspectRatio, {
                    width: 1280,
                    t: t,
                    includeSceneTitles: true,
                    includeShotDescriptions: true,
                    fontSize: 2,
                    fontColor: '#FFFFFF',
                    backgroundColor: '#111827',
                    textBackgroundColor: 'rgba(0, 0, 0, 0.7)',
                });
                setAnimaticBlob(videoToUpload);
            }

            setProgressMessage(t('uploadingToFrameIO'));
            const fileName = `${storyTitle.replace(/ /g, '_')}_animatic.webm`;
            const result = await uploadToFrameIO(finalProjectId, videoToUpload, fileName);
            
            setSuccessUrl(result.permalink_url);

        } catch (err) {
            console.error('Frame.io export failed:', err);
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
            setProgressMessage('');
        }
    };

    const handleTestAndSaveConfig = async () => {
        if (!developerTokenInput.trim()) {
            setError(t('tokenRequiredError'));
            return;
        }
        setError(null);
        setIsTestingConnection(true);
    
        setDeveloperToken(developerTokenInput);
    
        try {
            await testFrameIOConnection();
            setIsConfigured(true);
            setInitialFetchDone(false);
        } catch (err) {
            disconnectFrameIO();
            setError(t('connectionTestFailed'));
        } finally {
            setIsTestingConnection(false);
        }
    };
    
    const renderSetup = () => (
        <div className="p-6 space-y-6">
            <h4 className="text-lg font-semibold text-center">{t('frameIOTokenSetup')}</h4>
            <div className="text-sm text-gray-400 space-y-2">
                <p>{t('setupInstructions_token_1')}</p>
                <ol className="list-decimal list-inside space-y-2 pl-2">
                    <li>{t('setupInstructions_token_2')} <a href="https://developer.frame.io/app/tokens" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">{t('developerTokensPage')}</a>.</li>
                    <li>{t('setupInstructions_token_3')}</li>
                    <li dangerouslySetInnerHTML={{ __html: t('setupInstructions_token_4') as string}}></li>
                    <li className="font-semibold text-gray-300">
                        <ul className="list-disc list-inside pl-4 font-normal text-gray-400 mt-1">
                            <li>`account.read`</li><li>`team.read`</li><li>`project.read` & `project.create`</li><li>`asset.read` & `asset.create`</li>
                        </ul>
                    </li>
                     <li dangerouslySetInnerHTML={{ __html: t('setupInstructions_token_5') as string}}></li>
                </ol>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">{t('developerTokenLabel')}</label>
                <input
                    type="password"
                    value={developerTokenInput}
                    onChange={(e) => setDeveloperTokenInput(e.target.value)}
                    placeholder="fio-dev-..."
                    className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus-ring-inset focus:ring-indigo-500 sm:text-sm"
                />
            </div>
            {error && <p className="text-sm text-red-400 text-center">{error}</p>}
            <button 
                onClick={handleTestAndSaveConfig} 
                disabled={isTestingConnection}
                className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium bg-indigo-600 text-indigo-50 hover:bg-indigo-600/90 h-10 px-4 py-2 disabled:opacity-50"
            >
                {isTestingConnection ? (
                    <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        {t('testingConnection')}
                    </>
                ) : (
                    t('saveAndTest')
                )}
            </button>
        </div>
    );
    
    const renderContent = () => {
        if (isCheckingAuth) {
            return <div className="text-center p-8"><LoadingSpinner /></div>;
        }
        if (!isConfigured) {
            return renderSetup();
        }
        if (isLoading) {
            return (
                <div className="text-center p-8">
                    <LoadingSpinner />
                    <p className="mt-4 text-gray-300">{progressMessage}</p>
                </div>
            );
        }
        if (successUrl) {
            return (
                <div className="text-center p-8">
                    <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">{t('exportSuccessTitle')}</h3>
                    <p className="text-sm text-gray-400 mb-6">{t('exportSuccessMessage')}</p>
                    <a href={successUrl} target="_blank" rel="noopener noreferrer" className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium bg-indigo-600 text-indigo-50 hover:bg-indigo-600/90 h-10 px-4 py-2">
                        {t('viewOnFrameIO')}
                    </a>
                </div>
            );
        }

        return (
             <div className="p-6 space-y-6">
                 {error && (
                    <div className="text-center p-3 bg-red-900/50 rounded-md">
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                 )}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h4 className="font-semibold text-gray-300">{t('frameIOSettings')}</h4>
                        <div className="space-x-2">
                            <button onClick={handleDisconnect} className="text-xs text-indigo-400 hover:underline">{t('disconnect')}</button>
                            <button onClick={() => { forgetFrameIOConfig(); setIsConfigured(false); }} className="text-xs text-gray-500 hover:underline">{t('resetConfiguration')}</button>
                        </div>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">{t('project')}</label>
                        <div className="flex gap-2">
                            <select
                                value={selectedProjectId}
                                onChange={(e) => setSelectedProjectId(e.target.value)}
                                disabled={isFetchingProjects}
                                className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm disabled:opacity-50"
                            >
                                <option value="">{isFetchingProjects ? t('fetchingProjects') : (projects.length === 0 && initialFetchDone) ? t('noProjectsFoundError') : t('selectProject')}</option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                <option value="CREATE_NEW" className="font-bold text-indigo-400">{t('createNewProject')}</option>
                            </select>
                            <button onClick={handleFetchProjects} disabled={isFetchingProjects} className="inline-flex items-center justify-center rounded-md text-sm px-3 py-1.5 border border-gray-600 hover:bg-gray-700 disabled:opacity-50 text-sky-400 hover:text-sky-300">
                                {isFetchingProjects ? <LoadingSpinner/> : <RefreshCwIcon className="w-4 h-4"/>}
                            </button>
                        </div>
                    </div>
                    {selectedProjectId === 'CREATE_NEW' && (
                         <div className="mt-2">
                            <label className="block text-sm font-medium text-gray-400 mb-1">{t('newProjectName')}</label>
                             <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={newProjectName}
                                    onChange={(e) => {
                                        setNewProjectName(e.target.value);
                                        setCreationSuccess(null);
                                        setError(null);
                                    }}
                                    className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm"
                                />
                                <button 
                                    onClick={handleCreateProject} 
                                    disabled={isCreatingProject || !newProjectName.trim()}
                                    className="inline-flex items-center justify-center rounded-md text-sm px-3 py-1.5 border border-gray-600 hover:bg-gray-700 disabled:opacity-50 text-sky-400 hover:text-sky-300 flex-shrink-0"
                                    aria-label={t('create') as string}
                                >
                                    {isCreatingProject ? <LoadingSpinner /> : (t('create') as string)}
                                </button>
                            </div>
                            {creationSuccess && <p className="text-sm text-green-400 mt-2">{creationSuccess}</p>}
                        </div>
                    )}
                </div>

                <div className="border-t border-gray-700 pt-6 space-y-4">
                    <h4 className="font-semibold text-gray-300 mb-2">{t('previewAnimatic')}</h4>
                    {animaticPreviewUrl && (
                        <video src={animaticPreviewUrl} controls className="w-full rounded-md bg-black"></video>
                    )}
                    <button 
                        onClick={handlePreviewAnimatic} 
                        disabled={isPreviewing}
                        className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium border border-gray-600 hover:bg-gray-700 h-10 px-4 py-2 disabled:opacity-50 text-purple-400 hover:text-purple-300"
                    >
                        {isPreviewing ? <LoadingSpinner/> : <VideoIcon className="w-4 h-4"/>}
                        <span className="ml-2">{isPreviewing ? t('previewingAnimatic') : t('previewAnimatic')}</span>
                    </button>
                </div>
                
                 <button 
                    onClick={handleExport} 
                    disabled={isLoading || !selectedProjectId || selectedProjectId === 'CREATE_NEW'}
                    className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium bg-indigo-600 text-indigo-50 hover:bg-indigo-600/90 h-10 px-4 py-2 disabled:opacity-50"
                >
                    <WandIcon className="w-4 h-4 mr-2"/>
                    {t('export')}
                </button>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full border border-gray-700 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-gray-700 flex-shrink-0">
                    <h3 className="text-lg font-semibold">{t('shareOnFrameIO')}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-700">
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="overflow-y-auto">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};