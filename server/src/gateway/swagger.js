import swaggerUi from 'swagger-ui-express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { buildOpenApi } from './openapi.js';
import { getDam } from '../dam/index.js';

/**
 * Protected API documentation.
 *
 * /api-docs and /openapi.json require a valid **admin** JWT. Browsers cannot
 * attach an Authorization header to an address-bar navigation, so the page
 * also accepts ?token=<jwt> (same-origin, short-lived; the admin screen links
 * to it this way). Only generic vendor assets (swagger-ui js/css) are served
 * unauthenticated — the HTML, the init script and the spec itself are gated.
 * Everything is CSP-safe: no inline scripts, all same-origin.
 */
function verifyAdmin(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : (req.query.token || null);
  if (!token) return { status: 401, error: 'API docs require an admin JWT (Bearer header or ?token=)' };
  try {
    const p = jwt.verify(token, config.jwt.secret, { issuer: config.jwt.issuer });
    if (p.typ === 'refresh') throw new Error('refresh token');
    if (p.role !== 'admin') {
      getDam().audit({ actorId: p.sub, action: 'docs.denied', entity: 'docs', entityId: req.path }).catch(() => {});
      return { status: 403, error: 'API docs are restricted to administrators' };
    }
    return { user: { id: p.sub, role: p.role, name: p.name }, token };
  } catch {
    return { status: 401, error: 'Invalid or expired token' };
  }
}

const adminOnly = (req, res, next) => {
  const v = verifyAdmin(req);
  if (v.error) return res.status(v.status).json({ error: v.error, correlationId: req.id });
  req.user = v.user;
  req.docsToken = v.token;
  getDam().audit({ actorId: v.user.id, action: 'docs.view', entity: 'docs', entityId: req.path }).catch(() => {});
  next();
};

const PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MP HMIS API — Documentation</title>
  <link rel="stylesheet" href="./swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="./swagger-ui-bundle.js"></script>
  <script src="./swagger-ui-standalone-preset.js"></script>
  <script src="./init.js__QS__"></script>
</body>
</html>`;

export function mountSwagger(app) {
  let cached = null;
  const spec = () => (cached ??= buildOpenApi());

  const specHandler = (_req, res) => res.json(spec());
  app.get('/openapi.json', adminOnly, specHandler);
  app.get('/api/openapi.json', adminOnly, specHandler); // alias behind the /api proxy

  // canonical UI lives at /api-docs/ (trailing slash keeps relative asset URLs working)
  const qs = req => (req.query.token ? `?token=${encodeURIComponent(req.query.token)}` : '');
  app.get('/api/docs', (req, res) => res.redirect(`/api-docs/${qs(req)}`));

  // the documentation page (gated); /api-docs without the slash redirects to it
  app.get('/api-docs', adminOnly, (req, res) => {
    if (!req.originalUrl.split('?')[0].endsWith('/')) return res.redirect(`/api-docs/${qs(req)}`);
    res.type('html').send(PAGE.replace('__QS__', qs(req)));
  });

  // the init script (gated) — embeds the token into the spec URL, no inline JS needed
  app.get('/api-docs/init.js', adminOnly, (req, res) => {
    const specUrl = `/openapi.json${qs(req)}`;
    res.type('application/javascript').send(
      `window.ui = SwaggerUIBundle({
        url: ${JSON.stringify(specUrl)},
        dom_id: '#swagger-ui',
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: 'StandaloneLayout',
        persistAuthorization: true,
        displayRequestDuration: true,
      });`,
    );
  });

  // generic vendor assets (js/css/fonts) — public, they contain nothing sensitive
  app.use('/api-docs', swaggerUi.serve);
}
