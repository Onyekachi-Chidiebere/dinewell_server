const fs = require('fs');
const path = require('path');
const {
  assertProductionTarget,
  parseTarget,
  postgresEnvironment,
  requireCommand,
  run,
} = require('./lib/database-operations');

function main(args = process.argv.slice(2), env = process.env) {
  if (!args.includes('--confirm-backup')) {
    throw new Error('Refusing backup without --confirm-backup');
  }
  const target = parseTarget(env);
  assertProductionTarget(target, args);
  requireCommand('pg_dump');

  const outputArg = args.find((arg) => arg.startsWith('--output='));
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const output = path.resolve(outputArg ? outputArg.slice('--output='.length) : `backups/dinewell-${timestamp}.dump`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  run('pg_dump', ['--format=custom', '--no-owner', '--no-acl', '--file', output], {
    env: postgresEnvironment(target, env),
  });
  console.log(`Backup completed: ${output}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Backup refused: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { main };
