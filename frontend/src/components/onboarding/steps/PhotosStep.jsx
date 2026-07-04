import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useOnboarding } from '../../../context/OnboardingContext';
import { FiUpload, FiX, FiImage } from 'react-icons/fi';
import PhotoGuide from '../../profile/PhotoGuide';

const PhotosStep = () => {
  const { formData, updateFormData, errors, setStepErrors, registerStepValidator } = useOnboarding();
  const fileInputRef = useRef(null);
  const [imagePreview, setImagePreview] = useState(null);
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  const validateStep = () => {
    const newErrors = {};
    if (!formDataRef.current.profilePhoto) {
      newErrors.profilePhoto = 'Please upload a profile photo';
    }
    setStepErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  React.useEffect(() => {
    return registerStepValidator(validateStep);
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setStepErrors({ profilePhoto: 'File size must be less than 5MB' });
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onload = (event) => {
        const preview = event.target?.result;
        setImagePreview(preview);
        updateFormData('profilePhoto', file);
        setStepErrors({});
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setImagePreview(null);
    updateFormData('profilePhoto', null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-5">
      {/* Profile Photo Upload */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <label className="block text-sm font-medium text-neutral-900 mb-3">
          Profile Photo {<span className="text-red-500">*</span>}
        </label>

        {!imagePreview ? (
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-neutral-300 rounded-lg p-8 text-center hover:border-primary-500 hover:bg-primary-50 transition-all"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                <FiUpload className="w-6 h-6 text-primary-600" />
              </div>
              <p className="font-medium text-neutral-900">Choose a profile photo</p>
              <p className="text-sm text-neutral-600">PNG, JPG up to 5MB</p>
            </div>
          </motion.button>
        ) : (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative inline-block w-full"
          >
            <div className="relative w-full aspect-square max-w-xs mx-auto rounded-lg overflow-hidden">
              <img
                src={imagePreview}
                alt="Profile preview"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={removePhoto}
                aria-label="Remove photo"
                className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
              >
                <FiX size={20} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 w-full py-2 text-primary-600 font-medium hover:text-primary-700"
            >
              Change Photo
            </button>
          </motion.div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {errors.profilePhoto && (
          <p className="text-sm text-red-600 mt-2">{errors.profilePhoto}</p>
        )}
      </motion.div>

      {/* Gallery Photos Info */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-neutral-50 border border-neutral-200 rounded-lg p-4"
      >
        <div className="flex gap-3">
          <FiImage className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-neutral-600">
            <p className="font-medium text-neutral-800 mb-1">Add more photos later</p>
            <p>You can add more photos to your gallery after completing the profile. Multiple photos increase your chances of finding a great match!</p>
          </div>
        </div>
      </motion.div>

      {/* Photo DO/DON'T visual guide */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-neutral-50 border border-neutral-200 rounded-lg p-4"
      >
        <PhotoGuide />
      </motion.div>
    </div>
  );
};

export default PhotosStep;
