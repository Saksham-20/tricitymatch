const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Allowed MIME types with their expected extensions
const ALLOWED_MIME_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/pdf': ['.pdf']
};

// Sanitize filename to prevent path traversal and special characters
const sanitizeFilename = (filename) => {
  // Remove path components and special characters
  const sanitized = path.basename(filename)
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/\.{2,}/g, '.');
  return sanitized || 'file';
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const isDocument = file.fieldname.toLowerCase().includes('document');
    const uploadPath = path.join(uploadsDir, isDocument ? 'documents' : 'photos');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    const sanitizedFieldname = sanitizeFilename(file.fieldname);
    cb(null, sanitizedFieldname + '-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const mimetype = file.mimetype.toLowerCase();
  const ext = path.extname(file.originalname).toLowerCase();
  
  // Check if mimetype is allowed
  if (!ALLOWED_MIME_TYPES[mimetype]) {
    return cb(new Error('File type not allowed. Only JPEG, PNG, and PDF files are accepted.'));
  }
  
  // Verify extension matches the claimed mimetype
  const allowedExtensions = ALLOWED_MIME_TYPES[mimetype];
  if (!allowedExtensions.includes(ext)) {
    return cb(new Error('File extension does not match file type.'));
  }
  
  cb(null, true);
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: fileFilter
});

// File magic number signatures for validation
const FILE_SIGNATURES = {
  jpeg: [0xFF, 0xD8, 0xFF],
  png: [0x89, 0x50, 0x4E, 0x47],
  pdf: [0x25, 0x50, 0x44, 0x46] // %PDF
};

// Validate file content by checking magic numbers (call after upload)
const validateFileSignature = async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  
  // Determine expected signature based on extension
  let expectedSignature;
  if (['.jpg', '.jpeg'].includes(ext)) {
    expectedSignature = FILE_SIGNATURES.jpeg;
  } else if (ext === '.png') {
    expectedSignature = FILE_SIGNATURES.png;
  } else if (ext === '.pdf') {
    expectedSignature = FILE_SIGNATURES.pdf;
  } else {
    return false; // Unknown extension
  }
  
  try {
    // Read first few bytes of file
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(expectedSignature.length);
    fs.readSync(fd, buffer, 0, expectedSignature.length, 0);
    fs.closeSync(fd);
    
    // Compare with expected signature
    for (let i = 0; i < expectedSignature.length; i++) {
      if (buffer[i] !== expectedSignature[i]) {
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error('Error validating file signature:', error);
    return false;
  }
};

// Middleware to validate uploaded files' signatures
const validateUploadedFiles = async (req, res, next) => {
  if (!req.files) return next();
  
  const allFiles = [];
  for (const fieldname of Object.keys(req.files)) {
    allFiles.push(...req.files[fieldname]);
  }
  
  for (const file of allFiles) {
    const isValid = await validateFileSignature(file.path);
    if (!isValid) {
      // Delete invalid file
      fs.unlinkSync(file.path);
      return res.status(400).json({ 
        message: 'Invalid file content. File does not match its extension.' 
      });
    }
  }
  
  next();
};

// Photo upload middleware (multiple files)
const uploadPhotos = upload.fields([
  { name: 'photos', maxCount: 5 },
  { name: 'profilePhoto', maxCount: 1 }
]);

// Document upload middleware
const uploadDocuments = upload.fields([
  { name: 'documentFront', maxCount: 1 },
  { name: 'documentBack', maxCount: 1 },
  { name: 'selfiePhoto', maxCount: 1 }
]);

module.exports = { uploadPhotos, uploadDocuments, validateUploadedFiles, validateFileSignature };

