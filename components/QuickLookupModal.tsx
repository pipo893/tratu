import React, { useState, useEffect, useRef } from 'react';
import { WordData } from '../types';
import { lookupWord } from '../services/geminiService';
import WordDisplay from './WordDisplay';
import { SearchIcon, XIcon } from './Icons';

interface QuickLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCard: (word: WordData) => void;
  isSaved: (word: string) => boolean;
  initialWord?: string;
}

const QuickLookupModal: React.FC<QuickLookupModalProps> = ({ isOpen, onClose, onAddCard, isSaved, initialWord }) => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<WordData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Helper to handle search execution
  const executeSearch = async (term: string) => {
    if (!term.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await lookupWord(term.trim());
      const fullData: WordData = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        srsLevel: 0,
        nextReview: Date.now()
      };
      setResult(fullData);
    } catch (err) {
      setError("Not found.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      
      if (initialWord) {
        setQuery(initialWord);
        executeSearch(initialWord);
      } else {
        setQuery('');
        setResult(null);
      }
      setError(null);
    }
  }, [isOpen, initialWord]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(query);
  };

  const handleInternalWordClick = (word: string) => {
    setQuery(word);
    executeSearch(word);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className="relative w-full max-w-2xl bg-transparent flex flex-col items-center animate-[slideDown_0.3s_ease-out]">
        
        {/* Search Bar */}
        <div className="w-full bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
            <form onSubmit={handleSearchSubmit} className="relative flex items-center">
                <SearchIcon className="absolute left-4 w-5 h-5 text-slate-400" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Quick Lookup..."
                    className="w-full py-4 pl-12 pr-12 bg-transparent outline-none text-lg text-slate-800 dark:text-white placeholder:text-slate-400"
                />
                <button 
                    type="button"
                    onClick={onClose}
                    className="absolute right-3 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
                >
                    <XIcon className="w-5 h-5" />
                </button>
            </form>
            
            {/* Loading Indicator */}
            {loading && (
                <div className="h-1 w-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div className="h-full bg-indigo-500 animate-[progress_1s_infinite_linear] origin-left w-full transform -translate-x-full"></div>
                </div>
            )}
        </div>

        {/* Result Area */}
        <div className="w-full mt-4 max-h-[70vh] overflow-y-auto rounded-2xl custom-scrollbar">
            {error && (
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-lg text-center text-red-500 border border-red-100 dark:border-red-900/30">
                    {error}
                </div>
            )}
            
            {result && (
                <WordDisplay 
                    data={result} 
                    onAdd={onAddCard} 
                    isSaved={isSaved(result.word)}
                    onWordClick={handleInternalWordClick}
                />
            )}
        </div>
      </div>
      
      <style>{`
        @keyframes slideDown {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes progress {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(0); }
            100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default QuickLookupModal;