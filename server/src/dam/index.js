import { config } from '../config.js';
import { log } from '../logger.js';
import { assertImplements } from './contract.js';
import { createMemoryAdapter } from './memoryAdapter.js';
import { createMssqlAdapter } from './mssqlAdapter.js';

/**
 * Adapter registry — one entry per database engine. Adding a new engine
 * (postgres, mysql, mongo…) means: implement every method in contract.js in
 * one new file, register it here, set DB_DRIVER. Nothing above the DAM
 * (routes, services, UI) changes. postgresAdapter.example.js is a documented
 * starting template for the port.
 */
const ADAPTERS = {
  memory: async () => createMemoryAdapter(),
  mssql: async () => createMssqlAdapter(),
  postgres: async () => {
    try {
      const mod = await import('./postgresAdapter.js');
      return mod.createPostgresAdapter();
    } catch (err) {
      if (err.code === 'ERR_MODULE_NOT_FOUND') {
        throw new Error('DB_DRIVER=postgres but dam/postgresAdapter.js does not exist yet — copy postgresAdapter.example.js, implement the contract, and `npm i pg`');
      }
      throw err;
    }
  },
};

let dam;

export async function initDam() {
  const driver = config.dbDriver;
  const factory = ADAPTERS[driver];
  if (!factory) {
    throw new Error(`Unknown DB_DRIVER "${driver}" — known drivers: ${Object.keys(ADAPTERS).join(', ')}`);
  }
  const adapter = await factory();
  assertImplements(adapter, driver);   // fail fast if the adapter misses a contract method
  await adapter.init();
  log.info(`dam: using "${driver}" adapter`);
  dam = adapter;
  return dam;
}

export const getDam = () => {
  if (!dam) throw new Error('DAM not initialised — call initDam() first');
  return dam;
};
