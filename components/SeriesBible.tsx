
import React from 'react';
import { StoryOutline } from './StoryOutline';
import { CharacterDesigner } from './CharacterDesigner';
import { StyleTransfer } from './StyleTransfer';
import type { Reference, Character, CustomStyle, StoryboardStyle, CustomStyleImage } from '../types';
import { useLanguage } from '../contexts/languageContext';
import { PlusIcon } from './icons';

interface SeriesBibleProps {
    logline: string;
    setLogline: (v: string) => void;
    treatment: string;
    setTreatment: (v: string) => void;
    subplots: string;
    setSubplots: (v: string) => void;
    references: Reference[];
    structuralAnalysis: string;
    setStructuralAnalysis: (v: string) => void;
    soundtrackPrompt: string;
    setSoundtrackPrompt: (v: string) => void;
    
    characters: Character[];
    updateCharacter: (c: Character) => void;
    deleteCharacter: (id: number) => void;
    
    storyboardStyle: StoryboardStyle;
    aspectRatio: string;
    
    customStyles: CustomStyle[];
    onSaveAndApplyStyle: (referenceImages: {id: number, file: File, preview: string}[], referencePrompt: string) => void;
    onDeleteStyle: (id: number) => void;

    activeTab: 'general' | 'characters' | 'style';
    onTabChange: (tab: 'general' | 'characters' | 'style') => void;
    onAddCharacter: () => void;
}

export const SeriesBible: React.FC<SeriesBibleProps> = (props) => {
    const { t } = useLanguage();

    return (
        <div className="space-y-6">
            <div className="flex space-x-1 bg-gray-800/50 p-1 rounded-lg border border-gray-700 w-fit">
                <button 
                    onClick={() => props.onTabChange('general')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${props.activeTab === 'general' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-gray-700/50'}`}
                >
                    Overview & Arc
                </button>
                <button 
                    onClick={() => props.onTabChange('characters')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${props.activeTab === 'characters' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-gray-700/50'}`}
                >
                    Characters ({props.characters.length})
                </button>
                <button 
                    onClick={() => props.onTabChange('style')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${props.activeTab === 'style' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-gray-700/50'}`}
                >
                    Visual Style
                </button>
            </div>

            <div className="animate-fade-in">
                {props.activeTab === 'general' && (
                    <div className="bg-gray-800/30 p-6 rounded-xl border border-gray-700/50">
                        <StoryOutline 
                            logline={props.logline}
                            setLogline={props.setLogline}
                            treatment={props.treatment}
                            setTreatment={props.setTreatment}
                            subplots={props.subplots}
                            setSubplots={props.setSubplots}
                            references={props.references}
                            structuralAnalysis={props.structuralAnalysis}
                            setStructuralAnalysis={props.setStructuralAnalysis}
                            soundtrackPrompt={props.soundtrackPrompt}
                            setSoundtrackPrompt={props.setSoundtrackPrompt}
                        />
                    </div>
                )}
                
                {props.activeTab === 'characters' && (
                    <>
                        <div className="flex justify-end mb-4">
                             <button onClick={props.onAddCharacter} className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 h-10 px-4 py-2">
                                <PlusIcon className="w-4 h-4 mr-2" /> {t('addCharacter')}
                            </button>
                        </div>
                        <CharacterDesigner 
                            characters={props.characters}
                            updateCharacter={props.updateCharacter}
                            deleteCharacter={props.deleteCharacter}
                            storyboardStyle={props.storyboardStyle}
                            aspectRatio={props.aspectRatio}
                        />
                    </>
                )}
                
                {props.activeTab === 'style' && (
                    <div className="bg-gray-800/30 p-6 rounded-xl border border-gray-700/50">
                        <StyleTransfer 
                            customStyles={props.customStyles}
                            onSaveAndApplyStyle={props.onSaveAndApplyStyle}
                            onDeleteStyle={props.onDeleteStyle}
                            isApplying={false}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
