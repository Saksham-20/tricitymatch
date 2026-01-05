import React, { useState } from 'react';
import { FiMusic, FiLink, FiCheck } from 'react-icons/fi';
import { motion } from 'framer-motion';

const SpotifyIntegration = ({ playlistUrl = '', onChange }) => {
  const [inputValue, setInputValue] = useState(playlistUrl);
  const [isValid, setIsValid] = useState(false);

  const validateSpotifyUrl = (url) => {
    const spotifyPattern = /^https?:\/\/(open\.|play\.)?spotify\.com\/(playlist|album|track|artist)\/[a-zA-Z0-9]+/;
    return spotifyPattern.test(url);
  };

  const handleChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    const valid = value === '' || validateSpotifyUrl(value);
    setIsValid(valid);
    
    if (valid && value) {
      onChange(value);
    } else if (value === '') {
      onChange('');
    }
  };

  const extractSpotifyId = (url) => {
    const match = url.match(/\/(playlist|album|track|artist)\/([a-zA-Z0-9]+)/);
    return match ? match[2] : null;
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
        <FiMusic className="w-4 h-4 text-green-500" />
        Share Your Music Taste
      </label>
      
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <input
              type="url"
              value={inputValue}
              onChange={handleChange}
              placeholder="https://open.spotify.com/playlist/..."
              className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none transition-colors ${
                isValid && inputValue
                  ? 'border-green-500 bg-green-50'
                  : inputValue && !isValid
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-300'
              }`}
            />
          </div>
          {isValid && inputValue && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-green-500"
            >
              <FiCheck className="w-6 h-6" />
            </motion.div>
          )}
        </div>

        {inputValue && !isValid && (
          <p className="mt-1 text-xs text-red-600">
            Please enter a valid Spotify URL (playlist, album, track, or artist)
          </p>
        )}

        {isValid && inputValue && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg"
          >
            <p className="text-xs text-green-700 flex items-center gap-2">
              <FiCheck className="w-4 h-4" />
              Valid Spotify link! Others can discover your music taste
            </p>
          </motion.div>
        )}
      </div>

      <div className="flex items-start gap-2 text-xs text-gray-500">
        <FiLink className="w-4 h-4 mt-0.5" />
        <p>
          Share a Spotify playlist, album, or track to show your music preferences. 
          This helps others discover common interests!
        </p>
      </div>
    </div>
  );
};

export default SpotifyIntegration;



