import { resolve } from 'node:path';

export function validateEnvironment(env: Record<string, unknown>) {
  for (const key of ['DATABASE_URL', 'JWT_SECRET', 'PUBLIC_BASE_URL']) {
    if (typeof env[key] !== 'string' || !env[key].trim())
      throw new Error(`${key} is required`);
  }
  const url = new URL(String(env.PUBLIC_BASE_URL));
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.search ||
    url.hash ||
    url.username ||
    url.password ||
    url.pathname !== '/'
  ) {
    throw new Error('PUBLIC_BASE_URL must be an HTTP(S) origin');
  }
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('PORT must be between 1 and 65535');
  const cleanupEnabled = env.UPLOAD_CLEANUP_ENABLED ?? 'true';
  if (
    cleanupEnabled !== 'true' &&
    cleanupEnabled !== 'false' &&
    cleanupEnabled !== true &&
    cleanupEnabled !== false
  )
    throw new Error('UPLOAD_CLEANUP_ENABLED must be true or false');
  const cleanupInterval = Number(env.UPLOAD_CLEANUP_INTERVAL_HOURS ?? 1);
  const cleanupGrace = Number(env.UPLOAD_CLEANUP_GRACE_HOURS ?? 24);
  if (
    !Number.isFinite(cleanupInterval) ||
    cleanupInterval < 1 ||
    cleanupInterval > 168
  )
    throw new Error('UPLOAD_CLEANUP_INTERVAL_HOURS must be between 1 and 168');
  if (!Number.isFinite(cleanupGrace) || cleanupGrace < 1 || cleanupGrace > 8760)
    throw new Error('UPLOAD_CLEANUP_GRACE_HOURS must be between 1 and 8760');
  return {
    ...env,
    UPLOAD_CLEANUP_ENABLED:
      cleanupEnabled === 'true' || cleanupEnabled === true,
    UPLOAD_CLEANUP_INTERVAL_HOURS: cleanupInterval,
    UPLOAD_CLEANUP_GRACE_HOURS: cleanupGrace,
    PORT: port,
    PUBLIC_BASE_URL: url.origin,
    UPLOAD_DIR: resolve(
      typeof env.UPLOAD_DIR === 'string' && env.UPLOAD_DIR
        ? env.UPLOAD_DIR
        : 'uploads',
    ),
  };
}
