
import React, { useState, ChangeEvent } from 'react';
import { useLanguage } from '../contexts/languageContext';
import { Author } from '../types';
import { UsersIcon, TrashIcon, PlusIcon } from './icons';

interface ProjectAuthorsProps {
    authors: Author[];
    setAuthors: (authors: Author[]) => void;
}

export const ProjectAuthors: React.FC<ProjectAuthorsProps> = ({ authors, setAuthors }) => {
    const { t } = useLanguage();
    
    const [newAuthor, setNewAuthor] = useState<Omit<Author, 'id'>>({
        name: '',
        role: '',
        participation: 0,
        email: ''
    });

    const handleAddAuthor = () => {
        if (!newAuthor.name.trim()) return;
        
        const author: Author = {
            ...newAuthor,
            id: Date.now()
        };
        
        setAuthors([...authors, author]);
        setNewAuthor({ name: '', role: '', participation: 0, email: '' });
    };

    const handleDeleteAuthor = (id: number) => {
        setAuthors(authors.filter(a => a.id !== id));
    };

    const handleUpdateAuthor = (id: number, field: keyof Author, value: any) => {
        setAuthors(authors.map(a => a.id === id ? { ...a, [field]: value } : a));
    };

    const totalParticipation = authors.reduce((acc, curr) => acc + (curr.participation || 0), 0);

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <div className="flex items-center space-x-3 border-b border-gray-700 pb-4">
                <UsersIcon className="w-8 h-8 text-indigo-400" />
                <div>
                    <h2 className="text-2xl font-bold text-white">{t('authorsTitle')}</h2>
                </div>
            </div>

            {/* Add Author Form */}
            <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">{t('addAuthor')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">{t('authorName')}</label>
                        <input 
                            type="text" 
                            value={newAuthor.name}
                            onChange={(e) => setNewAuthor({...newAuthor, name: e.target.value})}
                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">{t('authorRole')}</label>
                        <input 
                            type="text" 
                            value={newAuthor.role}
                            onChange={(e) => setNewAuthor({...newAuthor, role: e.target.value})}
                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">{t('participation')}</label>
                        <input 
                            type="number" 
                            min="0" max="100"
                            value={newAuthor.participation}
                            onChange={(e) => setNewAuthor({...newAuthor, participation: parseInt(e.target.value) || 0})}
                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">{t('email')}</label>
                        <input 
                            type="email" 
                            value={newAuthor.email}
                            onChange={(e) => setNewAuthor({...newAuthor, email: e.target.value})}
                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                </div>
                <button 
                    onClick={handleAddAuthor}
                    disabled={!newAuthor.name.trim()}
                    className="mt-4 w-full flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <PlusIcon className="w-4 h-4 mr-2" />
                    {t('addAuthor')}
                </button>
            </div>

            {/* Authors List */}
            <div className="space-y-4">
                {authors.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 bg-gray-800/30 rounded-lg border border-dashed border-gray-700">
                        {t('noAuthors')}
                    </div>
                ) : (
                    authors.map(author => (
                        <div key={author.id} className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex flex-col md:flex-row items-center gap-4">
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
                                <div>
                                    <label className="block text-[10px] uppercase text-gray-500 font-bold mb-1">{t('authorName')}</label>
                                    <input 
                                        type="text" 
                                        value={author.name}
                                        onChange={(e) => handleUpdateAuthor(author.id, 'name', e.target.value)}
                                        className="w-full bg-transparent border-b border-gray-600 focus:border-indigo-500 text-white text-sm p-1"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase text-gray-500 font-bold mb-1">{t('authorRole')}</label>
                                    <input 
                                        type="text" 
                                        value={author.role}
                                        onChange={(e) => handleUpdateAuthor(author.id, 'role', e.target.value)}
                                        className="w-full bg-transparent border-b border-gray-600 focus:border-indigo-500 text-white text-sm p-1"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase text-gray-500 font-bold mb-1">{t('participation')}</label>
                                    <input 
                                        type="number" 
                                        value={author.participation}
                                        onChange={(e) => handleUpdateAuthor(author.id, 'participation', parseInt(e.target.value) || 0)}
                                        className="w-full bg-transparent border-b border-gray-600 focus:border-indigo-500 text-white text-sm p-1"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase text-gray-500 font-bold mb-1">{t('email')}</label>
                                    <input 
                                        type="email" 
                                        value={author.email}
                                        onChange={(e) => handleUpdateAuthor(author.id, 'email', e.target.value)}
                                        className="w-full bg-transparent border-b border-gray-600 focus:border-indigo-500 text-white text-sm p-1"
                                    />
                                </div>
                            </div>
                            <button 
                                onClick={() => handleDeleteAuthor(author.id)}
                                className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-full transition-colors"
                                title={t('deleteAuthor')}
                            >
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Total Participation Bar */}
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">{t('totalParticipation')}</span>
                    <span className={`font-bold ${totalParticipation > 100 ? 'text-red-400' : 'text-green-400'}`}>
                        {totalParticipation}%
                    </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                    <div 
                        className={`h-2.5 rounded-full ${totalParticipation > 100 ? 'bg-red-500' : 'bg-green-500'}`} 
                        style={{ width: `${Math.min(100, totalParticipation)}%` }}
                    ></div>
                </div>
                {totalParticipation > 100 && (
                    <p className="text-xs text-red-400 mt-1">Total exceeds 100%</p>
                )}
            </div>
        </div>
    );
};
