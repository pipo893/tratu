import { GoogleGenAI, Type } from "@google/genai";
import { WordData } from "../types";

const apiKey = process.env.API_KEY;

if (!apiKey) {
  console.error("API Key is missing!");
}

const ai = new GoogleGenAI({ apiKey: apiKey || '' });

// Persistent Cache using LocalStorage
// Updated version to v2 to invalidate old "Title Case" entries
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
      contents: `Define "${word}" (English-Vietnamese). Provide phonetic, 2 common meanings (partOfSpeech, vietnamese, short english definition), and 1 short example sentence with translation. JSON format. Ensure the 'word' field is in lowercase (e.g. 'law'), unless it is a proper noun (e.g. 'English').`,
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING, description: "The word in lowercase (e.g. 'law'), unless proper noun." },
            phonetic: { type: Type.STRING },
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
          required: ["word", "phonetic", "meanings", "examples"]
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