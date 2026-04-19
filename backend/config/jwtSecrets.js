/**
 * Single source for JWT signing keys. Values are trimmed to avoid Render/dashboard
 * copy-paste leading/trailing whitespace breaking verify().
 */
const DEFAULT_ACCESS = 'your-secret-key-change-in-production';
const DEFAULT_REFRESH = 'your-refresh-secret-key-change-in-production';

function readEnvTrimmed(key) {
  const v = process.env[key];
  if (v == null) return '';
  return String(v).trim();
}

const JWT_SECRET = readEnvTrimmed('JWT_SECRET') || DEFAULT_ACCESS;
const JWT_REFRESH_SECRET = readEnvTrimmed('JWT_REFRESH_SECRET') || DEFAULT_REFRESH;

function isProductionLike() {
  return process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
}

/** Call once after dotenv (e.g. from app.js). */
function assertJwtEnv() {
  if (!isProductionLike()) {
    if (JWT_SECRET === DEFAULT_ACCESS || JWT_REFRESH_SECRET === DEFAULT_REFRESH) {
      console.warn(
        '[JWT] Using default placeholder secrets. Set JWT_SECRET and JWT_REFRESH_SECRET for real deployments.'
      );
    }
    return;
  }

  if (!readEnvTrimmed('JWT_SECRET') || JWT_SECRET === DEFAULT_ACCESS) {
    console.error('[JWT] Production requires a non-empty JWT_SECRET (not the dev default).');
    process.exit(1);
  }
  if (!readEnvTrimmed('JWT_REFRESH_SECRET') || JWT_REFRESH_SECRET === DEFAULT_REFRESH) {
    console.error('[JWT] Production requires a non-empty JWT_REFRESH_SECRET (not the dev default).');
    process.exit(1);
  }

  if (JWT_SECRET === JWT_REFRESH_SECRET) {
    console.warn(
      '[JWT] JWT_SECRET and JWT_REFRESH_SECRET are identical. Use two different random values when possible.'
    );
  }
}

module.exports = {
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  assertJwtEnv,
};
