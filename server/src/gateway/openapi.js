import { z } from 'zod';
import { REGISTRY } from './registry.js';
import { COMPONENTS } from './schemas.js';
import { ROLE_PERMS } from './authz.js';

/**
 * OpenAPI 3.0 generator. The document is derived entirely from the gateway
 * registry — the same Zod schemas that validate requests produce the schema
 * objects here, so docs and enforcement can never drift apart.
 */

function toSchema(zodSchema) {
  if (!zodSchema) return undefined;
  try {
    return z.toJSONSchema(zodSchema, { target: 'openapi-3.0', io: 'input' });
  } catch {
    try {
      const s = z.toJSONSchema(zodSchema);
      delete s.$schema;
      return s;
    } catch {
      return { type: 'object' };
    }
  }
}

const ref = name => ({ $ref: `#/components/schemas/${name}` });

function responseEntry(status, def) {
  const out = { description: def.description || '' };
  const schema = def.schemaRef ? ref(def.schemaRef) : def.schema ? toSchema(def.schema) : undefined;
  if (schema || def.example !== undefined) {
    out.content = {
      'application/json': {
        ...(schema ? { schema } : {}),
        ...(def.example !== undefined ? { example: def.example } : {}),
      },
    };
  }
  return out;
}

const STD_ERRORS = {
  401: { description: 'Missing or invalid JWT', schemaRef: 'Error', example: { error: 'Authentication required', correlationId: 'a1b2c3d4-…' } },
  403: { description: 'Authenticated but lacking the required permission', schemaRef: 'Error', example: { error: 'Missing permission: patients:register' } },
  422: { description: 'Request failed validation', schemaRef: 'Error', example: { error: 'Validation failed', details: ['mobile: must be a valid 10-digit Indian mobile number'] } },
  429: { description: 'Rate limit exceeded', schemaRef: 'Error', example: { error: 'Too many requests' } },
};

function parameters(def) {
  const out = [];
  for (const [where, schema] of [['path', def.params], ['query', def.query]]) {
    if (!schema) continue;
    const json = toSchema(schema);
    for (const [name, prop] of Object.entries(json.properties || {})) {
      out.push({
        name, in: where,
        required: where === 'path' ? true : (json.required || []).includes(name),
        schema: prop,
        ...(prop.description ? { description: prop.description } : {}),
      });
    }
  }
  return out;
}

export function buildOpenApi() {
  const paths = {};
  const tags = new Map();

  for (const def of REGISTRY) {
    tags.set(def.tag, { name: def.tag });
    const oaPath = def.fullPath.replace(/:([A-Za-z_]+)/g, '{$1}');
    paths[oaPath] = paths[oaPath] || {};

    const op = {
      tags: [def.tag],
      summary: def.summary,
      ...(def.description ? { description: def.description } : {}),
      operationId: `${def.method}_${oaPath.replace(/[^A-Za-z0-9]+/g, '_')}`.replace(/_+$/, ''),
      responses: {},
    };

    if (def.auth === false) {
      op.security = []; // overrides the global bearer requirement
    } else if (def.auth?.perm) {
      const roles = Object.entries(ROLE_PERMS)
        .filter(([, perms]) => perms.includes('*') || perms.includes(def.auth.perm))
        .map(([role]) => role);
      op.description = `${op.description ? op.description + '\n\n' : ''}**Requires permission** \`${def.auth.perm}\` (roles: ${roles.join(', ')}).`;
      op.responses[401] = responseEntry(401, STD_ERRORS[401]);
      op.responses[403] = responseEntry(403, STD_ERRORS[403]);
    } else if (def.auth !== false) {
      op.responses[401] = responseEntry(401, STD_ERRORS[401]);
    }

    const params = parameters(def);
    if (params.length) op.parameters = params;

    if (def.body) {
      op.requestBody = {
        required: true,
        content: { 'application/json': { schema: toSchema(def.body), ...(def.bodyExample ? { example: def.bodyExample } : {}) } },
      };
      op.responses[422] = responseEntry(422, STD_ERRORS[422]);
    }

    for (const [status, r] of Object.entries(def.responses || {})) {
      op.responses[status] = def.produces === 'text/event-stream' && status === '200'
        ? { description: r.description, content: { 'text/event-stream': { schema: { type: 'string' }, example: r.example } } }
        : responseEntry(status, r);
    }
    if (!Object.keys(op.responses).length) op.responses[200] = { description: 'OK' };

    paths[oaPath][def.method] = op;
  }

  const schemas = {};
  for (const [name, schema] of Object.entries(COMPONENTS)) schemas[name] = toSchema(schema);

  return {
    openapi: '3.0.3',
    info: {
      title: 'MP HMIS API',
      version: '1.0.0',
      description:
        'Hospital Management Information System API. All traffic passes through the API gateway: '
        + 'JWT bearer authentication, role/permission-based authorization, request validation, '
        + 'rate limiting and audit logging are enforced centrally. '
        + 'Public endpoints: login, token refresh, health check, and the privacy-masked patient queue.',
      contact: { name: 'HMIS Platform Team' },
    },
    servers: [{ url: '/', description: 'This gateway' }],
    tags: [...tags.values()],
    security: [{ bearerAuth: [] }], // global default — public routes override with security: []
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http', scheme: 'bearer', bearerFormat: 'JWT',
          description: 'Access token from POST /api/auth/login (expires in 30 min; renew via /api/auth/refresh).',
        },
      },
      schemas,
    },
    paths,
  };
}
