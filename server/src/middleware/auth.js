/**
 * Compatibility shim — auth now lives in the gateway (src/gateway/authz.js).
 * New code should import from there; `authorize` maps to the RBAC role gate.
 */
export { authenticate, requireRole as authorize, signAccessToken as signToken } from '../gateway/authz.js';
