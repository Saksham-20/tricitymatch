/**
 * File Upload Middleware
 * Handles secure file uploads with Cloudinary
 */

const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const config = require('../config/env');
const { createError } = require('./errorHandler');

// Configure Cloudinary (log once so we know which storage is used)
const cloudinaryConfigured = config.cloudinary.isConfigured();
if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
  });
  if (config.isDevelopment) {
    console.log(`[upload] Using Cloudinary (folder: ${config.cloudinary.folder})`);
  }
} else {
  if (config.isDevelopment) {
    console.warn('[upload] Cloudinary not configured — uploads will use local disk (backend/uploads). Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env.development at project root.');
  }
}

// Allowed file types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_DOCUMENT_TYPES = [...ALLOWED_IMAGE_TYPES, 'application/pdf'];
const MAX_FILE_SIZE = config.upload.maxFileSize;

// File filter for images
const imageFileFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(createError.badRequest(`Invalid file type: ${file.mimetype}. Only JPEG, PNG, and WebP are allowed.`), false);
  }
};

// File filter for documents
const documentFileFilter = (req, file, cb) => {
  if (ALLOWED_DOCUMENT_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(createError.badRequest(`Invalid file type: ${file.mimetype}. Only images and PDFs are allowed.`), false);
  }
};

// Create Cloudinary storage configuration
const createCloudinaryStorage = (folder, transformation = []) => {
  if (!config.cloudinary.isConfigured()) {
    // Fallback to local storage if Cloudinary not configured
    return multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, config.upload.dir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${folder}-${uniqueSuffix}${path.extname(file.originalname)}`);
      }
    });
  }

  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: `${config.cloudinary.folder}/${folder}`,
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
      transformation: transformation.length > 0 ? transformation : undefined,
      resource_type: 'auto',
    },
  });
};

// Profile photo storage with optimization
const profilePhotoStorage = createCloudinaryStorage('profile-photos', [
  { width: 500, height: 500, crop: 'fill', gravity: 'face', quality: 'auto:best' },
]);

// Gallery photos storage
const galleryPhotoStorage = createCloudinaryStorage('gallery', [
  { width: 1200, height: 1200, crop: 'limit', quality: 'auto:good' },
]);

// Verification documents storage
const documentStorage = createCloudinaryStorage('verification-docs', [
  { quality: 'auto:eco' },
]);

// Create multer upload instances
const uploadProfilePhoto = multer({
  storage: profilePhotoStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).fields([
  { name: 'profilePhoto', maxCount: 1 },
]);

const uploadGalleryPhotos = multer({
  storage: galleryPhotoStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).fields([
  { name: 'photos', maxCount: config.upload.maxGalleryPhotos },
]);

// Combined upload for profile updates
const uploadPhotos = multer({
  storage: profilePhotoStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'photos', maxCount: config.upload.maxGalleryPhotos },
]);

// Upload for verification documents
const uploadDocuments = multer({
  storage: documentStorage,
  fileFilter: documentFileFilter,
  limits: { fileSize: MAX_FILE_SIZE * 2 }, // Allow larger files for documents
}).fields([
  { name: 'documentFront', maxCount: 1 },
  { name: 'documentBack', maxCount: 1 },
  { name: 'selfiePhoto', maxCount: 1 },
]);

// Validate uploaded files middleware
const validateUploadedFiles = (req, res, next) => {
  // Check if any files were uploaded
  if (req.files) {
    // Validate each file
    for (const fieldName in req.files) {
      for (const file of req.files[fieldName]) {
        // Additional security check on file type
        if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype) && !ALLOWED_DOCUMENT_TYPES.includes(file.mimetype)) {
          return next(createError.badRequest('Invalid file type detected'));
        }
      }
    }
  }
  next();
};

// Extract Cloudinary public_id from URL (handles optional transformations)
// e.g. .../upload/v123/folder/id.jpg or .../upload/c_fill,w_500/v123/folder/id.jpg
function getCloudinaryPublicId(fileUrl) {
  if (!fileUrl || !fileUrl.includes('cloudinary')) return null;
  const parts = fileUrl.split('/');
  const vIndex = parts.findIndex((p) => /^v\d+$/.test(p));
  if (vIndex === -1 || vIndex >= parts.length - 1) {
    // Fallback: last two segments as folder/filename
    const file = parts[parts.length - 1];
    const folder = parts[parts.length - 2];
    if (!file || !folder) return null;
    return `${folder}/${file.split('.')[0]}`;
  }
  const pathAfterVersion = parts.slice(vIndex + 1).join('/');
  const withoutExt = pathAfterVersion.replace(/\.[^.]+$/, '');
  return withoutExt || null;
}

// Delete file from Cloudinary
const deleteFromCloudinary = async (fileUrl) => {
  if (!fileUrl || !config.cloudinary.isConfigured()) {
    return;
  }

  try {
    const publicId = getCloudinaryPublicId(fileUrl);
    if (!publicId) {
      if (config.isDevelopment) console.warn('[upload] Could not extract public_id from URL:', fileUrl?.slice(0, 80));
      return;
    }
    const result = await cloudinary.uploader.destroy(publicId);
    if (config.isDevelopment && result?.result !== 'ok') {
      console.warn('[upload] Cloudinary destroy result:', result);
    }
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};

// Get thumbnail URL for a Cloudinary image
const getThumbnailUrl = (imageUrl, width = 150, height = 150) => {
  if (!imageUrl || !imageUrl.includes('cloudinary')) {
    return imageUrl;
  }

  // Insert transformation before /upload/
  return imageUrl.replace(
    '/upload/',
    `/upload/c_fill,w_${width},h_${height},g_face/`
  );
};

// Get optimized URL for mobile
const getMobileOptimizedUrl = (imageUrl) => {
  if (!imageUrl || !imageUrl.includes('cloudinary')) {
    return imageUrl;
  }

  return imageUrl.replace(
    '/upload/',
    '/upload/c_limit,w_800,q_auto:good,f_auto/'
  );
};

module.exports = {
  uploadProfilePhoto,
  uploadGalleryPhotos,
  uploadPhotos,
  uploadDocuments,
  validateUploadedFiles,
  deleteFromCloudinary,
  getThumbnailUrl,
  getMobileOptimizedUrl,
  cloudinary,
};
