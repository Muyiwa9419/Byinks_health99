const express = require('express');
const { listTransactions, createTransaction } = require('../controllers/transactionController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/:userId', requireAuth, listTransactions);
router.post('/', requireAuth, createTransaction);

module.exports = router;
