export enum AppMode {
  SEARCH = 'SEARCH',
  FLASHCARDS = 'FLASHCARDS',
  STUDY = 'STUDY'
}

export interface Meaning {
  partOfSpeech: string;
  vietnamese: string;
  definition: string;
}

export interface Example {
  sentence: string;
  translation: string;
}

export interface WordData {
  id: string;
  word: string;
  phonetic: string;
  mnemonic?: string; // Breakdown for spelling (e.g. know.ledge)
  meanings: Meaning[];
  examples: Example[];
  synonyms?: string[];
  antonyms?: string[];
  createdAt: number;
  srsLevel?: number; // 0: New, 1: 1 day, 2: 3 days, 3: 7 days, 4: 14 days, 5: 30 days
  nextReview?: number; // Timestamp for next review
}

export interface FlashcardSet {
  id: string;
  name: string;
  cards: WordData[];
}