const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

// Base folder from environment
const baseFolder = process.env.CLOUDINARY_FOLDER || 'tricitymatch';

// Allowed MIME types with their expected extensions
const ALLOWED_MIME_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/pdf': ['.pdf']
};

// Cloudinary storage for profile photos (800x800 limit, face-aware crop)
const profilePhotoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: `${baseFolder}/profiles`,
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [
      { width: 800, height: 800, crop: 'limit' },
      { gravity: 'face', crop: 'thumb' }
    ],
    resource_type: 'image'
  }
});

// Cloudinary storage for gallery photos (1200x1200 limit)
const galleryPhotoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: `${baseFolder}/gallery`,
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [
      { width: 1200, height: 1200, crop: 'limit' }
    ],
    resource_type: 'image'
  }
});

// Cloudinary storage for verification documents (private access, allow PDF)
const documentStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const isPdf = file.mimetype === 'application/pdf';
    return {
      folder: `${baseFolder}/documents`,
      allowed_formats: isPdf ? ['pdf'] : ['jpg', 'jpeg', 'png'],
      resource_type: isPdf ? 'raw' : 'image',
      type: 'private',
      access_mode: 'authenticated'
    };
  }
});

// File filter for images only
const imageFileFilter = (req, file, cb) => {
  const mimetype = file.mimetype.toLowerCase();
  
  if (!['image/jpeg', 'image/png'].includes(mimetype)) {
    return cb(new Error('Only JPEG and PNG images are allowed.'));
  }
  
  cb(null, true);
};

// File filter for documents (images and PDFs)
const documentFileFilter = (req, file, cb) => {
  const mimetype = file.mimetype.toLowerCase();
  
  if (!ALLOWED_MIME_TYPES[mimetype]) {
    return cb(new Error('File type not allowed. Only JPEG, PNG, and PDF files are accepted.'));
  }
  
  cb(null, true);
};

// Combined storage that routes to appropriate Cloudinary folder based on field name
const combinedStorage = {
  _handleFile: function(req, file, cb) {
    let storage;
    
    if (file.fieldname === 'profilePhoto') {
      storage = profilePhotoStorage;
    } else if (file.fieldname === 'photos') {
      storage = galleryPhotoStorage;
    } else {
      storage = documentStorage;
    }
    
    storage._handleFile(req, file, cb);
  },
  _removeFile: function(req, file, cb) {
    // Cloudinary handles file removal through its API
    cb(null);
  }
};

// Upload middleware for photos (profile and gallery)
const uploadPhotos = multer({
  storage: combinedStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: imageFileFilter
}).fields([
  { name: 'photos', maxCount: 5 },
  { name: 'profilePhoto', maxCount: 1 }
]);

// Upload middleware for verification documents
const uploadDocuments = multer({
  storage: documentStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: documentFileFilter
}).fields([
  { name: 'documentFront', maxCount: 1 },
  { name: 'documentBack', maxCount: 1 },
  { name: 'selfiePhoto', maxCount: 1 }
]);

// No-op validation for Cloudinary (Cloudinary handles file validation)
const validateUploadedFiles = (req, res, next) => {
  // Cloudinary validates files during upload, so we just pass through
  next();
};

/**
 * Delete a file from Cloudinary by its URL
 * @param {string} url - The full Cloudinary URL of the file
 * @returns {Promise<object>} - Cloudinary deletion result
 */
const deleteFromCloudinary = async (url) => {
  if (!url || !url.includes('cloudinary')) {
    return null;
  }
  
  try {
    // Extract public_id from Cloudinary URL
    // URL format: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/filename.ext
    const urlParts = url.split('/');
    const uploadIndex = urlParts.indexOf('upload');
    
    if (uploadIndex === -1) {
      console.error('Invalid Cloudinary URL format:', url);
      return null;
    }
    
    // Get everything after 'upload/vXXXX/' as the public_id (without extension)
    const publicIdParts = urlParts.slice(uploadIndex + 2);
    const lastPart = publicIdParts[publicIdParts.length - 1];
    
    // Remove file extension from the last part
    const lastPartWithoutExt = lastPart.replace(/\.[^/.]+$/, '');
    publicIdParts[publicIdParts.length - 1] = lastPartWithoutExt;
    
    const publicId = publicIdParts.join('/');
    
    // Determine resource type based on URL
    const resourceType = url.includes('/raw/') ? 'raw' : 'image';
    
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });
    
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};

/**
 * Get a transformed thumbnail URL from a Cloudinary URL
 * @param {string} url - The original Cloudinary URL
 * @param {number} width - Desired width
 * @param {number} height - Desired height
 * @param {object} options - Additional transformation options
 * @returns {string} - The transformed URL
 */
const getThumbnailUrl = (url, width = 150, height = 150, options = {}) => {
  if (!url || !url.includes('cloudinary')) {
    return url;
  }
  
  try {
    const {
      crop = 'thumb',
      gravity = 'face',
      format = 'auto',
      quality = 'auto'
    } = options;
    
    // Build transformation string
    const transformation = `w_${width},h_${height},c_${crop},g_${gravity},f_${format},q_${quality}`;
    
    // Insert transformation after /upload/
    const transformedUrl = url.replace('/upload/', `/upload/${transformation}/`);
    
    return transformedUrl;
  } catch (error) {
    console.error('Error generating thumbnail URL:', error);
    return url;
  }
};

/**
 * Get a profile card URL (300x300) from a Cloudinary URL
 * @param {string} url - The original Cloudinary URL
 * @returns {string} - The transformed URL
 */
const getProfileCardUrl = (url) => {
  return getThumbnailUrl(url, 300, 300, { crop: 'fill', gravity: 'face' });
};

module.exports = {
  uploadPhotos,
  uploadDocuments,
  validateUploadedFiles,
  deleteFromCloudinary,
  getThumbnailUrl,
  getProfileCardUrl
};
