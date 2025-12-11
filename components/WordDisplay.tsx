import React, { useState, useEffect, useCallback } from 'react';
import { WordData } from '../types';
import { SpeakerIcon, PlusIcon, CheckIcon, MicIcon, XIcon } from './Icons';
import ClickableText from './ClickableText';

interface WordDisplayProps {
  data: WordData;
  onAdd?: (word: WordData) => void;
  isSaved?: boolean;
  onWordClick?: (word: string) => void;
}

// Utility to calculate similarity percentage (Levenshtein Distance based)
const calculateSimilarity = (s1: string, s2: string): number => {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  const longerLength = longer.length;
  if (longerLength === 0) {
    return 1.0;
  }
  
  const editDistance = (s1: string, s2: string) => {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();
    const costs = new Array();
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) costs[j] = j;
        else {
          if (j > 0) {
            let newValue = costs[j - 1];
            if (s1.charAt(i - 1) !== s2.charAt(j - 1))
              newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
            costs[j - 1] = lastValue;
            lastValue = newValue;
          }
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  };

  return Math.round(((longerLength - editDistance(longer, shorter)) / longerLength) * 100);
};

const WordDisplay: React.FC<WordDisplayProps> = ({ data, onAdd, isSaved = false, onWordClick }) => {
  const [isListening, setIsListening] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [heardWord, setHeardWord] = useState('');

  const playAudio = useCallback((lang: 'en-US' | 'en-GB') => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Stop any currently playing audio
      const utterance = new SpeechSynthesisUtterance(data.word);
      utterance.lang = lang;
      
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.lang === lang);
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      window.speechSynthesis.speak(utterance);
    }
  }, [data.word]);

  const handlePronunciationCheck = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Your browser does not support Speech Recognition. Please try Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsListening(true);
    setScore(null);
    setHeardWord('');

    recognition.start();

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      const normalizedTranscript = transcript.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
      const normalizedWord = data.word.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
      
      setHeardWord(transcript);
      
      const similarity = calculateSimilarity(normalizedTranscript, normalizedWord);
      setScore(similarity);
      setIsListening(false);
    };

    recognition.onspeechend = () => {
      recognition.stop();
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
      setScore(0);
      setHeardWord('Could not hear clearly');
    };
  }, [data.word]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.altKey) {
        if (e.code === 'KeyU' || e.code === 'ArrowUp' || e.code === 'KeyZ') {
          e.preventDefault();
          playAudio('en-US');
        } else if (e.code === 'KeyK' || e.code === 'ArrowDown' || e.code === 'KeyX') {
           e.preventDefault();
          playAudio('en-GB');
        } else if (e.code === 'KeyP' || e.code === 'KeyC') {
          e.preventDefault();
          handlePronunciationCheck();
        }
      } 
      
      if ((e.ctrlKey || e.metaKey) && (e.code === 'Enter' || e.code === 'Space')) {
        if (onAdd && !isSaved) {
          e.preventDefault();
          onAdd(data);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playAudio, handlePronunciationCheck, onAdd, isSaved, data]);

  const getScoreMessage = (s: number) => {
      if (s === 100) return "Excellent! Perfect pronunciation.";
      if (s >= 80) return "Great job! Very close.";
      if (s >= 50) return "Good effort. Keep practicing!";
      return "Try again. Listen to the audio and repeat.";
  };

  return (
    <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-2xl shadow-lg p-6 md:p-8 w-full max-w-2xl mx-auto border border-white/50 dark:border-slate-700 animate-[fadeIn_0.5s_ease-out] transition-colors duration-300">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-4xl font-bold text-slate-800 dark:text-white mb-2">{data.word}</h2>
          
          {data.mnemonic && data.mnemonic.toLowerCase() !== data.word.toLowerCase() && (
            <div className="inline-block px-2 py-1 mb-2 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 font-mono text-sm tracking-widest border border-indigo-100 dark:border-indigo-800">
                {data.mnemonic}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 text-slate-500 dark:text-slate-400">
            <span className="font-mono text-lg mr-2">{data.phonetic}</span>
            <div className="flex gap-2">
                <button 
                  onClick={() => playAudio('en-US')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-600 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-600 dark:text-slate-300 transition-colors text-xs font-bold tracking-wide focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  title="American Pronunciation (Alt + Z)"
                >
                  <SpeakerIcon className="w-3.5 h-3.5" />
                  US
                </button>
                <button 
                  onClick={() => playAudio('en-GB')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-600 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-600 dark:text-slate-300 transition-colors text-xs font-bold tracking-wide focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  title="British Pronunciation (Alt + X)"
                >
                  <SpeakerIcon className="w-3.5 h-3.5" />
                  UK
                </button>
                <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                <button
                    onClick={handlePronunciationCheck}
                    disabled={isListening}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-xs font-bold tracking-wide focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        isListening 
                        ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 ring-2 ring-red-400 animate-pulse' 
                        : 'bg-slate-100 dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-600 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-600 dark:text-slate-300'
                    }`}
                    title="Check Pronunciation (Alt + C)"
                >
                    <MicIcon className="w-3.5 h-3.5" />
                    {isListening ? 'Listening...' : 'Check'}
                </button>
            </div>
          </div>
          
          {(score !== null || isListening) && (
              <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 animate-[fadeIn_0.3s_ease-out]">
                  {isListening ? (
                       <div className="flex items-center gap-3">
                           <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
                           <span className="text-slate-500 dark:text-slate-300 font-medium text-sm">Listening... speak now</span>
                       </div>
                  ) : (
                      <div className="w-full">
                          <div className="flex justify-between items-end mb-2">
                              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                  Heard: <strong className="text-slate-800 dark:text-white">"{heardWord}"</strong>
                              </span>
                              <span className={`text-lg font-bold ${
                                  score! >= 80 ? 'text-green-600 dark:text-green-400' : score! >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-500 dark:text-red-400'
                              }`}>
                                  {score}%
                              </span>
                          </div>
                          
                          <div className="w-full h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden mb-2">
                              <div 
                                className={`h-full transition-all duration-1000 ease-out rounded-full ${
                                    score! >= 80 ? 'bg-green-500' : score! >= 50 ? 'bg-yellow-400' : 'bg-red-500'
                                }`}
                                style={{ width: `${score}%` }}
                              ></div>
                          </div>
                          
                          <p className={`text-sm font-medium ${
                              score! >= 80 ? 'text-green-600 dark:text-green-400' : score! >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-500 dark:text-red-400'
                              }`}>
                              {getScoreMessage(score!)}
                          </p>
                      </div>
                  )}
              </div>
          )}

        </div>
        {onAdd && (
            <button
            onClick={() => !isSaved && onAdd(data)}
            disabled={isSaved}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all duration-200 ${
                isSaved 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 cursor-default' 
                : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white shadow-md active:scale-95'
            }`}
            title="Add Card (Ctrl + Space)"
            >
            {isSaved ? <CheckIcon className="w-4 h-4" /> : <PlusIcon className="w-4 h-4" />}
            {isSaved ? 'Saved' : 'Add Card'}
            </button>
        )}
      </div>

      {/* Synonyms & Antonyms */}
      {(data.synonyms && data.synonyms.length > 0 || data.antonyms && data.antonyms.length > 0) && (
          <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-100 dark:border-slate-700/50">
              {data.synonyms && data.synonyms.length > 0 && (
                  <div className="flex flex-wrap gap-2 items-baseline mb-2 last:mb-0">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider min-w-[80px]">Synonyms</span>
                      <div className="flex flex-wrap gap-2">
                          {data.synonyms.map((syn, idx) => (
                              <button 
                                key={idx} 
                                onClick={() => onWordClick?.(syn)}
                                className="text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition-colors"
                              >
                                  {syn}
                              </button>
                          ))}
                      </div>
                  </div>
              )}
              
              {data.antonyms && data.antonyms.length > 0 && (
                  <div className="flex flex-wrap gap-2 items-baseline">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider min-w-[80px]">Antonyms</span>
                       <div className="flex flex-wrap gap-2">
                          {data.antonyms.map((ant, idx) => (
                              <button 
                                key={idx} 
                                onClick={() => onWordClick?.(ant)}
                                className="text-slate-700 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:underline transition-colors"
                              >
                                  {ant}
                              </button>
                          ))}
                      </div>
                  </div>
              )}
          </div>
      )}

      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 mb-3">Definitions</h3>
          <ul className="space-y-4">
            {data.meanings.map((m, idx) => (
              <li key={idx} className="flex flex-col sm:flex-row gap-2 sm:gap-4 p-3 rounded-lg bg-slate-50/80 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded self-start whitespace-nowrap">
                  {m.partOfSpeech}
                </span>
                <div className="flex-1">
                  <p className="text-slate-800 dark:text-slate-200 font-medium text-lg">{m.vietnamese}</p>
                  <div className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                    <ClickableText text={m.definition} onWordClick={onWordClick} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {data.examples.length > 0 && (
          <div>
             <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 mb-3">Examples</h3>
             <div className="space-y-3">
                {data.examples.map((ex, idx) => (
                    <div key={idx} className="pl-4 border-l-2 border-indigo-200 dark:border-indigo-800 text-slate-600 dark:text-slate-300">
                        <div className="italic font-medium text-slate-700 dark:text-slate-200">
                            <ClickableText text={`"${ex.sentence}"`} onWordClick={onWordClick} />
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{ex.translation}</p>
                    </div>
                ))}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WordDisplay;