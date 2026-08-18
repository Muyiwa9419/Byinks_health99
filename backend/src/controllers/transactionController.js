const { Transaction } = require('../models');

async function listTransactions(req, res) {
  const transactions = await Transaction.findAll({
    where: { userId: req.params.userId },
    order: [['createdAt', 'DESC']],
  });
  res.json(transactions);
}

async function createTransaction(req, res) {
  const { userId, amount, type, description } = req.body;
  const transaction = await Transaction.create({
    userId, amount, type, description, timestamp: new Date().toISOString(),
  });
  res.status(201).json(transaction);
}

module.exports = { listTransactions, createTransaction };
