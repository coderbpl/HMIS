import { Router } from 'express';
import { authenticate, requirePerm } from './authz.js';

/**
 * Gateway route registry.
 *
 * Every API is declared once with `route(def)`: the same definition wires the
 * express handler, JWT + permission middleware, Zod validation — and feeds the
 * OpenAPI generator. An endpoint that isn't declared here doesn't exist, which
 * is what makes the docs complete by construction.
 */
export const REGISTRY = [];

const zodDetails = err => err.issues.map(i => `${i.path.join('.') || 'body'}: ${i.message}`);

const validateWith = (schema, source) => (req, res, next) => {
  const parsed = schema.safeParse(req[source]);
  if (!parsed.success) {
    return res.status(422).json({
      error: 'Validation failed',
      details: zodDetails(parsed.error),
      correlationId: req.id,
    });
  }
  if (source === 'query') Object.assign(req.query, parsed.data);
  else req[source] = parsed.data; // only whitelisted, coerced fields pass through
  next();
};

export function createGatewayRouter(basePath, tag) {
  const router = Router();

  /**
   * def = {
   *   method, path, summary, description?,
   *   auth: false | { perm: 'patients:read' } | { authenticated: true },
   *   body?, query?, params?  — Zod schemas,
   *   middleware?: [extra middleware after auth, before validation],
   *   responses: { [status]: { description, schemaRef?, example? } },
   *   produces?: 'text/event-stream',
   *   handler(req, res, next)
   * }
   */
  const route = (def) => {
    const chain = [];
    if (def.auth !== false) {
      chain.push(authenticate);
      if (def.auth?.perm) chain.push(requirePerm(def.auth.perm));
    }
    if (def.middleware) chain.push(...def.middleware);
    if (def.params) chain.push(validateWith(def.params, 'params'));
    if (def.query) chain.push(validateWith(def.query, 'query'));
    if (def.body) chain.push(validateWith(def.body, 'body'));

    const wrapped = async (req, res, next) => {
      try { await def.handler(req, res, next); } catch (err) { next(err); }
    };

    const fullPath = `${basePath}${def.path}`.replace(/\/$/, '') || basePath;
    router[def.method](fullPath, ...chain, wrapped);
    REGISTRY.push({ ...def, basePath, tag, fullPath });
  };

  return { router, route };
}
