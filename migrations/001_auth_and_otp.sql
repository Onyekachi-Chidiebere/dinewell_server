CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(100) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_token (
  id UUID PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  family_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  replaced_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS refresh_token_user_id_idx ON refresh_token(user_id);
CREATE INDEX IF NOT EXISTS refresh_token_family_id_idx ON refresh_token(family_id);

CREATE TABLE IF NOT EXISTS otp_challenge (
  id UUID PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  account_type VARCHAR(50) NOT NULL,
  purpose VARCHAR(50) NOT NULL DEFAULT 'password_reset',
  otp_hash VARCHAR(64) NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  reset_jti_hash VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS otp_challenge_lookup_idx
  ON otp_challenge(email, account_type, purpose, created_at DESC);

ALTER TABLE payment ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS payment_idempotency_key_idx
  ON payment(idempotency_key) WHERE idempotency_key IS NOT NULL;
