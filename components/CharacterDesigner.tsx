import React from 'react';
import type { Character, StoryboardStyle } from '../types';
import { CharacterCard } from './CharacterCard';
import { useLanguage } from '../contexts/languageContext';

interface CharacterDesignerProps {
  characters: Character[];
  updateCharacter: (character: Character) => void;
  deleteCharacter: (characterId: number) => void;
  storyboardStyle: StoryboardStyle;
  aspectRatio: string;
}

export const CharacterDesigner: React.FC<CharacterDesignerProps> = ({ characters, updateCharacter, deleteCharacter, storyboardStyle, aspectRatio }) => {
  const { t } = useLanguage();
  return (
    <div className="space-y-6">
      {characters.length === 0 && (
          <div className="text-center py-12 px-6 bg-gray-800/30 rounded-lg border-2 border-dashed border-gray-700">
              <p className="text-gray-400">{t('noCharactersYet')}</p>
          </div>
      )}
      {characters.map((character) => (
        <CharacterCard 
          key={character.id}
          character={character} 
          updateCharacter={updateCharacter} 
          deleteCharacter={deleteCharacter}
          storyboardStyle={storyboardStyle}
          aspectRatio={aspectRatio}
        />
      ))}
    </div>
  );
};