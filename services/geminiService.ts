import { GoogleGenAI, Type } from "@google/genai";
import { WordData } from "../types";

const apiKey = process.env.API_KEY;

if (!apiKey) {
  console.error("API Key is missing!");
}

const ai = new GoogleGenAI({ apiKey: apiKey || '' });

// Persistent Cache for En-Vi
const CACHE_KEY = 'lingoflash_word_cache_v2';
const getCache = (): Record<string, Omit<WordData, 'id' | 'createdAt'>> => {
  try {
    const item = localStorage.getItem(CACHE_KEY);
    return item ? JSON.parse(item) : {};
  } catch {
    return {};
  }
};

const saveToCache = (word: string, data: Omit<WordData, 'id' | 'createdAt'>) => {
  try {
    const cache = getCache();
    cache[word.trim().toLowerCase()] = data;
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn("Cache write failed (storage likely full)", e);
  }
};

// Persistent Cache for Vi-En
const VI_EN_CACHE_KEY = 'lingoflash_vi_en_cache_v1';
const getViEnCache = (): Record<string, Omit<WordData, 'id' | 'createdAt'>> => {
  try {
    const item = localStorage.getItem(VI_EN_CACHE_KEY);
    return item ? JSON.parse(item) : {};
  } catch {
    return {};
  }
};

const saveToViEnCache = (word: string, data: Omit<WordData, 'id' | 'createdAt'>) => {
  try {
    const cache = getViEnCache();
    cache[word.trim().toLowerCase()] = data;
    localStorage.setItem(VI_EN_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn("Vi-En Cache write failed", e);
  }
};


export const lookupWord = async (word: string): Promise<Omit<WordData, 'id' | 'createdAt'>> => {
  const normalizedWord = word.trim().toLowerCase();
  
  // Check persistent cache first for instant results
  const cache = getCache();
  if (cache[normalizedWord]) {
    return cache[normalizedWord];
  }

  try {
    const modelId = 'gemini-2.5-flash';
    
    // Optimization: Request only 1 example and concise definitions to reduce latency.
    const response = await ai.models.generateContent({
      model: modelId,
      contents: `Define "${word}" (English-Vietnamese). Provide phonetic, a mnemonic spelling breakdown (e.g. 'know.ledge' or 'to.get.her'), synonyms (max 4), antonyms (max 4), 2 common meanings (partOfSpeech, vietnamese, short english definition), and 1 short example sentence with translation. JSON format. Ensure the 'word' field is in lowercase (e.g. 'law'), unless it is a proper noun (e.g. 'English').`,
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING, description: "The word in lowercase (e.g. 'law'), unless proper noun." },
            phonetic: { type: Type.STRING },
            mnemonic: { type: Type.STRING, description: "Break down the word to help remember spelling (e.g. 'know.ledge'). Use dots to separate chunks." },
            synonyms: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of synonyms (max 4)" },
            antonyms: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of antonyms (max 4)" },
            meanings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  partOfSpeech: { type: Type.STRING },
                  vietnamese: { type: Type.STRING },
                  definition: { type: Type.STRING },
                },
                required: ["partOfSpeech", "vietnamese", "definition"]
              },
            },
            examples: {
              type: Type.ARRAY,
              items: { 
                type: Type.OBJECT,
                properties: {
                    sentence: { type: Type.STRING },
                    translation: { type: Type.STRING }
                },
                required: ["sentence", "translation"]
              },
              description: "1 short example."
            }
          },
          required: ["word", "phonetic", "mnemonic", "synonyms", "antonyms", "meanings", "examples"]
        }
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text) as Omit<WordData, 'id' | 'createdAt'>;
      saveToCache(normalizedWord, data);
      return data;
    } else {
      throw new Error("Empty response from AI");
    }
  } catch (error) {
    console.error("Error looking up word:", error);
    throw error;
  }
};

export const translateVietnameseToEnglish = async (word: string): Promise<Omit<WordData, 'id' | 'createdAt'>> => {
  const normalizedWord = word.trim().toLowerCase();
  
  const cache = getViEnCache();
  if (cache[normalizedWord]) {
    return cache[normalizedWord];
  }

  try {
    const modelId = 'gemini-2.5-flash';
    
    const response = await ai.models.generateContent({
      model: modelId,
      contents: `Translate the Vietnamese word or phrase "${word}" to English. Provide the most common English translation, its phonetic pronunciation, a mnemonic spelling breakdown (e.g. 'know.ledge'), synonyms (max 4), antonyms (max 4), one common meaning (the 'vietnamese' field should be the original vietnamese word, plus its part of speech, and a short english definition), and 1 short example sentence with its Vietnamese translation. Format as JSON. Ensure the main 'word' field is the resulting English word in lowercase.`,
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING, description: "The translated English word in lowercase." },
            phonetic: { type: Type.STRING },
            mnemonic: { type: Type.STRING, description: "Break down the word to help remember spelling (e.g. 'know.ledge')." },
            synonyms: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of synonyms (max 4)" },
            antonyms: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of antonyms (max 4)" },
            meanings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  partOfSpeech: { type: Type.STRING },
                  vietnamese: { type: Type.STRING, description: "The original Vietnamese word/phrase." },
                  definition: { type: Type.STRING },
                },
                required: ["partOfSpeech", "vietnamese", "definition"]
              },
            },
            examples: {
              type: Type.ARRAY,
              items: { 
                type: Type.OBJECT,
                properties: {
                    sentence: { type: Type.STRING },
                    translation: { type: Type.STRING }
                },
                required: ["sentence", "translation"]
              },
              description: "1 short example."
            }
          },
          required: ["word", "phonetic", "mnemonic", "synonyms", "antonyms", "meanings", "examples"]
        }
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text) as Omit<WordData, 'id' | 'createdAt'>;
      saveToViEnCache(normalizedWord, data);
      return data;
    } else {
      throw new Error("Empty response from AI");
    }
  } catch (error) {
    console.error("Error translating word:", error);
    throw error;
  }
};
