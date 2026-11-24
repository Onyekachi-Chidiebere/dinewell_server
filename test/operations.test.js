const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PRODUCTION_REQUIRED,
  missingProductionVariables,
  validateEnvironment,
} = require('../utils/env');
const {
  assertProductionTarget,
  looksProduction,
} = require('../scripts/lib/database-operations');
const { main: backup } = require('../scripts/production-backup');
const { main: migrate } = require('../scripts/production-migrate');
const { main: reset } = require('../scripts/production-reset');

function completeProductionEnvironment() {
  return Object.fromEntries([
    ['NODE_ENV', 'production'],
    ['DATABASE_URL', 'postgresql://user:password@prod-db.dinewell.ca:5432/dinewell_prod'],
    ['DB_SSL_ALLOW_SYSTEM_CA', 'true'],
    ...PRODUCTION_REQUIRED.map((name) => [name, `${name.toLowerCase()}-placeholder`]),
  ]);
}

test('production environment validation lists names but never values', () => {
  const env = completeProductionEnvironment();
  delete env.JSON_WEB_SECRET;
  env.STRIPE_SECRET_KEY = 'sensitive-value-that-must-not-be-logged';
  assert.deepEqual(missingProductionVariables(env), ['JSON_WEB_SECRET']);
  assert.throws(
    () => validateEnvironment(env),
    (error) => error.message.includes('JSON_WEB_SECRET')
      && !error.message.includes(env.STRIPE_SECRET_KEY)
  );
});

test('non-production environment remains isolated from production requirements', () => {
  assert.doesNotThrow(() => validateEnvironment({ NODE_ENV: 'test' }));
});

test('database target classifier refuses local and ambiguous targets', () => {
  assert.equal(looksProduction(new URL('postgresql://u:p@localhost:5432/dinewell_prod')), false);
  assert.equal(looksProduction(new URL('postgresql://u:p@db.example.com:5432/app')), false);
  assert.equal(looksProduction(new URL('postgresql://u:p@prod-db.dinewell.ca:5432/app')), true);
  assert.throws(
    () => assertProductionTarget(new URL('postgresql://u:p@db.example.com:5432/app'), []),
    /does not look like production/
  );
});

test('operator scripts refuse to run without their explicit confirmation flags', () => {
  const env = completeProductionEnvironment();
  assert.throws(() => backup([], env), /--confirm-backup/);
  assert.throws(() => migrate([], env), /--confirm-migrate/);
  assert.throws(() => reset([], env), /--confirm-reset=RESET-PRODUCTION-DATABASE/);
});
