import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppMode, WordData, Example } from './types';
import { lookupWord } from './services/geminiService';
import WordDisplay from './components/WordDisplay';
import FlashcardStudy from './components/FlashcardStudy';
import QuickLookupModal from './components/QuickLookupModal';
import { SearchIcon, LayersIcon, TrashIcon, BookOpenIcon, SpeakerIcon, SunIcon, MoonIcon, DownloadIcon, ListIcon, GridIcon, XIcon, BrainIcon, TrendingUpIcon, CalendarIcon, ZapIcon } from './components/Icons';

// Constants
const STORAGE_KEY = 'lingoflash_cards';

// SRS Intervals (Days): Level 0 (New) -> 1, 3, 7, 14, 30
const SRS_INTERVALS = [1, 3, 7, 14, 30];

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.SEARCH);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<WordData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedCards, setSavedCards] = useState<WordData[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // SRS State
  const [studySessionCards, setStudySessionCards] = useState<WordData[]>([]);
  const [isReviewSession, setIsReviewSession] = useState(false);
  
  // Quick Lookup State
  const [isQuickLookupOpen, setIsQuickLookupOpen] = useState(false);
  const [quickLookupWord, setQuickLookupWord] = useState('');
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Initialize Theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
  }, []);

  // Apply Theme
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  // Handle Word Click (for recursive lookups)
  const handleWordClick = useCallback((word: string) => {
    setQuickLookupWord(word);
    setIsQuickLookupOpen(true);
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
        // Toggle Theme: Alt + T
        if (e.altKey && e.code === 'KeyT') {
            e.preventDefault();
            toggleTheme();
        }

        // Quick Lookup: Alt + Q
        if (e.altKey && e.code === 'KeyQ') {
            e.preventDefault();
            setQuickLookupWord('');
            setIsQuickLookupOpen(prev => !prev);
        }

        // Navigation Shortcuts: Alt + 1, 2, 3
        if (e.altKey) {
            if (e.key === '1') {
                e.preventDefault();
                setMode(AppMode.SEARCH);
            } else if (e.key === '2') {
                e.preventDefault();
                setMode(AppMode.FLASHCARDS);
            } else if (e.key === '3') {
                if (savedCards.length > 0) {
                     e.preventDefault();
                     startRandomStudy();
                }
            }
        }

        // Focus Search: '/' or 'Ctrl+K'
        if ((e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key === 'k')) && !isQuickLookupOpen) {
            if (mode !== AppMode.SEARCH) {
                setMode(AppMode.SEARCH);
            }
            if (document.activeElement !== searchInputRef.current) {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        }

        if (e.key === 'Escape') {
            if (isQuickLookupOpen) {
                setIsQuickLookupOpen(false);
                setQuickLookupWord('');
            } else if (mode === AppMode.SEARCH) {
                if (document.activeElement === searchInputRef.current) {
                    searchInputRef.current?.blur();
                } else if (searchQuery) {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                }
            }
        }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [toggleTheme, mode, savedCards.length, searchQuery, isQuickLookupOpen]);

  // Load from local storage and Migration Logic
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsedData = JSON.parse(saved);
        const now = Date.now();
        
        // Migration logic: 
        // 1. Convert old string examples to objects
        // 2. Initialize SRS fields if missing
        const migratedData = parsedData.map((card: any) => ({
            ...card,
            examples: card.examples.map((ex: any) => 
                typeof ex === 'string' ? { sentence: ex, translation: '' } : ex
            ),
            srsLevel: card.srsLevel !== undefined ? card.srsLevel : 0,
            nextReview: card.nextReview !== undefined ? card.nextReview : now // Default to review now if new
        }));
        setSavedCards(migratedData);
      } catch (e) {
        console.error("Failed to parse saved cards", e);
      }
    }
  }, []);

  // Save to local storage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedCards));
  }, [savedCards]);

  // Auto-focus input when entering search mode
  useEffect(() => {
    if (mode === AppMode.SEARCH && !isQuickLookupOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [mode, isQuickLookupOpen]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setError(null);
    setSearchResult(null);

    try {
      const result = await lookupWord(searchQuery.trim());
      const fullData: WordData = {
        ...result,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        srsLevel: 0,
        nextReview: Date.now() // Review immediately upon creation
      };
      setSearchResult(fullData);
    } catch (err: any) {
      console.error(err);
      setError("Unable to find definition. Please check your spelling or try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const addToFlashcards = (word: WordData) => {
    if (!savedCards.some(c => c.word.toLowerCase() === word.word.toLowerCase())) {
      setSavedCards(prev => [word, ...prev]);
    }
  };

  const removeCard = (id: string) => {
    setSavedCards(prev => prev.filter(c => c.id !== id));
  };

  const isWordSaved = (word: string) => {
    return savedCards.some(c => c.word.toLowerCase() === word.toLowerCase());
  };

  const handleExportCSV = () => {
    if (savedCards.length === 0) return;
    const headers = ['Word', 'Phonetic', 'Meaning (First)', 'Vietnamese', 'Example Sentence', 'Example Translation', 'SRS Level', 'Next Review'];
    const rows = savedCards.map(card => {
        const firstMeaning = card.meanings[0];
        const firstExample = card.examples[0];
        const nextReviewDate = card.nextReview ? new Date(card.nextReview).toLocaleDateString() : 'Now';

        return [
            card.word,
            card.phonetic,
            firstMeaning ? `(${firstMeaning.partOfSpeech}) ${firstMeaning.definition}` : '',
            firstMeaning ? firstMeaning.vietnamese : '',
            firstExample ? firstExample.sentence : '',
            firstExample ? firstExample.translation : '',
            (card.srsLevel || 0).toString(),
            nextReviewDate
        ].map(cell => `"${(cell || '').replace(/"/g, '""')}"`);
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `lingoflash_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // SRS Logic
  const getDueCards = () => {
      const now = Date.now();
      return savedCards.filter(card => !card.nextReview || card.nextReview <= now);
  };

  const startReviewSession = () => {
      const due = getDueCards();
      if (due.length === 0) return;
      setStudySessionCards(due);
      setIsReviewSession(true);
      setMode(AppMode.STUDY);
  };

  const startRandomStudy = () => {
      setStudySessionCards(savedCards);
      setIsReviewSession(false);
      setMode(AppMode.STUDY);
  };

  const handleSRSRating = (card: WordData, success: boolean) => {
      const now = Date.now();
      const currentLevel = card.srsLevel || 0;
      let newLevel = currentLevel;
      let nextReviewDate = now;

      if (success) {
          // Increase level, max out at 5
          newLevel = Math.min(currentLevel + 1, SRS_INTERVALS.length);
          // Calculate days to add: Intervals index is level-1. If level is 1, index 0 (1 day).
          const daysToAdd = SRS_INTERVALS[newLevel - 1] || 1; 
          nextReviewDate = now + (daysToAdd * 24 * 60 * 60 * 1000);
      } else {
          // Reset to level 1 (review tomorrow)
          newLevel = 1;
          nextReviewDate = now + (1 * 24 * 60 * 60 * 1000);
      }

      // Update card in state
      setSavedCards(prev => prev.map(c => 
          c.id === card.id 
          ? { ...c, srsLevel: newLevel, nextReview: nextReviewDate } 
          : c
      ));
  };

  const dueCount = getDueCards().length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-indigo-50 to-pink-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 transition-colors duration-300 text-slate-800 dark:text-slate-100 flex flex-col">
      
      {/* Header */}
      <header className="sticky top-0 z-30 w-full glass-panel border-b border-white/40 dark:border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
              <BookOpenIcon className="w-6 h-6" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-purple-600 dark:from-indigo-400 dark:to-purple-300">
              LingoFlash AI
            </span>
          </div>

          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-2 bg-slate-200/50 dark:bg-slate-700/50 p-1 rounded-full">
                <button
                onClick={() => setMode(AppMode.SEARCH)}
                title="Search Mode (Alt + 1)"
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    mode === AppMode.SEARCH 
                    ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-300 shadow-sm' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
                >
                <SearchIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Search</span>
                </button>
                <button
                onClick={() => setMode(AppMode.FLASHCARDS)}
                title="My Cards (Alt + 2)"
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full text-sm font-medium transition-all relative ${
                    mode === AppMode.FLASHCARDS 
                    ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-300 shadow-sm' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
                >
                <LayersIcon className="w-4 h-4" />
                <span className="hidden sm:inline">My Cards</span>
                {dueCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[9px] text-white items-center justify-center">
                            {dueCount > 9 ? '9+' : dueCount}
                        </span>
                    </span>
                )}
                </button>
            </nav>

            <button
                onClick={toggleTheme}
                className="p-2 rounded-full bg-slate-200/50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-300/50 dark:hover:bg-slate-600 transition-colors"
                title="Toggle Theme (Alt + T)"
            >
                {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8">
        
        {/* SEARCH MODE */}
        {mode === AppMode.SEARCH && (
          <div className="flex flex-col items-center w-full max-w-3xl mx-auto">
            <div className="text-center mb-8 mt-4">
              <h1 className="text-4xl md:text-5xl font-bold text-slate-800 dark:text-slate-100 mb-4 tracking-tight">
                Master English, <br/>
                <span className="text-indigo-600 dark:text-indigo-400">One Word at a Time</span>
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-lg">Powered by Gemini AI for fast, accurate translations.</p>
            </div>

            <form onSubmit={handleSearch} className="w-full relative mb-12 group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <SearchIcon className="w-6 h-6 text-slate-400 dark:text-slate-500 group-focus-within:text-indigo-500 dark:group-focus-within:text-indigo-400 transition-colors" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter an English word... (Press / to focus)"
                className="w-full py-5 pl-14 pr-32 bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-indigo-100/50 dark:shadow-none border-2 border-transparent focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:focus:ring-indigo-500/20 outline-none text-xl text-slate-800 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-all"
              />
              {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                        setSearchQuery('');
                        searchInputRef.current?.focus();
                    }}
                    className="absolute right-28 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                    title="Clear"
                  >
                      <XIcon className="w-5 h-5" />
                  </button>
              )}
              <button 
                type="submit"
                disabled={isLoading || !searchQuery}
                className="absolute right-3 top-3 bottom-3 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white px-6 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isLoading ? 'Thinking...' : 'Lookup'}
              </button>
            </form>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl border border-red-100 dark:border-red-800/50 mb-8 animate-pulse">
                {error}
              </div>
            )}

            {searchResult && (
              <WordDisplay 
                data={searchResult} 
                onAdd={addToFlashcards}
                isSaved={isWordSaved(searchResult.word)}
                onWordClick={handleWordClick}
              />
            )}
          </div>
        )}

        {/* FLASHCARDS MODE */}
        {mode === AppMode.FLASHCARDS && (
          <div className="w-full">
            {/* SRS Dashboard */}
             <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div className="bg-gradient-to-br from-indigo-500 to-purple-600 dark:from-indigo-600 dark:to-purple-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                     <div className="relative z-10">
                        <h3 className="text-indigo-100 font-medium mb-1 flex items-center gap-2">
                            <BrainIcon className="w-4 h-4" /> Spaced Repetition
                        </h3>
                        <div className="text-4xl font-bold mb-2">{dueCount}</div>
                        <p className="text-sm text-indigo-100 opacity-90">Words due for review today</p>
                        
                        <button 
                            onClick={startReviewSession}
                            disabled={dueCount === 0}
                            className="mt-4 w-full py-2 bg-white text-indigo-600 rounded-lg font-bold text-sm shadow-md hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {dueCount > 0 ? 'Start Review Session' : 'All Caught Up!'}
                        </button>
                     </div>
                     <BrainIcon className="absolute -bottom-4 -right-4 w-32 h-32 text-white opacity-10" />
                 </div>
                 
                 <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-center">
                      <div className="flex items-center gap-3 mb-2 text-slate-500 dark:text-slate-400">
                          <LayersIcon className="w-5 h-5" />
                          <span className="font-medium">Total Collection</span>
                      </div>
                      <div className="text-3xl font-bold text-slate-800 dark:text-white">{savedCards.length}</div>
                      <p className="text-xs text-slate-400 mt-1">Cards in your deck</p>
                 </div>

                 <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-center">
                     <div className="flex items-center gap-3 mb-2 text-slate-500 dark:text-slate-400">
                          <TrendingUpIcon className="w-5 h-5" />
                          <span className="font-medium">Learning Progress</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-700 h-3 rounded-full overflow-hidden mb-2">
                           <div className="bg-green-500 h-full" style={{ width: `${savedCards.length > 0 ? (savedCards.filter(c => (c.srsLevel || 0) > 3).length / savedCards.length) * 100 : 0}%` }}></div>
                      </div>
                      <p className="text-xs text-slate-400">
                          {savedCards.filter(c => (c.srsLevel || 0) > 3).length} words mastered (Level 4+)
                      </p>
                 </div>
             </div>

             <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-6 gap-4">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">My Collection</h2>
                
                {savedCards.length > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-slate-200/50 dark:bg-slate-700/50 p-1 rounded-lg">
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-600 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                      >
                        <GridIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setViewMode('list')}
                        className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-600 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                      >
                        <ListIcon className="w-5 h-5" />
                      </button>
                    </div>

                    <button
                      onClick={handleExportCSV}
                      className="p-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                      title="Export CSV"
                    >
                      <DownloadIcon className="w-5 h-5" />
                    </button>

                    <button 
                        onClick={startRandomStudy}
                        className="bg-slate-800 dark:bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors font-medium flex items-center gap-2 text-sm"
                    >
                        Random Shuffle
                    </button>
                  </div>
                )}
             </div>

             {savedCards.length === 0 ? (
                 <div className="text-center py-20 bg-white/50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
                     <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 rounded-full flex items-center justify-center mx-auto mb-4">
                         <LayersIcon className="w-8 h-8" />
                     </div>
                     <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300">No cards yet</h3>
                     <p className="text-slate-500 dark:text-slate-400 mt-2 mb-6">Search for words to add them to your deck.</p>
                     <button 
                        onClick={() => setMode(AppMode.SEARCH)}
                        className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
                     >
                         Go to Search
                     </button>
                 </div>
             ) : (
                 <>
                   {viewMode === 'grid' ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                         {savedCards.map((card) => (
                             <div key={card.id} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md dark:hover:bg-slate-750 transition-all group relative">
                                 <div className="flex justify-between items-start mb-2">
                                     <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{card.word}</h3>
                                     <div className="flex items-center gap-2">
                                         {/* SRS Level Indicator */}
                                         <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                             (card.srsLevel || 0) === 0 ? 'bg-slate-100 text-slate-500' :
                                             (card.srsLevel || 0) < 3 ? 'bg-blue-100 text-blue-600' :
                                             'bg-green-100 text-green-600'
                                         }`}>
                                             Lvl {card.srsLevel || 0}
                                         </span>
                                         <button 
                                            onClick={() => removeCard(card.id)}
                                            className="text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors"
                                         >
                                             <TrashIcon className="w-4 h-4" />
                                         </button>
                                     </div>
                                 </div>
                                 <p className="text-slate-400 dark:text-slate-500 font-mono text-sm mb-3">{card.phonetic}</p>
                                 <div className="space-y-1">
                                     {card.meanings.slice(0, 2).map((m, i) => (
                                         <div key={i} className="text-sm truncate">
                                             <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded mr-2">{m.partOfSpeech}</span>
                                             <span className="text-slate-700 dark:text-slate-300">{m.vietnamese}</span>
                                         </div>
                                     ))}
                                 </div>
                             </div>
                         ))}
                     </div>
                   ) : (
                     <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                       <div className="overflow-x-auto">
                         <table className="w-full text-left">
                           <thead>
                             <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                               <th className="p-4 font-semibold w-1/5">Word</th>
                               <th className="p-4 font-semibold">Level</th>
                               <th className="p-4 font-semibold">Next Review</th>
                               <th className="p-4 font-semibold w-1/4">Meaning</th>
                               <th className="p-4 font-semibold w-1/4">Example</th>
                               <th className="p-4 font-semibold text-right">Actions</th>
                             </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                             {savedCards.map((card) => (
                               <tr key={card.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors text-sm">
                                 <td className="p-4">
                                   <div className="font-bold text-slate-800 dark:text-white">{card.word}</div>
                                   <div className="text-xs text-slate-400 font-mono">{card.phonetic}</div>
                                 </td>
                                 <td className="p-4">
                                     <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                                         (card.srsLevel || 0) < 2 ? 'bg-red-400' : 
                                         (card.srsLevel || 0) < 4 ? 'bg-yellow-400' : 'bg-green-500'
                                     }`}></span>
                                     {card.srsLevel || 0}
                                 </td>
                                 <td className="p-4 text-slate-600 dark:text-slate-400">
                                     {card.nextReview ? (
                                         card.nextReview <= Date.now() ? <span className="text-red-500 font-bold">Today</span> :
                                         new Date(card.nextReview).toLocaleDateString()
                                     ) : '-'}
                                 </td>
                                 <td className="p-4 text-slate-700 dark:text-slate-300 max-w-[200px] truncate" title={card.meanings[0]?.vietnamese}>
                                   {card.meanings[0] ? card.meanings[0].vietnamese : ''}
                                 </td>
                                 <td className="p-4 text-slate-600 dark:text-slate-400 max-w-[250px] text-xs">
                                    {card.examples?.[0] ? (
                                        <div className="flex flex-col gap-1">
                                            <span className="italic text-slate-800 dark:text-slate-200 line-clamp-2" title={card.examples[0].sentence}>"{card.examples[0].sentence}"</span>
                                            <span className="text-slate-500 dark:text-slate-500 truncate" title={card.examples[0].translation}>{card.examples[0].translation}</span>
                                        </div>
                                    ) : (
                                        <span className="text-slate-400">-</span>
                                    )}
                                 </td>
                                 <td className="p-4 text-right">
                                   <button 
                                     onClick={() => removeCard(card.id)}
                                     className="text-slate-400 hover:text-red-500 transition-colors"
                                   >
                                     <TrashIcon className="w-4 h-4" />
                                   </button>
                                 </td>
                               </tr>
                             ))}
                           </tbody>
                         </table>
                       </div>
                     </div>
                   )}
                 </>
             )}
          </div>
        )}

        {/* STUDY OVERLAY */}
        {mode === AppMode.STUDY && (
            <FlashcardStudy 
                cards={studySessionCards} 
                onExit={() => setMode(AppMode.FLASHCARDS)} 
                reviewMode={isReviewSession}
                onRate={handleSRSRating}
                onWordClick={handleWordClick}
            />
        )}
      </main>

      {/* QUICK LOOKUP MODAL */}
      <QuickLookupModal 
          isOpen={isQuickLookupOpen}
          onClose={() => {
              setIsQuickLookupOpen(false);
              setQuickLookupWord('');
          }}
          onAddCard={addToFlashcards}
          isSaved={isWordSaved}
          initialWord={quickLookupWord}
      />

      {/* FLOATING ACTION BUTTON FOR QUICK LOOKUP */}
      <button
          onClick={() => {
              setQuickLookupWord('');
              setIsQuickLookupOpen(true);
          }}
          className="fixed bottom-6 right-6 p-4 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 hover:shadow-indigo-500/40 transition-all active:scale-95 z-40 group"
          title="Quick Lookup (Alt + Q)"
      >
          <ZapIcon className="w-6 h-6" />
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Quick Look (Alt + Q)
          </span>
      </button>

    </div>
  );
};

export default App;