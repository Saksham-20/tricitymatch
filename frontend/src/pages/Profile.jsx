import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { ProfileMultiStepForm } from '../components/ui/profile-multistep-form';
import { FiCheckCircle, FiHeart, FiUsers, FiStar, FiX } from 'react-icons/fi';
import { limits } from '../config';

const AUTO_SAVE_DEBOUNCE_MS = 1500;

const Profile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({});
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'
  const saveTimeoutRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Check if user has premium subscription
  const [isPremium, setIsPremium] = useState(false);
  
  useEffect(() => {
    checkSubscription();
  }, []);
  
  const checkSubscription = async () => {
    try {
      const response = await api.get('/subscription/my-subscription');
      const subscription = response.data.subscription;
      setIsPremium(subscription?.status === 'active' && ['premium', 'elite'].includes(subscription?.planType));
    } catch (error) {
      setIsPremium(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await api.get('/profile/me');
      const profileData = response.data.profile;
      setProfile(profileData);
      setFormData(profileData || {});
      
      // Determine which step to show based on completion
      if (profileData) {
        const completion = profileData.completionPercentage || 0;
        if (completion < 30) setActiveStep(0);
        else if (completion < 50) setActiveStep(1);
        else if (completion < 70) setActiveStep(2);
        else if (completion < 85) setActiveStep(3);
        else if (completion < 95) setActiveStep(4);
        else setActiveStep(5);
      }
    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const maxPhotos = limits.maxGalleryPhotos || 6;

  const handleFileUpload = async (e, field) => {
    const isMultiple = field === 'photos';
    const files = isMultiple ? Array.from(e.target.files || []) : (e.target.files?.[0] ? [e.target.files[0]] : []);
    if (!files.length) return;

    const maxBytes = limits.maxFileSize || 5 * 1024 * 1024;
    const maxMB = Math.round(maxBytes / 1024 / 1024);
    for (const file of files) {
      if (file.size > maxBytes) {
        toast.error(`"${file.name}" is too large. Maximum size is ${maxMB}MB.`);
        e.target.value = '';
        return;
      }
    }

    const currentCount = profile?.photos?.length ?? 0;
    const slotsLeft = maxPhotos - currentCount;
    if (isMultiple && files.length > slotsLeft) {
      toast.error(`You can add up to ${maxPhotos} photos. ${slotsLeft} slot(s) left.`);
      e.target.value = '';
      return;
    }

    const formDataObj = new FormData();
    const key = field === 'profilePhoto' ? 'profilePhoto' : 'photos';
    files.forEach((file) => formDataObj.append(key, file));

    try {
      const putResponse = await api.put('/profile/me', formDataObj);
      const fromPut = putResponse.data?.profile;
      if (fromPut && Array.isArray(fromPut.photos)) {
        setProfile(fromPut);
        setFormData(fromPut);
      }
      toast.success(files.length > 1 ? 'Photos uploaded successfully' : 'Photo uploaded successfully');
      // Refetch with cache-bust so browser doesn't return 304 cached (stale) profile
      const { data } = await api.get(`/profile/me?_=${Date.now()}`);
      const updatedProfile = data?.profile;
      if (updatedProfile) {
        setProfile(updatedProfile);
        setFormData(updatedProfile);
      }
      if ((updatedProfile || fromPut)?.completionPercentage >= 100) {
        setShowCompletionModal(true);
      }
    } catch (error) {
      const msg = error.response?.data?.error?.message || 'Failed to upload photo';
      toast.error(msg);
    } finally {
      e.target.value = '';
    }
  };

  const handleSetAsProfilePhoto = async (photoUrl) => {
    if (!photoUrl || profile?.profilePhoto === photoUrl) return;
    try {
      const response = await api.put('/profile/me', { profilePhoto: photoUrl });
      setProfile(response.data.profile);
      setFormData(response.data.profile);
      toast.success('Profile photo updated');
    } catch (error) {
      const msg = error.response?.data?.error?.message || 'Failed to set profile photo';
      toast.error(msg);
    }
  };

  const handleDeletePhoto = async (photoUrl) => {
    if (!photoUrl) return;
    try {
      const { data } = await api.delete('/profile/me/photo', { data: { photoUrl } });
      // Update UI immediately from delete response (avoids stale GET cache)
      if (Array.isArray(data.photos)) {
        const updated = {
          ...profile,
          photos: data.photos,
          ...(data.profilePhoto !== undefined && { profilePhoto: data.profilePhoto }),
        };
        setProfile(updated);
        setFormData(updated);
      }
      toast.success('Photo removed');
      // Refetch with cache-bust to stay in sync (completion %, etc.)
      const res = await api.get(`/profile/me?_=${Date.now()}`);
      const refreshed = res.data?.profile;
      if (refreshed) {
        setProfile(refreshed);
        setFormData(refreshed);
      }
    } catch (error) {
      const msg = error.response?.data?.error?.message || 'Failed to remove photo';
      toast.error(msg);
    }
  };

  const handleDeleteProfilePhoto = async () => {
    try {
      await api.delete('/profile/me/profile-photo');
      const response = await api.get('/profile/me');
      const updatedProfile = response.data.profile;
      setProfile(updatedProfile);
      setFormData(updatedProfile);
      toast.success('Profile photo removed');
    } catch (error) {
      const msg = error.response?.data?.error?.message || 'Failed to remove profile photo';
      toast.error(msg);
    }
  };

  const handleMultiStepComplete = async (data) => {
    try {
      const response = await api.put('/profile/me', data);
      const updatedProfile = response.data.profile;
      setProfile(updatedProfile);
      setFormData(updatedProfile);

      // Check if profile is now complete (>= 90% or 100%)
      const completion = updatedProfile.completionPercentage || 0;
      if (completion >= 90) {
        setShowCompletionModal(true);
      } else {
        toast.success(
          completion >= 50
            ? 'Profile saved! Add more details to get better matches.'
            : 'Profile saved. Complete your profile to get better results and more visibility.'
        );
        navigate('/dashboard');
      }
    } catch (error) {
      const msg = error.response?.data?.error?.message || 'Failed to update profile';
      toast.error(msg);
    }
  };

  const calculateProgress = () => {
    if (!profile) return 0;
    return profile.completionPercentage || 0;
  };

  const handleCloseModal = () => {
    setShowCompletionModal(false);
    navigate('/dashboard');
  };

  // Auto-save: debounced PUT so data persists after reload
  const saveToBackend = useCallback(async (data) => {
    if (!data || typeof data !== 'object') return;
    setSaveStatus('saving');
    try {
      const response = await api.put('/profile/me', data);
      const updatedProfile = response.data.profile;
      setProfile(updatedProfile);
      setFormData(updatedProfile);
      setSaveStatus('saved');
      if (updatedProfile.completionPercentage >= 100) setShowCompletionModal(true);
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      setSaveStatus('idle');
      const msg = error.response?.data?.error?.message || 'Could not save. Please try again.';
      toast.error(msg);
    }
  }, []);

  const handleFormDataChange = useCallback((newFormData) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      saveToBackend(newFormData);
    }, AUTO_SAVE_DEBOUNCE_MS);
  }, [saveToBackend]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 via-white to-neutral-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-neutral-600 font-medium">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-neutral-50 via-white to-neutral-50">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/profile"
            className="text-primary-600 hover:text-primary-700 text-sm font-medium mb-4 inline-block"
          >
            ← View my profile
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold text-neutral-900 mb-4 bg-gradient-to-r from-primary-600 to-primary-500 bg-clip-text text-transparent">
            Edit profile
          </h1>
            
          {/* Enhanced Progress Bar */}
          <div className="mb-6 bg-white rounded-2xl shadow-lg border border-neutral-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-base font-semibold text-neutral-900">Profile Completion</span>
              <span className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-saffron-500 bg-clip-text text-transparent">
                {calculateProgress()}%
              </span>
            </div>
            <div className="w-full bg-neutral-200 rounded-full h-4 overflow-hidden">
              <div
                className="bg-gradient-to-r from-primary-500 via-primary-600 to-saffron-500 h-4 rounded-full transition-all duration-700 ease-out shadow-lg"
                style={{ width: `${calculateProgress()}%` }}
              ></div>
            </div>
            {calculateProgress() < 100 && (
              <p className="text-sm text-neutral-600 mt-3 text-center">
                Complete your profile for better matches and more visibility
              </p>
            )}
            {calculateProgress() >= 100 && (
              <p className="text-sm text-trust-600 font-semibold mt-3 text-center flex items-center justify-center gap-2">
                <FiCheckCircle className="w-4 h-4" />
                Profile Complete! You're all set to find matches.
              </p>
            )}
            {saveStatus !== 'idle' && (
              <p className="text-sm text-neutral-500 mt-2 text-center">
                {saveStatus === 'saving' && 'Saving…'}
                {saveStatus === 'saved' && (
                  <span className="text-trust-600 font-medium flex items-center justify-center gap-1">
                    <FiCheckCircle className="w-4 h-4" />
                    Saved — your progress is safe if you leave or reload.
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 p-8 md:p-10">
          <ProfileMultiStepForm
            initialData={formData}
            onComplete={handleMultiStepComplete}
            onStepChange={(step) => setActiveStep(step)}
            onFormDataChange={handleFormDataChange}
            isPremium={isPremium}
            profile={profile}
            onFileUpload={handleFileUpload}
            onSetAsProfilePhoto={handleSetAsProfilePhoto}
            onDeletePhoto={handleDeletePhoto}
            onDeleteProfilePhoto={handleDeleteProfilePhoto}
            maxPhotos={maxPhotos}
          />
        </div>
      </div>

      {/* Completion Success Modal */}
      {showCompletionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 transform transition-all animate-in fade-in zoom-in">
            {/* Close Button */}
            <button
              onClick={handleCloseModal}
              className="absolute top-4 right-4 p-2 hover:bg-neutral-100 rounded-full transition-colors"
            >
              <FiX className="w-5 h-5 text-neutral-600" />
            </button>

            {/* Success Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-trust-100 to-trust-200 rounded-full flex items-center justify-center">
                <FiCheckCircle className="w-12 h-12 text-trust-600" />
              </div>
            </div>

            {/* Content */}
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-neutral-900 mb-3">
                Profile Complete! 🎉
              </h2>
              <p className="text-neutral-700 text-lg mb-6 leading-relaxed">
                Thank you for completing your profile! Your detailed information will help us find better matches for you.
              </p>

              {/* Benefits List */}
              <div className="bg-gradient-to-br from-primary-50 to-saffron-50 rounded-xl p-6 mb-6 text-left">
                <h3 className="font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                  <FiStar className="w-5 h-5 text-saffron-500" />
                  How this benefits you:
                </h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <FiHeart className="w-5 h-5 text-primary-500 mt-0.5 flex-shrink-0" />
                    <span className="text-neutral-700">Get more accurate match suggestions based on your preferences</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <FiUsers className="w-5 h-5 text-primary-500 mt-0.5 flex-shrink-0" />
                    <span className="text-neutral-700">Increase your visibility to potential matches</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <FiStar className="w-5 h-5 text-primary-500 mt-0.5 flex-shrink-0" />
                    <span className="text-neutral-700">Improve your compatibility scores with other profiles</span>
                  </li>
                </ul>
              </div>

              {/* Action Button */}
              <button
                onClick={handleCloseModal}
                className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5"
              >
                Start Finding Matches
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
