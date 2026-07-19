import jwt from 'jsonwebtoken';
import { config } from '../config.js';

/**
 * Gateway authorization: JWT authentication, RBAC and permission-based access.
 *
 * RBAC alone answers "is this a doctor?"; permissions answer "may this
 * identity call queue:call?". Roles map to permission sets here, so a future
 * per-user permission override (or a Permissions table) slots in without
 * touching any route: routes only ever declare the permission they need.
 */
export const ROLE_PERMS = {
  doctor: [
    'patients:read', 'queue:read', 'queue:call', 'vitals:write',
    'consults:write', 'medicines:read', 'medicines:quick',
    'templates:read', 'templates:write',
  ],
  nurse: ['patients:read', 'queue:read', 'queue:call', 'vitals:write'],
  reception: ['patients:read', 'patients:register', 'tokens:issue', 'queue:read'],
  pharmacy: ['medicines:read', 'pharmacy:read', 'pharmacy:dispense'],
  admin: ['*'], // full access, including reports:read and docs:read
};

export const hasPerm = (role, perm) => {
  const set = ROLE_PERMS[role] || [];
  return set.includes('*') || set.includes(perm);
};

const bearer = req => {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
};

/** Verifies the access JWT and attaches { id, role, name } to req.user. */
export function authenticate(req, res, next) {
  const token = bearer(req);
  if (!token) return res.status(401).json({ error: 'Authentication required', correlationId: req.id });
  try {
    const p = jwt.verify(token, config.jwt.secret, { issuer: config.jwt.issuer });
    if (p.typ === 'refresh') throw new Error('refresh token used as access token');
    req.user = { id: p.sub, role: p.role, name: p.name, facilityCode: p.fac || null };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session', correlationId: req.id });
  }
}

/** Permission gate — use after authenticate. */
export const requirePerm = perm => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required', correlationId: req.id });
  if (!hasPerm(req.user.role, perm)) {
    return res.status(403).json({ error: `Missing permission: ${perm}`, correlationId: req.id });
  }
  next();
};

/** Plain role gate (RBAC), for the rare case a permission doesn't fit. */
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required', correlationId: req.id });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient role for this action', correlationId: req.id });
  }
  next();
};

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.name, fac: user.facilityCode || null },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn, issuer: config.jwt.issuer },
  );
}

export function signRefreshToken(user) {
  return jwt.sign(
    { sub: user.id, typ: 'refresh' },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshExpiresIn, issuer: config.jwt.issuer },
  );
}

/** Returns the user id from a valid refresh token, or null. */
export function verifyRefreshToken(token) {
  try {
    const p = jwt.verify(token, config.jwt.secret, { issuer: config.jwt.issuer });
    return p.typ === 'refresh' ? p.sub : null;
  } catch {
    return null;
  }
}
