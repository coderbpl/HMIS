import { createHash, randomInt } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getDam } from '../dam/index.js';
import { getCache } from '../cache.js';
import { createGatewayRouter } from '../gateway/registry.js';
import { fields } from '../gateway/schemas.js';
import { bus, emitQueueChange } from '../events.js';
import { log } from '../logger.js';

/**
 * Patient-facing endpoints. Deliberately unauthenticated but hardened:
 * masked queue data only, paired-identifier lookups, aggressive rate limits,
 * and short-TTL caching to absorb waiting-room polling.
 */
const { router, route } = createGatewayRouter('/api/public', 'Public & Patient Portal');

const boardLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });
const trackLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many lookups — try again in a few minutes' } });
const selfLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many token requests — please use the registration counter' } });
const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 6, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many OTP requests — try again in a few minutes' } });

/* ---------- OTP (mobile ownership proof for self-service) ----------
 * The code is stored hashed in the cache (Redis in production, in-process in
 * dev) with a 5-minute TTL, 60-second resend cooldown per mobile, 5 verify
 * attempts, single use. Verified mobiles get a 10-minute grace window so a
 * form validation error doesn't burn a fresh SMS.
 * SMS dispatch is pluggable: without SMS_API_KEY the code is returned in the
 * response marked demo:true (and logged) so the flow stays testable.       */
const OTP_TTL = 300, OTP_COOLDOWN = 60, OTP_GRACE = 600, OTP_MAX_TRIES = 5;
const otpHash = (mobile, code) => createHash('sha256').update(`${mobile}:${code}`).digest('hex');

async function verifyOtp(mobile, otp) {
  const cache = getCache();
  if (await cache.get(`otpok:${mobile}`)) return { ok: true };          // grace window
  const raw = await cache.get(`otp:${mobile}`);
  if (!raw) return { ok: false, error: 'OTP expired or not requested — tap "Send OTP" first' };
  const rec = JSON.parse(raw);
  if (rec.tries >= OTP_MAX_TRIES) {
    await cache.del(`otp:${mobile}`);
    return { ok: false, error: 'Too many wrong attempts — request a new OTP' };
  }
  if (!otp || otpHash(mobile, otp) !== rec.h) {
    rec.tries += 1;
    await cache.set(`otp:${mobile}`, JSON.stringify(rec), OTP_TTL);
    return { ok: false, error: 'Incorrect OTP — check the SMS and try again' };
  }
  await cache.del(`otp:${mobile}`);                                     // single use
  await cache.set(`otpok:${mobile}`, '1', OTP_GRACE);
  return { ok: true };
}

route({
  method: 'get', path: '/queue',
  summary: 'Masked live queue board',
  description: 'Names are privacy-masked (initials only); no identifiers or clinical data leave the server. Cached for 3 seconds.',
  auth: false,
  middleware: [boardLimiter],
  query: z.object({ dept: z.string().max(60).optional() }),
  responses: { 200: { description: 'The board', schemaRef: 'PublicBoard', example: { dept: 'General Medicine', nowServing: 'A-15', rows: [{ tokenNo: 'A-15', status: 'in-consult', priority: 'urgent', patient: 'A***n M.' }] } } },
  handler: async (req, res) => {
    const dept = req.query.dept || null;
    const cacheKey = `pubqueue:${dept}`;
    const cached = await getCache().get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));
    const board = await getDam().getPublicQueue(dept);
    await getCache().set(cacheKey, JSON.stringify(board), 3);
    res.json(board);
  },
});

route({
  method: 'get', path: '/queue/stream',
  summary: 'Server-Sent Events push of the masked board',
  description: 'Emits the board immediately, then again on every queue change, with a heartbeat comment every 25 s. EventSource clients reconnect automatically.',
  auth: false,
  produces: 'text/event-stream',
  query: z.object({ dept: z.string().max(60).optional() }),
  responses: { 200: { description: 'SSE stream of PublicBoard JSON frames', example: 'data: {"dept":"General Medicine","nowServing":"A-15","rows":[…]}\n\n' } },
  handler: async (req, res) => {
    const dept = req.query.dept || null;
    res.set({
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    res.flushHeaders();

    let closed = false;
    const push = async () => {
      if (closed) return;
      try {
        const board = await getDam().getPublicQueue(dept);
        res.write(`data: ${JSON.stringify(board)}\n\n`);
      } catch { /* transient — next event retries */ }
    };
    await push();
    const onChange = changedDept => { if (!dept || !changedDept || changedDept === dept) push(); };
    bus.on('queue-changed', onChange);
    const heartbeat = setInterval(() => { if (!closed) res.write(': hb\n\n'); }, 25000);
    req.on('close', () => { closed = true; bus.off('queue-changed', onChange); clearInterval(heartbeat); });
  },
});

route({
  method: 'get', path: '/departments',
  summary: 'List departments and token series',
  auth: false,
  middleware: [boardLimiter],
  responses: { 200: { description: 'Departments', example: [{ code: 'GM', name: 'General Medicine', series: 'A' }] } },
  handler: async (_req, res) => res.json(await getDam().listDepartments()),
});

route({
  method: 'get', path: '/symptoms',
  summary: 'Symptom picker with department routing',
  description: 'Patients tap symptoms, not departments — each symptom maps to the department that treats it, and the tapped symptoms become the presenting complaint.',
  auth: false,
  middleware: [boardLimiter],
  responses: { 200: { description: 'Symptoms', example: [{ code: 'bone', en: 'Bone / joint pain', hin: 'हड्डी / जोड़ दर्द', dept: 'Orthopedics' }] } },
  handler: async (_req, res) => res.json(await getDam().listSymptoms()),
});

route({
  method: 'get', path: '/slots',
  summary: 'Advance-booking slot availability',
  description: 'Fixed OPD half-hour slots with remaining capacity for a department and date. Same-day visits do not use slots — the token is the slot.',
  auth: false,
  middleware: [boardLimiter],
  query: z.object({
    dept: fields.dept,
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD'),
  }),
  responses: { 200: { description: 'Slots', example: [{ time: '10:30', free: 4, past: false }] } },
  handler: async (req, res) => res.json(await getDam().listSlots(req.query.dept, req.query.date)),
});

route({
  method: 'post', path: '/check-in',
  summary: 'Arrival check-in (kiosk / QR)',
  description: 'Activates a booked token: booked → waiting, joining the live queue. Requires mobile + token number together. Unclaimed bookings lapse 60 minutes past their slot or issue time.',
  auth: false,
  middleware: [trackLimiter],
  body: z.object({ mobile: fields.mobile, tokenNo: fields.tokenNo }),
  bodyExample: { mobile: '9891234567', tokenNo: 'B-01' },
  responses: {
    200: { description: 'Checked in — now waiting', example: { tokenNo: 'B-01', status: 'waiting', dept: 'Pediatrics' } },
    403: { description: 'Mobile does not match', schemaRef: 'Error' },
    404: { description: 'No booked token for today (or it lapsed)', schemaRef: 'Error' },
  },
  handler: async (req, res) => {
    const token = await getDam().checkInToken(req.body, null);
    await getCache().del(`pubqueue:${token.dept}`);
    await getCache().del('pubqueue:null');
    emitQueueChange(token.dept);
    res.json({ tokenNo: token.tokenNo, status: token.status, dept: token.dept });
  },
});

route({
  method: 'post', path: '/prepone',
  summary: 'Move a future booking to today',
  description: "Plans changed — the patient came early. Cancels the advance booking and issues a fresh token in today's series for the same department. Requires mobile + token number together. The new token follows the normal self-service flow (check in on arrival).",
  auth: false,
  middleware: [trackLimiter],
  body: z.object({ mobile: fields.mobile, tokenNo: fields.tokenNo }),
  bodyExample: { mobile: '9891234567', tokenNo: 'B-03' },
  responses: {
    200: { description: "Rebooked into today's queue", example: { tokenNo: 'B-05', dept: 'Pediatrics', status: 'booked', date: '2026-07-19' } },
    403: { description: 'Mobile does not match the booking', schemaRef: 'Error' },
    404: { description: 'No upcoming booking with that number', schemaRef: 'Error' },
    409: { description: 'Already holds a token for today', schemaRef: 'Error' },
  },
  handler: async (req, res) => {
    const token = await getDam().preponeToken(req.body);
    await getCache().del(`pubqueue:${token.dept}`);
    await getCache().del('pubqueue:null');
    emitQueueChange(token.dept);
    res.json({ tokenNo: token.tokenNo, dept: token.dept, status: token.status, date: token.date, slot: token.slot || null });
  },
});

route({
  method: 'post', path: '/track',
  summary: 'Track my token (mobile + token number)',
  description: 'Both identifiers must match the record — a token number alone reveals nothing. POST body, never URL parameters, so no PHI lands in access logs.',
  auth: false,
  middleware: [trackLimiter],
  body: z.object({ mobile: fields.mobile, tokenNo: fields.tokenNo }),
  bodyExample: { mobile: '9800000003', tokenNo: 'A-15' },
  responses: {
    200: { description: 'Position and status', schemaRef: 'TrackInfo', example: { tokenNo: 'A-15', dept: 'General Medicine', status: 'waiting', patientFirstName: 'Arjun', position: 1, nowServing: 'A-14', estWaitMin: 8, vitalsDone: true } },
    404: { description: 'No matching token today', schemaRef: 'Error' },
  },
  handler: async (req, res) => {
    const info = await getDam().trackToken(req.body);
    if (!info) return res.status(404).json({ error: 'No matching token for today — check the number and mobile', correlationId: req.id });
    res.json(info);
  },
});

route({
  method: 'post', path: '/my-tokens',
  summary: 'Recover active tokens by mobile number',
  description: 'The "I closed the browser / lost my token number" path. Mobile alone is never enough — a verified OTP (or its 10-minute grace window) is required, so nobody can enumerate other people\'s visits. Returns every live token for that mobile, today and upcoming.',
  auth: false,
  middleware: [trackLimiter],
  body: z.object({
    mobile: fields.mobile,
    otp: z.string().regex(/^\d{6}$/, 'must be the 6-digit code').optional(),
  }),
  bodyExample: { mobile: '9891234567', otp: '123456' },
  responses: {
    200: { description: 'Active tokens for this mobile', example: { tokens: [{ tokenNo: 'B-01', dept: 'Pediatrics', date: '2026-07-17', slot: null, status: 'waiting' }] } },
    401: { description: 'OTP missing, wrong, or expired', schemaRef: 'Error' },
  },
  handler: async (req, res) => {
    const { mobile, otp } = req.body;
    const check = await verifyOtp(mobile, otp);
    if (!check.ok) return res.status(401).json({ error: check.error, correlationId: req.id });
    const tokens = await getDam().listTokensByMobile(mobile);
    res.json({ tokens });
  },
});

route({
  method: 'post', path: '/otp/request',
  summary: 'Send a one-time code to a mobile number',
  description: 'Proves phone ownership before self-service token generation. 6-digit code, 5-minute validity, 60-second resend cooldown, 5 verify attempts, single use. Without an SMS gateway configured (SMS_API_KEY), the code is returned in the response as demo:true.',
  auth: false,
  middleware: [otpLimiter],
  body: z.object({ mobile: fields.mobile }),
  bodyExample: { mobile: '9891234567' },
  responses: {
    200: { description: 'Code sent (or returned in demo mode)', example: { sent: true, ttlSeconds: 300, demo: true, demoCode: '123456' } },
    429: { description: 'Resend cooldown or rate limit', schemaRef: 'Error' },
  },
  handler: async (req, res) => {
    const { mobile } = req.body;
    const cache = getCache();
    if (await cache.get(`otpcool:${mobile}`)) {
      return res.status(429).json({ error: 'Please wait a minute before requesting another OTP', correlationId: req.id });
    }
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    await cache.set(`otp:${mobile}`, JSON.stringify({ h: otpHash(mobile, code), tries: 0 }), OTP_TTL);
    await cache.set(`otpcool:${mobile}`, '1', OTP_COOLDOWN);
    await cache.del(`otpok:${mobile}`);

    const smsConfigured = !!process.env.SMS_API_KEY;
    if (smsConfigured) {
      // plug the SMS provider here (MSG91 / AWS SNS / gov gateway)
      log.info('otp: dispatched via SMS', { mobile: mobile.slice(0, 2) + '******' + mobile.slice(-2) });
      return res.json({ sent: true, ttlSeconds: OTP_TTL });
    }
    log.warn('otp: demo mode (no SMS_API_KEY) — code returned in response', { mobile: mobile.slice(0, 2) + '******' + mobile.slice(-2) });
    res.json({ sent: true, ttlSeconds: OTP_TTL, demo: true, demoCode: code });
  },
});

route({
  method: 'post', path: '/self-token',
  summary: 'Patient self-service token (ABHA or mobile)',
  description: 'With ABHA: the ABHA number and registered mobile must both match. Without ABHA: the mobile finds returning patients; first-timers supply name/age/sex/department and are registered on the spot. One open token per patient per day — repeat requests return the existing token.',
  auth: false,
  middleware: [selfLimiter],
  body: z.object({
    mobile: fields.mobile,
    otp: z.string().regex(/^\d{6}$/, 'must be the 6-digit code').optional(),
    abha: fields.abha.optional(),
    name: z.string().min(2).max(120).optional(),
    age: fields.age.optional(),
    sex: fields.sex.optional(),
    dept: fields.dept.optional(),
    symptoms: z.array(z.string().max(20)).max(4).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    slot: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  }),
  bodyExample: { mobile: '9891234567', otp: '123456', name: 'Savitri Devi', age: 42, sex: 'F', symptoms: ['child'] },
  responses: {
    201: { description: 'Token issued', example: { existing: false, token: { tokenNo: 'B-01', dept: 'Pediatrics', status: 'waiting' }, patientFirstName: 'Savitri' } },
    200: { description: 'Patient already holds an open token today', example: { existing: true, token: { tokenNo: 'D-07', dept: 'Orthopedics', status: 'waiting' }, patientFirstName: 'Fatima' } },
    401: { description: 'OTP missing, wrong, or expired', schemaRef: 'Error' },
    403: { description: 'Mobile does not match the ABHA record', schemaRef: 'Error' },
    404: { description: 'ABHA not found', schemaRef: 'Error' },
  },
  handler: async (req, res) => {
    const dam = getDam();
    const { mobile, otp, abha, name, age, sex, dept, symptoms = [], date, slot } = req.body;

    // phone ownership first — an unverified mobile issues nothing
    const check = await verifyOtp(mobile, otp);
    if (!check.ok) return res.status(401).json({ error: check.error, correlationId: req.id });

    // symptoms route to the department unless the patient overrode it
    let targetDept = dept || null;
    if (!targetDept && symptoms.length) {
      const map = await dam.listSymptoms();
      targetDept = map.find(s => s.code === symptoms[0])?.dept || null;
    }

    let patient;
    if (abha) {
      patient = await dam.getPatientByAbha(abha);
      if (!patient) return res.status(404).json({ error: 'No record for this ABHA number — use the "No ABHA" option to register', correlationId: req.id });
      if (String(patient.mobile) !== String(mobile)) {
        return res.status(403).json({ error: 'Mobile number does not match the ABHA record', correlationId: req.id });
      }
    } else {
      // Families share one mobile: a typed name selects the matching family
      // member's record; an unknown name registers a NEW patient rather than
      // hijacking (and mis-greeting) whoever registered that mobile first.
      patient = await dam.getPatientByMobile(mobile, name || null);
      if (!patient) {
        if (!name || age === undefined || !sex || !targetDept) {
          const anyOnMobile = await dam.getPatientByMobile(mobile);
          if (anyOnMobile && !name) patient = anyOnMobile; // returning patient, no name typed
          else return res.status(422).json({ error: 'First visit? Name, age, sex and a symptom are needed to register you', correlationId: req.id });
        } else {
          // portal deployments are per-facility; self-registrations take the host facility's UHID series
          patient = await dam.createPatient({ name, mobile, age, sex, dept: targetDept, facilityCode: process.env.FACILITY_CODE || 'DIST_HOSP_01' });
          await dam.audit({ actorId: null, action: 'patient.self-register', entity: 'patient', entityId: patient.id });
        }
      }
    }
    targetDept = targetDept || patient.dept || 'General Medicine';

    let token;
    try {
      token = await dam.issueToken({
        patientId: patient.id, dept: targetDept,
        source: 'self', symptoms, date: date || null, slot: slot || null,
      });
    } catch (err) {
      if (err.status === 409 && err.token) {
        // already holds one for that date — return it instead of duplicating
        return res.json({
          existing: true,
          token: { tokenNo: err.token.tokenNo, dept: err.token.dept, status: err.token.status, date: err.token.date, slot: err.token.slot || null },
          patientFirstName: patient.name.split(' ')[0],
        });
      }
      throw err;
    }
    await dam.audit({ actorId: null, action: 'token.self-issue', entity: 'token', entityId: token.id, detail: `${targetDept} ${token.date}${slot ? ' ' + slot : ''}` });
    await getCache().del(`pubqueue:${targetDept}`);
    await getCache().del('pubqueue:null');
    emitQueueChange(targetDept);

    res.status(201).json({
      existing: false,
      token: { tokenNo: token.tokenNo, dept: token.dept, status: token.status, date: token.date, slot: token.slot || null },
      patientFirstName: patient.name.split(' ')[0],
    });
  },
});

export default router;
