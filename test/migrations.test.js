const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DB_SSL = 'false';

const migrationsDirectory = path.resolve(__dirname, '../migrations');
const { listMigrationFiles } = require('../migrations/run');

const modelContracts = [
  [require('../models/user'), 'user'],
  [require('../models/platformSettings'), 'platform_settings'],
  [require('../models/dish'), 'dishes'],
  [require('../models/payments'), 'payment'],
  [require('../models/points'), 'points'],
  [require('../models/notification'), 'notification'],
  [require('../models/deviceToken'), 'device_token'],
  [require('../models/socket'), 'sockets'],
  [require('../models/refreshToken'), 'refresh_token'],
  [require('../models/otpChallenge'), 'otp_challenge'],
];

function unquote(identifier) {
  return identifier.replace(/^"|"$/g, '');
}

function tableBody(sql, tableName) {
  const matcher = new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+(?:"${tableName}"|${tableName})\\s*\\(`, 'i');
  const match = matcher.exec(sql);
  if (!match) return null;
  const start = match.index + match[0].length;
  let depth = 1;
  let inString = false;
  for (let index = start; index < sql.length; index += 1) {
    const char = sql[index];
    if (char === "'" && sql[index - 1] !== '\\') inString = !inString;
    if (inString) continue;
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (depth === 0) return sql.slice(start, index);
  }
  return null;
}

test('fresh migrations are strictly ordered with baseline first', () => {
  const files = listMigrationFiles(migrationsDirectory);
  assert.deepEqual(files, ['000_baseline.sql', '001_auth_and_otp.sql']);
  const combined = files.map((file) => fs.readFileSync(path.join(migrationsDirectory, file), 'utf8')).join('\n');
  assert.ok(combined.indexOf('CREATE TABLE IF NOT EXISTS "user"') < combined.indexOf('CREATE TABLE IF NOT EXISTS refresh_token'));
  assert.ok(combined.indexOf('CREATE TABLE IF NOT EXISTS payment') < combined.indexOf('CREATE TABLE IF NOT EXISTS points'));
});

test('migration tables and columns match Sequelize model contracts', () => {
  const sql = listMigrationFiles(migrationsDirectory)
    .map((file) => fs.readFileSync(path.join(migrationsDirectory, file), 'utf8'))
    .join('\n');

  for (const [model, expectedTable] of modelContracts) {
    assert.equal(unquote(String(model.getTableName())), expectedTable);
    const body = tableBody(sql, expectedTable);
    assert.ok(body, `missing CREATE TABLE for ${expectedTable}`);
    for (const attribute of Object.values(model.rawAttributes)) {
      const column = attribute.field || attribute.fieldName;
      const columnPattern = new RegExp(`(?:^|[,\\n]\\s*)(?:"${column}"|${column.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\s+`, 'm');
      assert.match(body, columnPattern, `${expectedTable}.${column} missing from migrations`);
    }
  }
});

test('migration SQL has balanced statement structure and idempotent guards', () => {
  for (const file of listMigrationFiles(migrationsDirectory)) {
    const sql = fs.readFileSync(path.join(migrationsDirectory, file), 'utf8');
    assert.match(sql, /IF NOT EXISTS/i);
    assert.equal((sql.match(/\$\$/g) || []).length % 2, 0, `${file} has unbalanced dollar quotes`);
    assert.equal((sql.match(/\(/g) || []).length, (sql.match(/\)/g) || []).length, `${file} has unbalanced parentheses`);
  }
});
