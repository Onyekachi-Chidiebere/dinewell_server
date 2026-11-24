const {
  assertProductionTarget,
  parseTarget,
  run,
} = require('./lib/database-operations');

function main(args = process.argv.slice(2), env = process.env) {
  if (!args.includes('--confirm-migrate')) {
    throw new Error('Refusing production migration without --confirm-migrate');
  }
  assertProductionTarget(parseTarget(env), args);
  run(process.execPath, [require.resolve('../migrations/run')], { env });
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Migration refused: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { main };
