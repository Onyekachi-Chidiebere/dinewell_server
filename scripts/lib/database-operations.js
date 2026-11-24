const { spawnSync } = require('child_process');

function databaseUrlFromEnv(env = process.env) {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  const required = ['DB', 'DB_USER', 'DB_PASSWORD', 'DB_HOST', 'DB_PORT'];
  const missing = required.filter((name) => !String(env[name] || '').trim());
  if (missing.length) {
    throw new Error(`Database configuration missing: DATABASE_URL or ${missing.join(', ')}`);
  }
  const url = new URL('postgresql://placeholder');
  url.username = env.DB_USER;
  url.password = env.DB_PASSWORD;
  url.hostname = env.DB_HOST;
  url.port = env.DB_PORT;
  url.pathname = `/${env.DB}`;
  return url.toString();
}

function parseTarget(env = process.env) {
  let target;
  try {
    target = new URL(databaseUrlFromEnv(env));
  } catch (error) {
    throw new Error(`Invalid database configuration: ${error.message}`);
  }
  if (!['postgres:', 'postgresql:'].includes(target.protocol)) {
    throw new Error('Only PostgreSQL targets are supported');
  }
  return target;
}

function looksProduction(target) {
  const identity = `${target.hostname}/${target.pathname}`.toLowerCase();
  if (/(localhost|127\.0\.0\.1|\.local|test|testing|dev|development|staging)/.test(identity)) {
    return false;
  }
  return /(prod|production|dinewell|railway|rlwy)/.test(identity);
}

function assertProductionTarget(target, args = process.argv.slice(2)) {
  if (looksProduction(target) || args.includes('--allow-non-production')) return;
  throw new Error(
    'Database target does not look like production; refuse to continue '
    + '(use --allow-non-production only after independently verifying the target)'
  );
}

function postgresEnvironment(target, env = process.env) {
  return {
    ...env,
    PGHOST: target.hostname,
    PGPORT: target.port || '5432',
    PGDATABASE: target.pathname.replace(/^\//, ''),
    PGUSER: decodeURIComponent(target.username),
    PGPASSWORD: decodeURIComponent(target.password),
    PGSSLMODE: env.DB_SSL === 'false' ? 'disable' : 'require',
  };
}

function requireCommand(command) {
  const result = spawnSync(command, ['--version'], { stdio: 'ignore' });
  if (result.status !== 0) {
    throw new Error(`${command} is required but was not found in PATH`);
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}`);
}

module.exports = {
  assertProductionTarget,
  databaseUrlFromEnv,
  looksProduction,
  parseTarget,
  postgresEnvironment,
  requireCommand,
  run,
};
