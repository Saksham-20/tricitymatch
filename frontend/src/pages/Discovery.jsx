import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import toast from 'react-hot-toast';
import SwipeableCard from '../components/matching/SwipeableCard';
import { FiHeart, FiStar, FiX } from 'react-icons/fi';

const Discovery = () => {
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    try {
      setLoading(true);
      const response = await api.get('/search/suggestions?limit=20');
      setProfiles(response.data.suggestions);
    } catch (error) {
      toast.error('Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleSwipe = async (direction) => {
    const currentProfile = profiles[currentIndex];
    if (!currentProfile) return;

    const action = direction === 'right' ? 'like' : 'pass';
    
    try {
      await api.post(`/match/${currentProfile.userId}`, { action });
      
      if (action === 'like') {
        toast.success('Profile liked!');
      }
      
      // Move to next profile
      if (currentIndex < profiles.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        // Load more profiles
        loadSuggestions();
        setCurrentIndex(0);
      }
    } catch (error) {
      toast.error('Failed to perform action');
    }
  };

  const handleLike = () => handleSwipe('right');
  const handlePass = () => handleSwipe('left');
  
  const handleShortlist = async () => {
    const currentProfile = profiles[currentIndex];
    if (!currentProfile) return;

    try {
      await api.post(`/match/${currentProfile.userId}`, { action: 'shortlist' });
      toast.success('Profile shortlisted!');
      
      if (currentIndex < profiles.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        loadSuggestions();
        setCurrentIndex(0);
      }
    } catch (error) {
      toast.error('Failed to shortlist');
    }
  };

  const handleViewDetails = () => {
    const currentProfile = profiles[currentIndex];
    if (currentProfile) {
      window.location.href = `/profile/${currentProfile.userId}`;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">No More Profiles</h2>
          <p className="text-gray-600 mb-4">Check back later for new matches!</p>
        </div>
      </div>
    );
  }

  const currentProfile = profiles[currentIndex];
  const nextProfile = profiles[currentIndex + 1];

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-md mx-auto">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">Discover Matches</h1>
          <p className="text-gray-600 text-sm">
            {profiles.length - currentIndex} {profiles.length - currentIndex === 1 ? 'profile' : 'profiles'} remaining
          </p>
        </div>

        <div className="relative h-[600px]">
          {/* Next Profile (Behind) */}
          {nextProfile && (
            <motion.div
              className="absolute inset-0"
              initial={{ scale: 0.9, opacity: 0.5 }}
              animate={{ scale: 0.9, opacity: 0.5 }}
            >
              <SwipeableCard
                profile={nextProfile}
                onSwipe={handleSwipe}
                onLike={handleLike}
                onShortlist={handleShortlist}
                onPass={handlePass}
                onViewDetails={handleViewDetails}
              />
            </motion.div>
          )}

          {/* Current Profile */}
          {currentProfile && (
            <SwipeableCard
              profile={currentProfile}
              onSwipe={handleSwipe}
              onLike={handleLike}
              onShortlist={handleShortlist}
              onPass={handlePass}
              onViewDetails={handleViewDetails}
            />
          )}
        </div>

        {/* Quick Action Buttons */}
        <div className="flex justify-center gap-4 mt-6">
          <button
            onClick={handlePass}
            className="w-14 h-14 rounded-full bg-white border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 flex items-center justify-center transition-colors shadow-sm"
            aria-label="Pass"
          >
            <FiX className="w-6 h-6 text-gray-700" />
          </button>
          <button
            onClick={handleShortlist}
            className="w-14 h-14 rounded-full bg-white border-2 border-amber-300 hover:border-amber-400 hover:bg-amber-50 flex items-center justify-center transition-colors shadow-sm"
            aria-label="Save"
          >
            <FiStar className="w-6 h-6 text-amber-700" />
          </button>
          <button
            onClick={handleLike}
            className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center transition-colors shadow-sm"
            aria-label="Express Interest"
          >
            <FiHeart className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Discovery;



