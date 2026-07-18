import { log } from '../logger.js';

export function notFound(req, res) {
  res.status(404).json({ error: 'Not found', correlationId: req.id });
}

/**
 * Central error handler: full detail (with correlation id) to structured
 * logs, a generic message to clients — 5xx details never leave the server.
 */
export function errorHandler(err, req, res, _next) {
  const status = err.status || (err.message === 'Not allowed by CORS' ? 403 : 500);
  log.error('request failed', {
    cid: req.id,
    method: req.method, path: req.path, status,
    user: req.user?.id || null,
    err: err.message, stack: status >= 500 ? err.stack : undefined,
  });
  res.status(status).json({
    error: status >= 500 ? 'Something went wrong — the team has been notified' : err.message,
    correlationId: req.id,
  });
}
