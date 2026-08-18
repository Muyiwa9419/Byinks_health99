const express = require('express');
const { signUp, signIn, signOut, me } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/signup', signUp);
router.post('/signin', signIn);
router.post('/signout', requireAuth, signOut);
router.get('/me', requireAuth, me);

module.exports = router;
