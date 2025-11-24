
import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../contexts/languageContext';
import { GlobeIcon, ChevronDownIcon } from './icons';
import { Language } from '../lib/translations';

interface LanguageSelectorProps {
    collapsed?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ collapsed }) => {
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
        <div className="relative w-full" ref={wrapperRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center ${collapsed ? 'justify-center w-full' : 'space-x-2 px-3'} py-2 text-sm rounded-md transition-colors hover:bg-gray-700 text-gray-300 w-full`}
                aria-haspopup="true"
                aria-expanded={isOpen}
                title={collapsed ? language.toUpperCase() : undefined}
            >
                <GlobeIcon className="h-5 w-5 text-gray-400" />
                {!collapsed && (
                    <>
                        <span className="flex-1 text-left">{language.toUpperCase()}</span>
                        <ChevronDownIcon className={`w-4 h-4 text-gray-400 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                    </>
                )}
            </button>
            
            {isOpen && (
                <div className={`absolute ${collapsed ? 'left-full top-0 ml-2' : 'bottom-full left-0 mb-2 w-full'} w-32 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50 py-1`} role="menu">
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
