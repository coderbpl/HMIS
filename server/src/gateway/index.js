import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { correlationId, sanitize, accessLog } from './context.js';
import { mountSwagger } from './swagger.js';
import { notFound, errorHandler } from '../middleware/errors.js';

import authRoutes from '../routes/auth.routes.js';
import publicRoutes from '../routes/public.routes.js';
import patientRoutes from '../routes/patient.routes.js';
import queueRoutes from '../routes/queue.routes.js';
import consultRoutes from '../routes/consult.routes.js';
import medicinesRoutes from '../routes/medicines.routes.js';
import templatesRoutes from '../routes/templates.routes.js';
import pharmacyRoutes from '../routes/pharmacy.routes.js';
import adminRoutes from '../routes/admin.routes.js';

/**
 * The API Gateway — the single entry point for every request.
 *
 * Service routers have no listener of their own and are only reachable
 * through this pipeline, so nothing bypasses authentication, authorization,
 * validation, rate limiting or logging. In a multi-process future, internal
 * services bind to 127.0.0.1 and this gateway proxies to them; the pipeline
 * below stays identical.
 *
 * Pipeline order (every request):
 *   correlation id → security headers → CORS allowlist → body limit →
 *   sanitization → rate limit → access log → route (JWT → permission →
 *   Zod validation → handler) → central error handler
 *
 * Public exceptions: POST /api/auth/login, POST /api/auth/refresh,
 * GET /api/health, and the masked patient-portal endpoints under /api/public.
 * API docs (/api-docs, /openapi.json) require an admin JWT.
 */
export function buildGateway() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind nginx/ALB; enables real client IPs for rate limits

  app.use(correlationId);
  app.use(helmet());
  app.use(cors({
    origin(origin, cb) {
      if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
      cb(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    exposedHeaders: ['x-correlation-id'],
  }));
  app.use(express.json({ limit: '64kb' }));
  app.use(sanitize);
  app.use(rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));
  app.use(accessLog);

  // Health check — public by design (load balancers and uptime probes).
  app.get('/api/health', (_req, res) => res.json({ ok: true, driver: config.dbDriver }));

  // Protected API documentation (admin JWT only).
  mountSwagger(app);

  // Services — reachable only through this gateway.
  app.use(authRoutes);
  app.use(publicRoutes);
  app.use(patientRoutes);
  app.use(queueRoutes);
  app.use(consultRoutes);
  app.use(medicinesRoutes);
  app.use(templatesRoutes);
  app.use(pharmacyRoutes);
  app.use(adminRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
