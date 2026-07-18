import 'dotenv/config';

const required = (name, fallback, { devOnlyFallback = false } = {}) => {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var ${name}`);
  if (devOnlyFallback && process.env.NODE_ENV === 'production' && v === fallback) {
    throw new Error(`${name} must be set explicitly in production`);
  }
  return v;
};

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),

  // 'memory' runs without any database; 'mssql' uses stored-procedure calls.
  dbDriver: process.env.DB_DRIVER || 'memory',

  mssql: {
    server: process.env.MSSQL_SERVER || 'localhost',
    port: Number(process.env.MSSQL_PORT || 1433),
    database: process.env.MSSQL_DATABASE || 'HMIS',
    user: process.env.MSSQL_USER,
    password: process.env.MSSQL_PASSWORD,
    options: {
      encrypt: process.env.MSSQL_ENCRYPT !== 'false',
      trustServerCertificate: process.env.MSSQL_TRUST_CERT === 'true',
    },
    pool: { max: 10, min: 1, idleTimeoutMillis: 30000 },
  },

  redisUrl: process.env.REDIS_URL || '', // optional; memory cache used when empty

  jwt: {
    secret: required('JWT_SECRET', 'dev-only-secret-change-me', { devOnlyFallback: true }),
    expiresIn: process.env.JWT_EXPIRES_IN || '30m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    issuer: 'hmis-api',
  },

  // Optional direct TLS (production usually terminates TLS at nginx/ALB instead).
  tls: {
    keyFile: process.env.TLS_KEY_FILE || '',
    certFile: process.env.TLS_CERT_FILE || '',
  },

  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(s => s.trim()),

  // Demo seed password for the built-in users. Never reused in production.
  seedPassword: process.env.SEED_PASSWORD || 'Demo@1234',
};
