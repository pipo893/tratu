import React from 'react';

interface ClickableTextProps {
  text: string;
  onWordClick?: (word: string) => void;
}

const ClickableText: React.FC<ClickableTextProps> = ({ text, onWordClick }) => {
  if (!text) return null;

  // Split text into words and non-words (punctuation/spaces)
  // Keeps delimiters in the array to reconstruct the full sentence
  const parts = text.split(/([a-zA-ZÀ-ÿ0-9'-]+)/);

  return (
    <span>
      {parts.map((part, i) => {
        // Simple check: part must contain at least one letter to be considered a word
        // and consist only of valid word characters (letters, numbers, apostrophes, hyphens)
        const isWord = /^[a-zA-ZÀ-ÿ0-9'-]+$/.test(part) && /[a-zA-ZÀ-ÿ]/.test(part);

        if (isWord && onWordClick) {
          return (
            <span
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                onWordClick(part);
              }}
              className="cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline decoration-indigo-300 dark:decoration-indigo-500 underline-offset-2 transition-colors"
            >
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};

export default ClickableText;