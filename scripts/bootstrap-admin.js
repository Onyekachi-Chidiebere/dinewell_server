const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { Op, QueryTypes } = require('sequelize');
const User = require('../models/user');
const { sequelize, dbConnection } = require('../utils/db-connection');
const runMigrations = require('../migrations/run');
const { validateBootstrapInput, assertBootstrapAllowed } = require('../utils/adminBootstrapPolicy');

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function bootstrapAdmin(env = process.env) {
  const input = validateBootstrapInput(env);
  await dbConnection();
  await runMigrations();

  return sequelize.transaction(async (transaction) => {
    await sequelize.query('SELECT pg_advisory_xact_lock(564738291)', { transaction });
    const [adminCount, tokenRows, existingEmail] = await Promise.all([
      User.count({
        where: { type: { [Op.iLike]: 'admin' } },
        transaction,
      }),
      sequelize.query(
        'SELECT token_hash FROM admin_bootstrap_token WHERE token_hash = :tokenHash',
        {
          replacements: { tokenHash: tokenHash(input.token) },
          type: QueryTypes.SELECT,
          transaction,
        }
      ),
      User.findOne({ where: { email: input.email }, transaction }),
    ]);

    assertBootstrapAllowed({
      adminCount,
      allowAdditionalAdmin: input.allowAdditionalAdmin,
      tokenAlreadyUsed: tokenRows.length > 0,
      emailAlreadyUsed: !!existingEmail,
    });

    const admin = await User.create({
      email: input.email,
      password: await bcrypt.hash(input.password, 12),
      name: String(env.BOOTSTRAP_ADMIN_NAME || 'Administrator').trim(),
      type: 'admin',
      approval_status: 1,
      date_created: new Date(),
    }, { transaction });

    await sequelize.query(
      `INSERT INTO admin_bootstrap_token(token_hash, admin_user_id)
       VALUES (:tokenHash, :adminId)`,
      {
        replacements: { tokenHash: tokenHash(input.token), adminId: admin.id },
        transaction,
      }
    );
    return { id: admin.id, email: admin.email };
  });
}

if (require.main === module) {
  bootstrapAdmin().then((admin) => {
    console.log(`Admin bootstrap completed for ${admin.email}`);
    return sequelize.close();
  }).then(() => process.exit(0)).catch(async (error) => {
    console.error(`Admin bootstrap refused: ${error.message}`);
    try { await sequelize.close(); } catch (_) {}
    process.exit(1);
  });
}

module.exports = { bootstrapAdmin, tokenHash };
