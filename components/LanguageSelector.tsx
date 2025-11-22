
import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../contexts/languageContext';
import { GlobeIcon, ChevronDownIcon } from './icons';
import { Language } from '../lib/translations';

export const LanguageSelector: React.FC = () => {
    const { language, setLanguage } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);
    
    const selectLanguage = (lang: Language) => {
        setLanguage(lang);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 px-3 py-2 text-sm rounded-md transition-colors bg-gray-700/50 hover:bg-gray-700 border border-gray-600"
                aria-haspopup="true"
                aria-expanded={isOpen}
            >
                <GlobeIcon className="h-4 w-4 text-gray-400" />
                <span>{language.toUpperCase()}</span>
                <ChevronDownIcon className={`w-4 h-4 text-gray-400 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-32 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50 py-1" role="menu">
                    <ul>
                        <li role="none">
                            <button
                                onClick={() => selectLanguage('en')}
                                className={`w-full text-left px-4 py-2 text-sm ${language === 'en' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                                role="menuitem"
                            >
                                English
                            </button>
                        </li>
                        <li role="none">
                            <button
                                onClick={() => selectLanguage('es')}
                                className={`w-full text-left px-4 py-2 text-sm ${language === 'es' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                                role="menuitem"
                            >
                                Español
                            </button>
                        </li>
                    </ul>
                </div>
            )}
        </div>
    );
};