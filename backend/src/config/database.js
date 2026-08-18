const { Sequelize } = require('sequelize');
const path = require('path');

const { DATABASE_URL, DB_SSL, NODE_ENV } = process.env;

let sequelize;

if (DATABASE_URL) {
  // Production / staging: Postgres
  sequelize = new Sequelize(DATABASE_URL, {
    dialect: 'postgres',
    logging: NODE_ENV === 'development' ? console.log : false,
    dialectOptions: DB_SSL === 'true'
      ? { ssl: { require: true, rejectUnauthorized: false } }
      : {},
    pool: { max: 10, min: 0, idle: 10000 },
  });
  console.log('[db] Using PostgreSQL');
} else {
  // Local dev fallback: SQLite file, zero setup required
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '..', '..', 'dev.sqlite3'),
    logging: false,
  });
  console.log('[db] No DATABASE_URL set — falling back to local SQLite (dev.sqlite3)');
}

module.exports = sequelize;
