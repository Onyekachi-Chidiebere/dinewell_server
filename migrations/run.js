const fs = require('fs');
const path = require('path');
const { sequelize } = require('../utils/db-connection');

function listMigrationFiles(directory = __dirname) {
  return fs.readdirSync(directory)
    .filter((file) => /^\d{3}_[a-z0-9_]+\.sql$/i.test(file))
    .sort();
}

async function runMigrations(options = {}) {
  const db = options.sequelize || sequelize;
  const directory = options.directory || __dirname;
  const connection = await db.connectionManager.getConnection();
  try {
    await connection.query('SELECT pg_advisory_lock(918273645)');
    await db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(100) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    for (const file of listMigrationFiles(directory)) {
      const [rows] = await db.query(
        'SELECT version FROM schema_migrations WHERE version = :version',
        { replacements: { version: file } }
      );
      if (rows.length) continue;
      await db.transaction(async (transaction) => {
        await db.query(fs.readFileSync(path.join(directory, file), 'utf8'), { transaction });
        await db.query(
          'INSERT INTO schema_migrations(version) VALUES (:version)',
          { replacements: { version: file }, transaction }
        );
      });
    }
  } finally {
    try {
      await connection.query('SELECT pg_advisory_unlock(918273645)');
    } finally {
      await db.connectionManager.releaseConnection(connection);
    }
  }
}

if (require.main === module) {
  runMigrations().then(() => process.exit(0)).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = runMigrations;
module.exports.listMigrationFiles = listMigrationFiles;
