import React, { useState } from 'react';
import { CreativeProfile } from '../types';
import { useLanguage } from '../contexts/languageContext';
import { generateCharacterFromDescription, generateImage } from '../services/geminiService';
import { LoadingSpinner } from './LoadingSpinner';
import {
    UserIcon,
    PlusIcon,
    TrashIcon,
    WandIcon,
    CheckCircleIcon,
    RefreshCwIcon,
    CameraIcon
} from './icons';

interface CreativeProfileManagerProps {
    profiles: CreativeProfile[];
    activeProfileId: string | undefined;
    onUpdateProfiles: (profiles: CreativeProfile[]) => void;
    onSetActiveProfile: (id: string | undefined) => void;
}

export const CreativeProfileManager: React.FC<CreativeProfileManagerProps> = ({
    profiles,
    activeProfileId,
    onUpdateProfiles,
    onSetActiveProfile
}) => {
    const { t, language } = useLanguage();
    const [isEditing, setIsEditing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [editingProfile, setEditingProfile] = useState<Partial<CreativeProfile>>({});
    const [generationPrompt, setGenerationPrompt] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleCreateNew = () => {
        setEditingProfile({
            id: Date.now().toString(),
            name: '',
            role: '',
            personality: '',
            background: '',
            mood: '',
            references: [],
            imageUrl: null
        });
        setIsEditing(true);
    };

    const handleEdit = (profile: CreativeProfile) => {
        setEditingProfile(profile);
        setIsEditing(true);
    };

    const handleDelete = (id: string) => {
        if (window.confirm(t('confirmDeleteProfile') || "Are you sure you want to delete this profile?")) {
            const newProfiles = profiles.filter(p => p.id !== id);
            onUpdateProfiles(newProfiles);
            if (activeProfileId === id) {
                onSetActiveProfile(undefined);
            }
        }
    };

    const handleSave = () => {
        if (!editingProfile.name || !editingProfile.role) return;

        const newProfile = editingProfile as CreativeProfile;
        const existingIndex = profiles.findIndex(p => p.id === newProfile.id);

        if (existingIndex >= 0) {
            const newProfiles = [...profiles];
            newProfiles[existingIndex] = newProfile;
            onUpdateProfiles(newProfiles);
        } else {
            onUpdateProfiles([...profiles, newProfile]);
        }
        setIsEditing(false);
    };

    const handleAutoGenerate = async () => {
        if (!generationPrompt) return;
        setIsGenerating(true);
        try {
            // We reuse the character generation service for now as it returns similar fields
            // In a real scenario, we might want a dedicated service method
            const result = await generateCharacterFromDescription(generationPrompt, language);

            setEditingProfile(prev => ({
                ...prev,
                name: result.name,
                role: result.role,
                personality: result.personality,
                background: result.behavior, // Mapping behavior to background for now
                mood: "Professional", // Default
                references: []
            }));
        } catch (e) {
            console.error("Failed to generate profile", e);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGeneratePhoto = async () => {
        if (!editingProfile.name || !editingProfile.personality) return;
        setIsGeneratingImage(true);
        try {
            const prompt = `A professional portrait of ${editingProfile.name}, a ${editingProfile.role}. Personality: ${editingProfile.personality}. High quality, photorealistic headshot.`;
            const imageUrl = await generateImage(prompt, '1:1');
            setEditingProfile(prev => ({ ...prev, imageUrl }));
        } catch (e: any) {
            console.error("Failed to generate photo", e);
            setError(e.message || "Failed to generate photo");
            setTimeout(() => setError(null), 5000);
        } finally {
            setIsGeneratingImage(false);
        }
    };

    if (isEditing) {
        return (
            <div className="max-w-4xl mx-auto p-6 bg-gray-800 rounded-xl border border-gray-700 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <UserIcon className="w-6 h-6 text-indigo-400" />
                        {editingProfile.id && profiles.find(p => p.id === editingProfile.id) ? t('editProfile') || "Edit Profile" : t('newProfile') || "New Profile"}
                    </h2>
                    <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-white">
                        <TrashIcon className="w-5 h-5" /> {/* Using TrashIcon as Close for now if CloseIcon not available, or just text */}
                        <span className="sr-only">Close</span>
                    </button>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-900/50 border border-red-700 text-red-200 rounded-lg flex items-center gap-2">
                        <span className="font-bold">Error:</span> {error}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Left Column: Photo & Auto-Gen */}
                    <div className="space-y-6">
                        <div className="aspect-square bg-gray-900 rounded-xl border-2 border-dashed border-gray-700 flex flex-col items-center justify-center relative overflow-hidden group">
                            {editingProfile.imageUrl ? (
                                <img src={editingProfile.imageUrl} alt={editingProfile.name} className="w-full h-full object-cover" />
                            ) : (
                                <UserIcon className="w-20 h-20 text-gray-600" />
                            )}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <button
                                    onClick={handleGeneratePhoto}
                                    disabled={isGeneratingImage || !editingProfile.name || !editingProfile.personality}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title={!editingProfile.name || !editingProfile.personality ? "Enter Name and Personality first" : "Generate Photo"}
                                >
                                    {isGeneratingImage ? <LoadingSpinner /> : <CameraIcon className="w-4 h-4" />}
                                    Generate Photo
                                </button>
                            </div>
                        </div>

                        <div className="bg-gray-700/30 p-4 rounded-lg border border-gray-600">
                            <h3 className="text-sm font-bold text-gray-300 mb-2 flex items-center gap-2">
                                <WandIcon className="w-4 h-4 text-purple-400" />
                                Auto-Generate Persona
                            </h3>
                            <textarea
                                value={generationPrompt}
                                onChange={(e) => setGenerationPrompt(e.target.value)}
                                placeholder="E.g. A cynical film noir detective who hates technology..."
                                className="w-full bg-gray-900 border border-gray-700 rounded-md p-2 text-sm text-white mb-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                rows={3}
                            />
                            <button
                                onClick={handleAutoGenerate}
                                disabled={isGenerating || !generationPrompt}
                                className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isGenerating ? <LoadingSpinner /> : "Generate Details"}
                            </button>
                        </div>
                    </div>

                    {/* Right Column: Form Fields */}
                    <div className="md:col-span-2 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Name</label>
                                <input
                                    type="text"
                                    value={editingProfile.name || ''}
                                    onChange={(e) => setEditingProfile(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-md p-2 text-white focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Role</label>
                                <input
                                    type="text"
                                    value={editingProfile.role || ''}
                                    onChange={(e) => setEditingProfile(prev => ({ ...prev, role: e.target.value }))}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-md p-2 text-white focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Personality</label>
                            <textarea
                                value={editingProfile.personality || ''}
                                onChange={(e) => setEditingProfile(prev => ({ ...prev, personality: e.target.value }))}
                                rows={3}
                                className="w-full bg-gray-900 border border-gray-700 rounded-md p-2 text-white focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Background / Bio</label>
                            <textarea
                                value={editingProfile.background || ''}
                                onChange={(e) => setEditingProfile(prev => ({ ...prev, background: e.target.value }))}
                                rows={3}
                                className="w-full bg-gray-900 border border-gray-700 rounded-md p-2 text-white focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Current Mood</label>
                                <input
                                    type="text"
                                    value={editingProfile.mood || ''}
                                    onChange={(e) => setEditingProfile(prev => ({ ...prev, mood: e.target.value }))}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-md p-2 text-white focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-700">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition-colors"
                            >
                                Save Profile
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-2">Creative Team</h2>
                    <p className="text-gray-400">Manage AI personas that influence your story generation.</p>
                </div>
                <button
                    onClick={handleCreateNew}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg shadow-indigo-500/20"
                >
                    <PlusIcon className="w-5 h-5" />
                    New Profile
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {profiles.map(profile => (
                    <div
                        key={profile.id}
                        className={`bg-gray-800 rounded-xl border transition-all duration-300 overflow-hidden group relative ${activeProfileId === profile.id
                            ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-xl shadow-indigo-500/10'
                            : 'border-gray-700 hover:border-gray-600 hover:shadow-lg'
                            }`}
                    >
                        {/* Active Badge */}
                        {activeProfileId === profile.id && (
                            <div className="absolute top-3 right-3 z-10 bg-indigo-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
                                <CheckCircleIcon className="w-3 h-3" />
                                Active
                            </div>
                        )}

                        <div className="p-6">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="w-16 h-16 rounded-full bg-gray-700 flex-shrink-0 overflow-hidden border-2 border-gray-600">
                                    {profile.imageUrl ? (
                                        <img src={profile.imageUrl} alt={profile.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <UserIcon className="w-8 h-8 text-gray-500" />
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white leading-tight mb-1">{profile.name}</h3>
                                    <p className="text-indigo-400 text-sm font-medium">{profile.role}</p>
                                </div>
                            </div>

                            <div className="space-y-3 mb-6">
                                <div>
                                    <span className="text-xs text-gray-500 uppercase tracking-wider font-bold">Personality</span>
                                    <p className="text-gray-300 text-sm line-clamp-2">{profile.personality}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-gray-500 uppercase tracking-wider font-bold">Mood</span>
                                    <p className="text-gray-300 text-sm">{profile.mood}</p>
                                </div>
                            </div>

                            <div className="flex gap-2 mt-auto">
                                <button
                                    onClick={() => onSetActiveProfile(activeProfileId === profile.id ? undefined : profile.id)}
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${activeProfileId === profile.id
                                        ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                                        : 'bg-gray-700 hover:bg-gray-600 text-white'
                                        }`}
                                >
                                    {activeProfileId === profile.id ? 'Deactivate' : 'Activate'}
                                </button>
                                <button
                                    onClick={() => handleEdit(profile)}
                                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => handleDelete(profile.id)}
                                    className="px-3 py-2 bg-gray-700 hover:bg-red-900/30 text-gray-400 hover:text-red-400 rounded-lg transition-colors"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Empty State */}
                {profiles.length === 0 && (
                    <div className="col-span-full py-12 text-center border-2 border-dashed border-gray-700 rounded-xl bg-gray-800/30">
                        <UserIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-400 mb-2">No Creative Profiles</h3>
                        <p className="text-gray-500 mb-6 max-w-md mx-auto">Create AI personas to influence the style, tone, and direction of your story generation.</p>
                        <button
                            onClick={handleCreateNew}
                            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition-colors"
                        >
                            Create First Profile
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
