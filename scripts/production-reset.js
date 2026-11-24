const {
  assertProductionTarget,
  parseTarget,
  postgresEnvironment,
  requireCommand,
  run,
} = require('./lib/database-operations');

const CONFIRMATION = '--confirm-reset=RESET-PRODUCTION-DATABASE';

function main(args = process.argv.slice(2), env = process.env) {
  if (!args.includes(CONFIRMATION)) {
    throw new Error(`Refusing destructive reset without ${CONFIRMATION}`);
  }
  const target = parseTarget(env);
  assertProductionTarget(target, args);
  requireCommand('psql');
  run(
    'psql',
    ['--set', 'ON_ERROR_STOP=1', '--command', 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'],
    { env: postgresEnvironment(target, env) }
  );
  run(process.execPath, [require.resolve('../migrations/run')], { env });
  console.log('Production database reset and migrations completed');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Reset refused: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { CONFIRMATION, main };
