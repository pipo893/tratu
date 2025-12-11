import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WordData } from '../types';
import { SpeakerIcon, XIcon, BrainIcon, CheckIcon, RefreshIcon, UndoIcon, RotateIcon, PuzzleIcon, LayersIcon, CheckCircleIcon, XCircleIcon, TrendingUpIcon } from './Icons';
import ClickableText from './ClickableText';

interface FlashcardStudyProps {
  cards: WordData[];
  allCards?: WordData[]; // Required for quiz distractors
  onExit: () => void;
  reviewMode?: boolean;
  onRate?: (card: WordData, success: boolean) => void;
  onWordClick?: (word: string) => void;
}

// Types of Quiz questions
type QuizType = 'SELECT_MEANING_EN_TO_VI' | 'SELECT_WORD_VI_TO_EN' | 'FILL_IN_BLANK';

interface QuizState {
    type: QuizType;
    question: string;
    correctAnswer: string;
    options?: string[]; // For multiple choice
    userAnswer?: string;
    isCorrect?: boolean;
    isSubmitted: boolean;
}

const FlashcardStudy: React.FC<FlashcardStudyProps> = ({ cards, allCards = [], onExit, reviewMode = false, onRate, onWordClick }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studyQueue, setStudyQueue] = useState<WordData[]>([]);
  
  // Study Mode: 'flashcard' or 'quiz'
  const [studyMode, setStudyMode] = useState<'flashcard' | 'quiz'>('flashcard');
  const [quizState, setQuizState] = useState<QuizState | null>(null);
  const quizInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const queue = reviewMode ? [...cards] : [...cards].sort(() => Math.random() - 0.5);
    setStudyQueue(queue);
  }, [cards, reviewMode]);

  const currentCard = studyQueue[currentIndex];

  // Initialize Quiz when current card changes or mode changes to quiz
  useEffect(() => {
      if (studyMode === 'quiz' && currentCard) {
          generateQuiz(currentCard);
      } else {
          setQuizState(null);
      }
  }, [currentIndex, studyMode, currentCard]);

  const generateQuiz = (card: WordData) => {
      // Determine Quiz Type
      const types: QuizType[] = ['SELECT_MEANING_EN_TO_VI', 'SELECT_WORD_VI_TO_EN'];
      if (card.examples && card.examples.length > 0) {
          types.push('FILL_IN_BLANK');
      }
      const type = types[Math.floor(Math.random() * types.length)];
      
      let newState: QuizState = {
          type,
          question: '',
          correctAnswer: '',
          isSubmitted: false
      };

      if (type === 'FILL_IN_BLANK') {
          const example = card.examples[Math.floor(Math.random() * card.examples.length)];
          // Replace word with blanks, case insensitive, handle punctuation
          const regex = new RegExp(`\\b${card.word}\\b`, 'gi');
          newState.question = example.sentence.replace(regex, '_______');
          newState.correctAnswer = card.word;
      } else if (type === 'SELECT_MEANING_EN_TO_VI') {
          newState.question = card.word;
          newState.correctAnswer = card.meanings[0].vietnamese;
          // Generate distractors
          const distractors = allCards
              .filter(c => c.id !== card.id)
              .sort(() => 0.5 - Math.random())
              .slice(0, 3)
              .map(c => c.meanings[0].vietnamese);
          
          // Ensure we have enough options even if deck is small
          const options = [newState.correctAnswer, ...distractors];
          while (options.length < 4) {
             options.push("N/A"); // Fallback for tiny decks
          }
          newState.options = options.sort(() => 0.5 - Math.random());
      } else if (type === 'SELECT_WORD_VI_TO_EN') {
          newState.question = card.meanings[0].vietnamese;
          newState.correctAnswer = card.word;
           // Generate distractors
           const distractors = allCards
           .filter(c => c.id !== card.id)
           .sort(() => 0.5 - Math.random())
           .slice(0, 3)
           .map(c => c.word);
       
           const options = [newState.correctAnswer, ...distractors];
            while (options.length < 4) {
                options.push("N/A");
            }
           newState.options = options.sort(() => 0.5 - Math.random());
      }

      setQuizState(newState);
      // Auto focus input if fill blank with slight delay and scroll into view
      if (type === 'FILL_IN_BLANK') {
          setTimeout(() => {
              if (quizInputRef.current) {
                  quizInputRef.current.focus();
                  quizInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
          }, 300);
      }
  };

  const submitQuizAnswer = (answer: string) => {
      if (!quizState || quizState.isSubmitted) return;
      
      const isCorrect = answer.trim().toLowerCase() === quizState.correctAnswer.trim().toLowerCase();
      
      setQuizState(prev => prev ? ({
          ...prev,
          userAnswer: answer,
          isCorrect,
          isSubmitted: true
      }) : null);
  };

  const handleNext = useCallback(() => {
    // If in quiz mode and not submitted, don't move
    if (studyMode === 'quiz' && quizState && !quizState.isSubmitted) return;

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
  }, [currentIndex, studyQueue.length, reviewMode, onExit, studyMode, quizState]);

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

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (studyMode === 'flashcard') {
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
                    handlePrev();
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
            }
        } else if (studyMode === 'quiz' && quizState) {
            if (e.code === 'Enter') {
                e.preventDefault();
                if (quizState.isSubmitted) {
                    // Handle rating based on quiz result automatically or let user proceed?
                    // Let's automate: Correct -> Remembered, Wrong -> Forgot
                    handleRating(quizState.isCorrect || false);
                } else if (quizState.type === 'FILL_IN_BLANK' && quizInputRef.current) {
                    submitQuizAnswer(quizInputRef.current.value);
                }
            }
        }

        if (e.code === 'Escape') onExit();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, playAudio, onExit, reviewMode, isFlipped, handleRating, studyMode, quizState]);

  if (studyQueue.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 transition-all duration-300 overflow-hidden">
        <div className="absolute top-4 w-full max-w-4xl flex justify-between items-center px-6 text-white/80 z-20">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    {reviewMode && <BrainIcon className="w-5 h-5 text-indigo-400" />}
                    <span className="text-lg font-medium">
                        {reviewMode ? 'Reviewing' : 'Shuffle'}: {currentIndex + 1} / {studyQueue.length}
                    </span>
                </div>
                
                {/* Mode Toggle */}
                <div className="bg-slate-800 p-1 rounded-lg flex gap-1 border border-slate-700">
                    <button 
                        onClick={() => setStudyMode('flashcard')}
                        className={`flex items-center gap-1 px-3 py-1 rounded-md text-sm transition-colors ${studyMode === 'flashcard' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                        <LayersIcon className="w-3 h-3" /> Card
                    </button>
                    <button 
                         onClick={() => setStudyMode('quiz')}
                         className={`flex items-center gap-1 px-3 py-1 rounded-md text-sm transition-colors ${studyMode === 'quiz' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                        <PuzzleIcon className="w-3 h-3" /> Quiz
                    </button>
                </div>
            </div>

            <button onClick={onExit} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Exit (Esc)">
                <XIcon className="w-8 h-8" />
            </button>
        </div>

        {/* Content Area */}
        <div className="relative w-full max-w-md aspect-[4/5] md:aspect-[3/4] max-h-[85vh]">
            
            {studyMode === 'flashcard' ? (
                /* FLASHCARD VIEW */
                <div className="w-full h-full perspective-1000 group cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
                    <div className={`relative w-full h-full transition-transform duration-700 ease-in-out transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                        
                        {/* FRONT */}
                        <div className="absolute inset-0 w-full h-full backface-hidden bg-white dark:bg-slate-800 rounded-3xl shadow-2xl flex flex-col items-center justify-center p-8 border-2 border-slate-100 dark:border-slate-700">
                            <span className="text-sm font-bold text-indigo-500 dark:text-indigo-400 mb-4">English</span>
                            <h2 className="text-5xl font-bold text-slate-800 dark:text-white text-center mb-8 break-words max-w-full">{currentCard.word}</h2>
                            
                            <div className="flex gap-4 z-10">
                                <button 
                                    onClick={(e) => handleAudioClick(e, 'en-US')}
                                    className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all border border-slate-100 dark:border-slate-600 hover:border-indigo-100 dark:hover:border-indigo-500/30 min-w-[80px] group/btn shadow-sm hover:shadow-md"
                                >
                                    <SpeakerIcon className="w-5 h-5" />
                                    <span className="text-xs font-bold tracking-wider">US</span>
                                </button>
                                <button 
                                    onClick={(e) => handleAudioClick(e, 'en-GB')}
                                    className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all border border-slate-100 dark:border-slate-600 hover:border-indigo-100 dark:hover:border-indigo-500/30 min-w-[80px] group/btn shadow-sm hover:shadow-md"
                                >
                                    <SpeakerIcon className="w-5 h-5" />
                                    <span className="text-xs font-bold tracking-wider">UK</span>
                                </button>
                            </div>
                            
                            <p className="text-slate-400 dark:text-slate-500 mt-12 text-sm font-medium animate-pulse">Tap card or Press Space to flip</p>
                        </div>

                        {/* BACK */}
                        <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 bg-indigo-600 dark:bg-indigo-800 rounded-3xl shadow-2xl flex flex-col p-8 text-white overflow-y-auto">
                            <span className="text-sm font-bold text-indigo-200 mb-2 text-center">Vietnamese & Meaning</span>
                            
                            <div className="flex-1 flex flex-col items-center justify-center gap-4">
                                <div className="text-center">
                                    <h3 className="text-3xl font-bold">{currentCard.word}</h3>
                                    {currentCard.mnemonic && currentCard.mnemonic.toLowerCase() !== currentCard.word.toLowerCase() && (
                                        <p className="text-indigo-200 font-mono text-lg mt-1 tracking-widest opacity-90">{currentCard.mnemonic}</p>
                                    )}
                                    <p className="opacity-80 font-mono text-sm mt-1">{currentCard.phonetic}</p>
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
                                                    className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors flex-shrink-0 mt-1 sm:mt-0"
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
                                
                                {(currentCard.synonyms || currentCard.antonyms) && (
                                    <div className="w-full text-center mt-2 bg-white/5 p-2 rounded-lg text-sm">
                                        {currentCard.synonyms && <div className="text-indigo-200"><span className="opacity-70 font-bold uppercase mr-1 text-white">Syn:</span>{currentCard.synonyms.join(', ')}</div>}
                                        {currentCard.antonyms && <div className="text-indigo-200"><span className="opacity-70 font-bold uppercase mr-1 text-white">Ant:</span>{currentCard.antonyms.join(', ')}</div>}
                                    </div>
                                )}
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
            ) : (
                /* QUIZ VIEW */
                <div className="w-full h-full bg-white dark:bg-slate-800 rounded-3xl shadow-2xl flex flex-col border-2 border-slate-100 dark:border-slate-700 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                        <div className="flex flex-col items-center justify-center min-h-full w-full">
                            {quizState && (
                                <>
                                    <span className="text-sm font-bold text-indigo-500 dark:text-indigo-400 mb-6 uppercase tracking-wider">
                                        {quizState.type === 'FILL_IN_BLANK' ? 'Fill in the blank' : 
                                        quizState.type === 'SELECT_MEANING_EN_TO_VI' ? 'Select Meaning' : 'Select Word'}
                                    </span>

                                    <div className="w-full mb-8">
                                        <h3 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white text-center leading-tight">
                                            {quizState.type === 'FILL_IN_BLANK' ? (
                                                <span className="leading-loose">
                                                    {quizState.question.split('_______').map((part, i, arr) => (
                                                        <React.Fragment key={i}>
                                                            {part}
                                                            {i < arr.length - 1 && (
                                                                <span className="inline-block border-b-2 border-indigo-500 w-24 mx-1 relative top-1">
                                                                    {quizState.isSubmitted && (
                                                                        <span className={`absolute -top-8 left-1/2 -translate-x-1/2 text-lg font-bold whitespace-nowrap ${quizState.isCorrect ? 'text-green-500' : 'text-red-500'}`}>
                                                                            {quizState.correctAnswer}
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            )}
                                                        </React.Fragment>
                                                    ))}
                                                </span>
                                            ) : (
                                                quizState.question
                                            )}
                                        </h3>
                                        {quizState.type === 'FILL_IN_BLANK' && !quizState.isSubmitted && (
                                            <input 
                                                ref={quizInputRef}
                                                type="text" 
                                                className="w-full mt-8 p-3 bg-slate-100 dark:bg-slate-700 rounded-xl text-center text-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                                placeholder="Type the missing word..."
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') submitQuizAnswer(e.currentTarget.value);
                                                }}
                                            />
                                        )}
                                    </div>

                                    {quizState.options ? (
                                        <div className="grid grid-cols-1 gap-3 w-full">
                                            {quizState.options.map((option, idx) => {
                                                let btnClass = "p-4 rounded-xl text-left font-medium transition-all border-2 ";
                                                if (quizState.isSubmitted) {
                                                    if (option === quizState.correctAnswer) {
                                                        btnClass += "bg-green-100 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-300";
                                                    } else if (option === quizState.userAnswer) {
                                                        btnClass += "bg-red-100 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-300";
                                                    } else {
                                                        btnClass += "bg-slate-50 dark:bg-slate-700 border-transparent opacity-50";
                                                    }
                                                } else {
                                                    btnClass += "bg-slate-50 dark:bg-slate-700 border-transparent hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-600";
                                                }

                                                return (
                                                    <button 
                                                        key={idx}
                                                        onClick={() => submitQuizAnswer(option)}
                                                        disabled={quizState.isSubmitted}
                                                        className={btnClass}
                                                    >
                                                        {option}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        quizState.type === 'FILL_IN_BLANK' && !quizState.isSubmitted && (
                                            <button 
                                                onClick={() => quizInputRef.current && submitQuizAnswer(quizInputRef.current.value)}
                                                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30"
                                            >
                                                Check Answer
                                            </button>
                                        )
                                    )}

                                    {quizState.isSubmitted && (
                                        <div className={`mt-6 flex items-center gap-2 font-bold ${quizState.isCorrect ? 'text-green-500' : 'text-red-500'}`}>
                                            {quizState.isCorrect ? (
                                                <>
                                                    <CheckCircleIcon className="w-6 h-6" />
                                                    <span>Correct! Well done.</span>
                                                </>
                                            ) : (
                                                <>
                                                    <XCircleIcon className="w-6 h-6" />
                                                    <span>Incorrect. The answer is "{quizState.correctAnswer}".</span>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Controls */}
        <div className="flex gap-3 mt-8 w-full max-w-md justify-center items-stretch z-20">
            {studyMode === 'flashcard' && (
                <>
                    {reviewMode && (
                         <button 
                            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                            disabled={currentIndex === 0}
                            className="px-4 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-30 transition-colors flex items-center justify-center shadow-sm active:scale-95"
                        >
                            <UndoIcon className="w-6 h-6" />
                        </button>
                    )}

                    {reviewMode ? (
                        <>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleRating(false); }}
                                className="flex-1 py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold shadow-lg shadow-red-500/30 transform transition-all active:scale-95 flex flex-col items-center gap-1"
                            >
                                <RefreshIcon className="w-6 h-6" />
                                <span>Forgot</span>
                                <span className="text-[10px] font-normal opacity-70">Review tomorrow</span>
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleRating(true); }}
                                className="flex-1 py-4 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-bold shadow-lg shadow-green-500/30 transform transition-all active:scale-95 flex flex-col items-center gap-1"
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
                            >
                                Prev
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                                className="px-8 py-3 bg-indigo-500 dark:bg-indigo-600 text-white rounded-full font-semibold hover:bg-indigo-400 dark:hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/30 dark:shadow-indigo-900/30 active:scale-95 transform duration-100"
                            >
                                Next
                            </button>
                        </>
                    )}

                    {reviewMode && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); setIsFlipped(prev => !prev); }}
                            className="px-4 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center shadow-sm active:scale-95"
                        >
                            <RotateIcon className="w-6 h-6" />
                        </button>
                    )}
                </>
            )}

            {studyMode === 'quiz' && quizState && quizState.isSubmitted && (
                 <button 
                    onClick={() => handleRating(quizState.isCorrect || false)}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 animate-bounce"
                 >
                    Next Question <TrendingUpIcon className="w-4 h-4" />
                 </button>
            )}
        </div>
        
        {studyMode === 'flashcard' && reviewMode && (
            <p className="text-white/50 text-xs mt-4">
                Did you remember the meaning? Rate the card honestly.
            </p>
        )}
    </div>
  );
};

export default FlashcardStudy;