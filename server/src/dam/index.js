import { config } from '../config.js';
import { log } from '../logger.js';
import { assertImplements } from './contract.js';
import { createMemoryAdapter } from './memoryAdapter.js';
import { createMssqlAdapter } from './mssqlAdapter.js';

let dam;

export async function initDam() {
  const driver = config.dbDriver;
  const adapter = driver === 'mssql' ? createMssqlAdapter() : createMemoryAdapter();
  assertImplements(adapter, driver);
  await adapter.init();
  log.info(`dam: using "${driver}" adapter`);
  dam = adapter;
  return dam;
}

export const getDam = () => {
  if (!dam) throw new Error('DAM not initialised — call initDam() first');
  return dam;
};
