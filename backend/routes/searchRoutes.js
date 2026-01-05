const express = require('express');
const router = express.Router();
const { searchProfiles, getSuggestions } = require('../controllers/searchController');
const { auth } = require('../middlewares/auth');

router.get('/', auth, searchProfiles);
router.get('/suggestions', auth, getSuggestions);

module.exports = router;

