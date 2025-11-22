
import React, { ChangeEvent, useState } from 'react';
import type { Reference } from '../types';
import { useLanguage } from '../contexts/languageContext';
import { ChevronDownIcon } from './icons';

interface StoryOutlineProps {
  logline: string;
  setLogline: (value: string) => void;
  treatment: string;
  setTreatment: (value: string) => void;
  subplots: string;
  setSubplots: (value: string) => void;
  references: Reference[];
  structuralAnalysis: string;
  setStructuralAnalysis: (value: string) => void;
  soundtrackPrompt: string;
  setSoundtrackPrompt: (value: string) => void;
}

const TextAreaField: React.FC<{ label: string; value: string; onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void; name: string; rows?: number; placeholder: string }> = ({ label, ...props }) => (
    <div>
      <label className="block text-lg font-semibold text-gray-200 mb-2">{label}</label>
      <textarea
        className="block w-full rounded-md border-0 bg-white/5 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
        {...props}
      />
    </div>
);

export const StoryOutline: React.FC<StoryOutlineProps> = ({ logline, setLogline, treatment, setTreatment, subplots, setSubplots, references, structuralAnalysis, setStructuralAnalysis, soundtrackPrompt, setSoundtrackPrompt }) => {
  const { t } = useLanguage();
  const [referencesOpen, setReferencesOpen] = useState(true);

  return (
    <div className="space-y-8">
      <div>
        <TextAreaField 
            label={t('logline')}
            name="logline"
            value={logline}
            onChange={(e) => setLogline(e.target.value)}
            rows={2}
            placeholder={t('loglinePlaceholder')}
        />
      </div>
      <div>
        <TextAreaField 
            label={t('subplots')}
            name="subplots"
            value={subplots}
            onChange={(e) => setSubplots(e.target.value)}
            rows={3}
            placeholder={t('subplotsPlaceholder')}
        />
      </div>
      <div>
        <TextAreaField 
            label={t('soundtrackPrompt')}
            name="soundtrackPrompt"
            value={soundtrackPrompt}
            onChange={(e) => setSoundtrackPrompt(e.target.value)}
            rows={3}
            placeholder={t('soundtrackPromptPlaceholder')}
        />
      </div>
       <div>
        <TextAreaField 
            label={t('structuralAnalysis')}
            name="structuralAnalysis"
            value={structuralAnalysis}
            onChange={(e) => setStructuralAnalysis(e.target.value)}
            rows={4}
            placeholder={t('structuralAnalysisPlaceholder')}
        />
      </div>
      <div>
        <TextAreaField 
            label={t('treatment')}
            name="treatment"
            value={treatment}
            onChange={(e) => setTreatment(e.target.value)}
            rows={10}
            placeholder={t('treatmentPlaceholder')}
        />
      </div>
      <div>
          <div 
              className="flex justify-between items-center cursor-pointer mb-3"
              onClick={() => setReferencesOpen(!referencesOpen)}
              aria-expanded={referencesOpen}
              aria-controls="references-section"
          >
              <h2 className="text-lg font-semibold text-gray-200">{t('references')}</h2>
              <ChevronDownIcon className={`w-6 h-6 text-gray-400 transform transition-transform duration-200 ${referencesOpen ? 'rotate-180' : ''}`} />
          </div>
          
          <div id="references-section" className={`transition-all duration-300 ease-in-out overflow-hidden ${referencesOpen ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
            {references.length === 0 ? (
              <p className="text-gray-400 pt-2">{t('noReferences')}</p>
            ) : (
              <div className="space-y-4 pt-2">
                  {references.map((ref, index) => (
                      <div key={index} className="bg-gray-700/50 p-4 rounded-md border border-gray-600">
                          <h3 className="font-bold text-lg text-white">{ref.title}</h3>
                          {ref.details && <p className="text-sm text-gray-400 italic mt-1">{ref.details}</p>}
                          <p className="text-sm text-gray-300 mt-2"><strong className="text-gray-400">{t('referenceRelevance')}:</strong> {ref.description}</p>
                          <a href={ref.uri} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-400 hover:underline mt-2 inline-block font-semibold">
                            {t('viewReferenceLink')}
                          </a>
                      </div>
                  ))}
              </div>
            )}
          </div>
      </div>
    </div>
  );
};
