import { buildGateway } from './gateway/index.js';

/** All requests pass through the API gateway — see src/gateway/index.js. */
export const buildApp = buildGateway;
