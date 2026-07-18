import { readFileSync } from 'node:fs';
import https from 'node:https';
import { config } from './config.js';
import { log } from './logger.js';
import { initDam } from './dam/index.js';
import { initCache } from './cache.js';
import { buildApp } from './app.js';

const main = async () => {
  await initCache();
  await initDam();
  const app = buildApp();

  // HTTPS directly when certs are configured; otherwise HTTP behind a
  // TLS-terminating proxy (nginx/ALB) — helmet still sends HSTS either way.
  if (config.tls.keyFile && config.tls.certFile) {
    const options = { key: readFileSync(config.tls.keyFile), cert: readFileSync(config.tls.certFile) };
    https.createServer(options, app).listen(config.port, () => {
      log.info(`hmis-gateway listening on https://:${config.port}`, { env: config.env, driver: config.dbDriver });
    });
  } else {
    app.listen(config.port, () => {
      log.info(`hmis-gateway listening on :${config.port}`, { env: config.env, driver: config.dbDriver });
    });
  }
};

main().catch(err => {
  log.error('fatal on startup', { err: err.message });
  process.exit(1);
});
