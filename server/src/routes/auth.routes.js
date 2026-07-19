import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDam } from '../dam/index.js';
import { createGatewayRouter } from '../gateway/registry.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../gateway/authz.js';
import { patterns } from '../gateway/schemas.js';

const { router, route } = createGatewayRouter('/api/auth', 'Authentication');

// Brute-force protection: 10 attempts / 15 min per IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many login attempts — try again later' },
});

const issueTokens = user => ({
  token: signAccessToken(user), // legacy alias
  accessToken: signAccessToken(user),
  refreshToken: signRefreshToken(user),
  user: { id: user.id, name: user.name, role: user.role },
});

route({
  method: 'post', path: '/login',
  summary: 'Sign in with username and password',
  description: 'Returns a 30-minute access JWT and a 7-day refresh JWT. Response is identical for unknown user and wrong password (no user enumeration).',
  auth: false,
  middleware: [loginLimiter],
  body: z.object({
    username: z.string().regex(patterns.username, 'letters, digits and dots only'),
    password: z.string().min(1).max(128),
  }),
  bodyExample: { username: 'dr.ravi', password: 'Demo@1234' },
  responses: {
    200: { description: 'Authenticated', schemaRef: 'AuthTokens' },
    401: { description: 'Bad credentials', schemaRef: 'Error', example: { error: 'Invalid username or password' } },
    429: { description: 'Too many attempts', schemaRef: 'Error' },
  },
  handler: async (req, res) => {
    const { username, password } = req.body;
    const user = await getDam().getUserByUsername(username.toLowerCase());
    const hash = user?.passHash || '$2a$10$invalidinvalidinvalidinvalidinvalidinva';
    const ok = await bcrypt.compare(password, hash);
    if (!user || !ok) return res.status(401).json({ error: 'Invalid username or password', correlationId: req.id });
    await getDam().audit({ actorId: user.id, action: 'auth.login', entity: 'user', entityId: user.id });
    res.json(issueTokens(user));
  },
});

route({
  method: 'post', path: '/refresh',
  summary: 'Exchange a refresh token for a new token pair',
  description: 'Access tokens live 30 minutes; call this with the refresh token to stay signed in. Role changes take effect here because the user is re-read from the database.',
  auth: false,
  body: z.object({ refreshToken: z.string().min(20) }),
  responses: {
    200: { description: 'New token pair', schemaRef: 'AuthTokens' },
    401: { description: 'Refresh token invalid or expired', schemaRef: 'Error' },
  },
  handler: async (req, res) => {
    const userId = verifyRefreshToken(req.body.refreshToken);
    if (!userId) return res.status(401).json({ error: 'Invalid or expired refresh token', correlationId: req.id });
    // re-read the user so disabled accounts / role changes take effect
    const user = await getDam().getUserById(userId);
    if (!user) return res.status(401).json({ error: 'Account no longer active', correlationId: req.id });
    await getDam().audit({ actorId: user.id, action: 'auth.refresh', entity: 'user', entityId: user.id });
    res.json(issueTokens(user));
  },
});

route({
  method: 'get', path: '/me',
  summary: 'Current authenticated identity',
  auth: { authenticated: true },
  responses: { 200: { description: 'The caller', schemaRef: 'User', example: { id: 'U-1', name: 'Dr. Ravi Verma', role: 'doctor' } } },
  handler: async (req, res) => res.json(req.user),
});

export default router;
