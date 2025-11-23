import React, { useState, useEffect, useCallback } from 'react';
import { WordData } from '../types';
import { SpeakerIcon, XIcon, BrainIcon, CheckIcon, RefreshIcon } from './Icons';
import ClickableText from './ClickableText';

interface FlashcardStudyProps {
  cards: WordData[];
  onExit: () => void;
  reviewMode?: boolean;
  onRate?: (card: WordData, success: boolean) => void;
  onWordClick?: (word: string) => void;
}

const FlashcardStudy: React.FC<FlashcardStudyProps> = ({ cards, onExit, reviewMode = false, onRate, onWordClick }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studyQueue, setStudyQueue] = useState<WordData[]>([]);

  useEffect(() => {
    const queue = reviewMode ? [...cards] : [...cards].sort(() => Math.random() - 0.5);
    setStudyQueue(queue);
  }, [cards, reviewMode]);

  const currentCard = studyQueue[currentIndex];

  const handleNext = useCallback(() => {
    if (currentIndex < studyQueue.length - 1) {
        setIsFlipped(false);
        setTimeout(() => {
            setCurrentIndex((prev) => prev + 1);
        }, 300);
    } else if (!reviewMode) {
        setIsFlipped(false);
        setTimeout(() => {
            setCurrentIndex(0);
        }, 300);
    } else {
        onExit();
    }
  }, [currentIndex, studyQueue.length, reviewMode, onExit]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
        setIsFlipped(false);
        setTimeout(() => {
            setCurrentIndex((prev) => prev - 1);
        }, 300);
    }
  }, [currentIndex]);

  const handleRating = useCallback((success: boolean) => {
      if (onRate && currentCard) {
          onRate(currentCard, success);
          handleNext();
      }
  }, [onRate, currentCard, handleNext]);

  const playAudio = useCallback((lang: 'en-US' | 'en-GB') => {
    if (currentCard && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(currentCard.word);
      utterance.lang = lang;
      
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.lang === lang);
      if (preferredVoice) utterance.voice = preferredVoice;

      window.speechSynthesis.speak(utterance);
    }
  }, [currentCard]);

  const handleAudioClick = (e: React.MouseEvent, lang: 'en-US' | 'en-GB') => {
    e.stopPropagation();
    playAudio(lang);
  };

  const playVietnamese = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'vi-VN';
        window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        switch (e.code) {
            case 'Space':
            case 'Enter':
                e.preventDefault(); 
                setIsFlipped(prev => !prev);
                break;
            case 'ArrowRight':
            case 'KeyD':
                if (!reviewMode || isFlipped) handleNext();
                break;
            case 'ArrowLeft':
            case 'KeyA':
                if (!reviewMode) handlePrev();
                break;
            case 'ArrowUp':
            case 'KeyW':
                e.preventDefault();
                playAudio('en-US');
                break;
            case 'ArrowDown':
            case 'KeyS':
                e.preventDefault();
                playAudio('en-GB');
                break;
            case 'Escape':
                onExit();
                break;
            case 'Digit1':
                if (reviewMode && isFlipped) handleRating(false);
                break;
            case 'Digit2':
                if (reviewMode && isFlipped) handleRating(true);
                break;
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, playAudio, onExit, reviewMode, isFlipped, handleRating]);

  if (studyQueue.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 transition-all duration-300">
        <div className="absolute top-4 w-full max-w-4xl flex justify-between items-center px-6 text-white/80">
            <div className="flex items-center gap-2">
                {reviewMode && <BrainIcon className="w-5 h-5 text-indigo-400" />}
                <span className="text-lg font-medium">
                    {reviewMode ? 'Reviewing due cards' : 'Random Shuffle'}: {currentIndex + 1} / {studyQueue.length}
                </span>
            </div>
            <button onClick={onExit} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Exit (Esc)">
                <XIcon className="w-8 h-8" />
            </button>
        </div>

        <div className="relative w-full max-w-md aspect-[4/5] md:aspect-[3/4] perspective-1000 group cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
            <div className={`relative w-full h-full transition-transform duration-700 ease-in-out transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                
                <div className="absolute inset-0 w-full h-full backface-hidden bg-white dark:bg-slate-800 rounded-3xl shadow-2xl flex flex-col items-center justify-center p-8 border-2 border-slate-100 dark:border-slate-700">
                    <span className="text-sm font-bold text-indigo-500 dark:text-indigo-400 mb-4">English</span>
                    <h2 className="text-5xl font-bold text-slate-800 dark:text-white text-center mb-8">{currentCard.word}</h2>
                    
                    <div className="flex gap-4 z-10">
                        <button 
                            onClick={(e) => handleAudioClick(e, 'en-US')}
                            className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all border border-slate-100 dark:border-slate-600 hover:border-indigo-100 dark:hover:border-indigo-500/30 min-w-[80px] group/btn shadow-sm hover:shadow-md"
                            title="US Audio (Up Arrow / W)"
                        >
                            <div className="p-2 bg-white dark:bg-slate-600 rounded-full shadow-sm group-hover/btn:shadow-inner transition-shadow">
                                <SpeakerIcon className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-bold tracking-wider">US</span>
                        </button>
                        <button 
                            onClick={(e) => handleAudioClick(e, 'en-GB')}
                            className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all border border-slate-100 dark:border-slate-600 hover:border-indigo-100 dark:hover:border-indigo-500/30 min-w-[80px] group/btn shadow-sm hover:shadow-md"
                             title="UK Audio (Down Arrow / S)"
                        >
                             <div className="p-2 bg-white dark:bg-slate-600 rounded-full shadow-sm group-hover/btn:shadow-inner transition-shadow">
                                <SpeakerIcon className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-bold tracking-wider">UK</span>
                        </button>
                    </div>
                    
                    <p className="text-slate-400 dark:text-slate-500 mt-12 text-sm font-medium animate-pulse">Tap card or Press Space to flip</p>
                </div>

                <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 bg-indigo-600 dark:bg-indigo-800 rounded-3xl shadow-2xl flex flex-col p-8 text-white overflow-y-auto">
                     <span className="text-sm font-bold text-indigo-200 mb-2 text-center">Vietnamese & Meaning</span>
                     
                     <div className="flex-1 flex flex-col items-center justify-center gap-4">
                         <div className="text-center">
                             <h3 className="text-3xl font-bold">{currentCard.word}</h3>
                             <p className="opacity-80 font-mono">{currentCard.phonetic}</p>
                         </div>
                         
                         <div className="w-full space-y-3 mt-4">
                            {currentCard.meanings.slice(0, 2).map((m, i) => (
                                <div key={i} className="bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/5">
                                    <div className="flex items-start gap-2 justify-between">
                                        <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 flex-1">
                                            <span className="text-xs font-bold bg-white/20 px-1.5 py-0.5 rounded self-start text-white">{m.partOfSpeech}</span>
                                            <span className="font-medium text-lg text-yellow-300">{m.vietnamese}</span>
                                        </div>
                                        <button 
                                            onClick={(e) => playVietnamese(m.vietnamese, e)}
                                            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors flex-shrink-0 mt-1 sm:mt-0 focus:outline-none focus:ring-2 focus:ring-white/50"
                                            title="Listen (Vietnamese)"
                                        >
                                            <SpeakerIcon className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <div className="text-sm text-indigo-100 mt-1 leading-relaxed">
                                        <ClickableText text={m.definition} onWordClick={onWordClick} />
                                    </div>
                                </div>
                            ))}
                         </div>
                     </div>
                     
                     {currentCard.examples.length > 0 && (
                         <div className="mt-4 pt-4 border-t border-white/20 text-center">
                             <div className="italic text-indigo-200 text-sm">
                                <ClickableText text={`"${currentCard.examples[0].sentence}"`} onWordClick={onWordClick} />
                             </div>
                             <p className="text-indigo-300 text-xs mt-1">{currentCard.examples[0].translation}</p>
                         </div>
                     )}
                </div>
            </div>
        </div>

        <div className="flex gap-4 mt-8 w-full max-w-md justify-center">
            {reviewMode ? (
                <>
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleRating(false); }}
                        className="flex-1 py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold shadow-lg shadow-red-500/30 transform transition-all active:scale-95 flex flex-col items-center gap-1"
                        title="Forgot (1)"
                    >
                        <RefreshIcon className="w-6 h-6" />
                        <span>Forgot</span>
                        <span className="text-[10px] font-normal opacity-70">Review tomorrow</span>
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleRating(true); }}
                        className="flex-1 py-4 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-bold shadow-lg shadow-green-500/30 transform transition-all active:scale-95 flex flex-col items-center gap-1"
                         title="Remembered (2)"
                    >
                        <CheckIcon className="w-6 h-6" />
                        <span>Remembered</span>
                        <span className="text-[10px] font-normal opacity-70">Next level</span>
                    </button>
                </>
            ) : (
                <>
                    <button 
                        onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                        className="px-8 py-3 bg-slate-700 dark:bg-slate-600 text-white rounded-full font-semibold hover:bg-slate-600 dark:hover:bg-slate-500 transition-colors shadow-lg active:scale-95 transform duration-100"
                        title="Previous (Left Arrow / A)"
                    >
                        Prev
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleNext(); }}
                        className="px-8 py-3 bg-indigo-500 dark:bg-indigo-600 text-white rounded-full font-semibold hover:bg-indigo-400 dark:hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/30 dark:shadow-indigo-900/30 active:scale-95 transform duration-100"
                        title="Next (Right Arrow / D)"
                    >
                        Next
                    </button>
                </>
            )}
        </div>
        
        {reviewMode && (
            <p className="text-white/50 text-xs mt-4">
                Did you remember the meaning? Rate the card honestly.
            </p>
        )}
    </div>
  );
};

export default FlashcardStudy;