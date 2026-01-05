import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FiEdit2, FiCheck, FiX } from 'react-icons/fi';

const PROMPT_OPTIONS = [
  "I'm looking for someone who...",
  "My family values...",
  "I believe marriage is...",
  "My ideal partner should be...",
  "What I bring to a relationship...",
  "My family background...",
  "My simple pleasures in life...",
  "I value in a life partner...",
  "I'm the type of person who...",
  "We'll get along if...",
  "My ideal weekend...",
  "What makes me unique...",
  "I appreciate when someone...",
  "My approach to life...",
  "I'm looking forward to..."
];

const ProfilePrompts = ({ prompts = {}, onChange }) => {
  const [editingPrompt, setEditingPrompt] = useState(null);
  const [selectedPrompts, setSelectedPrompts] = useState(
    Object.keys(prompts).filter(key => key.startsWith('prompt'))
  );

  const handleSelectPrompt = (promptText) => {
    const promptKey = `prompt${selectedPrompts.length + 1}`;
    const answerKey = `answer${selectedPrompts.length + 1}`;
    
    setSelectedPrompts([...selectedPrompts, promptKey]);
    onChange({
      ...prompts,
      [promptKey]: promptText,
      [answerKey]: ''
    });
    setEditingPrompt(promptKey);
  };

  const handleAnswerChange = (answerKey, value) => {
    onChange({
      ...prompts,
      [answerKey]: value
    });
  };

  const handleRemovePrompt = (promptKey, answerKey) => {
    const newPrompts = { ...prompts };
    delete newPrompts[promptKey];
    delete newPrompts[answerKey];
    setSelectedPrompts(selectedPrompts.filter(key => key !== promptKey));
    onChange(newPrompts);
  };

  const availablePrompts = PROMPT_OPTIONS.filter(
    prompt => !Object.values(prompts).includes(prompt)
  );

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-900 mb-1">
          About Me Prompts
        </label>
        <p className="text-sm text-gray-600">
          Answer 2-3 prompts to help others understand your values and personality better
        </p>
      </div>

      {/* Selected Prompts */}
      {selectedPrompts.map((promptKey, index) => {
        const answerKey = `answer${index + 1}`;
        const promptText = prompts[promptKey];
        const answer = prompts[answerKey] || '';

        if (!promptText) return null;

        return (
          <motion.div
            key={promptKey}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 border border-gray-200 rounded-lg bg-gray-50"
          >
            <div className="flex items-start justify-between mb-2">
              <p className="font-medium text-gray-900 text-sm">{promptText}</p>
              <button
                type="button"
                onClick={() => handleRemovePrompt(promptKey, answerKey)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Remove prompt"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>
            {editingPrompt === promptKey || !answer ? (
              <textarea
                value={answer}
                onChange={(e) => handleAnswerChange(answerKey, e.target.value)}
                onBlur={() => setEditingPrompt(null)}
                placeholder="Share your thoughts..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none text-gray-900"
                rows={3}
                autoFocus
              />
            ) : (
              <div
                onClick={() => setEditingPrompt(promptKey)}
                className="px-3 py-2 bg-white rounded-lg cursor-text hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200"
              >
                <p className="text-gray-700">{answer || 'Click to add your answer...'}</p>
              </div>
            )}
          </motion.div>
        );
      })}

      {/* Add New Prompt */}
      {selectedPrompts.length < 3 && availablePrompts.length > 0 && (
        <div className="relative">
          <select
            onChange={(e) => {
              if (e.target.value) {
                handleSelectPrompt(e.target.value);
                e.target.value = '';
              }
            }}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white text-gray-900"
          >
            <option value="">+ Add a prompt</option>
            {availablePrompts.map((prompt) => (
              <option key={prompt} value={prompt}>
                {prompt}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedPrompts.length >= 3 && (
        <p className="text-sm text-gray-600 flex items-center gap-1.5">
          <FiCheck className="w-4 h-4 text-green-600" />
          You've added {selectedPrompts.length} prompts. This helps others understand you better.
        </p>
      )}
    </div>
  );
};

export default ProfilePrompts;

