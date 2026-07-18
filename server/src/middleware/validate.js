/**
 * Small declarative validator — whitelists fields, checks type/shape, strips
 * anything not declared, so handlers only ever see clean input.
 */
const CHECKS = {
  string: v => typeof v === 'string',
  number: v => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))),
  array: v => Array.isArray(v),
};

export function validate(schema) {
  return (req, res, next) => {
    const clean = {};
    const errors = [];
    for (const [field, rule] of Object.entries(schema)) {
      let v = req.body?.[field];
      if (v === undefined || v === null || v === '') {
        if (rule.required) errors.push(`${field} is required`);
        continue;
      }
      if (!CHECKS[rule.type ?? 'string'](v)) { errors.push(`${field} must be a ${rule.type}`); continue; }
      if (rule.type === 'number') v = Number(v);
      if (typeof v === 'string') {
        v = v.trim();
        if (rule.max && v.length > rule.max) { errors.push(`${field} is too long`); continue; }
        if (rule.pattern && !rule.pattern.test(v)) { errors.push(`${field} is not valid`); continue; }
      }
      if (rule.enum && !rule.enum.includes(v)) { errors.push(`${field} must be one of: ${rule.enum.join(', ')}`); continue; }
      clean[field] = v;
    }
    if (errors.length) return res.status(422).json({ error: 'Validation failed', details: errors });
    req.body = clean; // only whitelisted, sanitized fields pass through
    next();
  };
}

export const patterns = {
  mobile: /^[6-9]\d{9}$/,
  tokenNo: /^[A-Z]-\d{1,4}$/i,
  abha: /^[\d-]{14,20}$/,
  username: /^[a-z0-9.]{3,40}$/i,
};
