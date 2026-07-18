import { randomUUID } from 'node:crypto';
import { log } from '../logger.js';

/**
 * Request context: correlation IDs, sanitization, and the gateway access log.
 * Every request that enters the gateway gets an id that follows it through
 * logs, audit entries and error responses.
 */

export function correlationId(req, res, next) {
  const incoming = req.headers['x-correlation-id'];
  req.id = (typeof incoming === 'string' && /^[\w-]{8,64}$/.test(incoming)) ? incoming : randomUUID();
  req.startedAt = process.hrtime.bigint();
  res.set('x-correlation-id', req.id);
  next();
}

const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g; // strip control chars, keep \t \n \r
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function deepSanitize(value, depth = 0) {
  if (depth > 6 || value === null) return value;
  if (typeof value === 'string') return value.replace(CONTROL_CHARS, '').slice(0, 10000);
  if (Array.isArray(value)) return value.slice(0, 200).map(v => deepSanitize(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(k)) continue; // prototype-pollution guard
      out[k] = deepSanitize(v, depth + 1);
    }
    return out;
  }
  return value;
}

/** Strips control characters, over-long strings and prototype-pollution keys. */
export function sanitize(req, _res, next) {
  if (req.body && typeof req.body === 'object') req.body = deepSanitize(req.body);
  next();
}

/** Structured access log emitted when each response finishes. */
export function accessLog(req, res, next) {
  res.on('finish', () => {
    // Long-lived SSE streams log on disconnect; everything else on completion.
    const ms = Number(process.hrtime.bigint() - req.startedAt) / 1e6;
    log.info('access', {
      cid: req.id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Math.round(ms * 10) / 10,
      user: req.user?.id || null,
      role: req.user?.role || null,
      ip: req.ip,
    });
  });
  next();
}
