const express = require('express');
const router = express.Router();
const { submitVerification, getVerificationStatus } = require('../controllers/verificationController');
const { auth } = require('../middlewares/auth');
const { uploadDocuments, validateUploadedFiles } = require('../middlewares/upload');

router.post('/submit', auth, uploadDocuments, validateUploadedFiles, submitVerification);
router.get('/status', auth, getVerificationStatus);

module.exports = router;

