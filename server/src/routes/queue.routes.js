import { z } from 'zod';
import { getDam } from '../dam/index.js';
import { getCache } from '../cache.js';
import { createGatewayRouter } from '../gateway/registry.js';
import { fields, patterns } from '../gateway/schemas.js';
import { emitQueueChange } from '../events.js';

const { router, route } = createGatewayRouter('/api/queue', 'OPD Queue & Tokens');

route({
  method: 'get', path: '/',
  summary: 'Staff queue with full patient details',
  description: 'Doctors receive only triage-cleared tokens (vitals recorded) plus their in-consult patient — industry-standard OPD flow: arrive → triage → ready for doctor. Nurses and reception see the complete queue.',
  auth: { perm: 'queue:read' },
  query: z.object({ dept: z.string().max(60).optional() }),
  responses: { 200: { description: "Today's open tokens ordered by priority then sequence", schema: z.array(z.any()) } },
  handler: async (req, res) => {
    let rows = await getDam().getQueueByDept(req.query.dept || null);
    if (req.user.role === 'doctor') {
      rows = rows.filter(t => t.vitalsDone || t.status === 'in-consult');
    }
    res.json(rows);
  },
});

route({
  method: 'post', path: '/tokens',
  summary: 'Issue a token for an existing patient (revisit)',
  auth: { perm: 'tokens:issue' },
  body: z.object({
    patientId: fields.id,
    dept: fields.dept,
    priority: z.enum(['normal', 'urgent']).default('normal'),
  }),
  bodyExample: { patientId: 'P-24071', dept: 'General Medicine', priority: 'normal' },
  responses: { 201: { description: 'The issued token', schemaRef: 'Token' } },
  handler: async (req, res) => {
    const token = await getDam().issueToken(req.body);
    await getDam().audit({ actorId: req.user.id, action: 'token.issue', entity: 'token', entityId: token.id });
    await getCache().del(`pubqueue:${req.body.dept}`);
    emitQueueChange(req.body.dept);
    res.status(201).json(token);
  },
});

route({
  method: 'patch', path: '/tokens/:id/status',
  summary: 'Advance a token through the queue',
  description: 'Allowed transitions: checked-in→waiting, waiting→in-consult, in-consult→done/waiting. Calling a token to consult automatically returns any other in-consult token in the department to waiting.',
  auth: { perm: 'queue:call' },
  params: z.object({ id: fields.id }),
  body: z.object({ status: z.enum(['waiting', 'in-consult', 'done', 'cancelled']) }),
  bodyExample: { status: 'in-consult' },
  responses: {
    200: { description: 'Updated token', schemaRef: 'Token' },
    404: { description: 'Unknown token', schemaRef: 'Error' },
    409: { description: 'Transition not allowed from the current state', schemaRef: 'Error', example: { error: 'Cannot move token from done to in-consult' } },
  },
  handler: async (req, res) => {
    const token = await getDam().updateTokenStatus(req.params.id, req.body.status, req.user.id);
    await getCache().del(`pubqueue:${token.dept}`);
    emitQueueChange(token.dept);
    res.json(token);
  },
});

route({
  method: 'patch', path: '/tokens/:id/vitals',
  summary: 'Record triage vitals for a token',
  description: 'Nurse triage capture. Values outside plausible clinical ranges are rejected. Marks the token vitals-done, which the doctor queue and the patient portal reflect immediately.',
  auth: { perm: 'vitals:write' },
  params: z.object({ id: fields.id }),
  body: z.object({
    bp: z.string().regex(patterns.bp, 'format: 120/80').optional(),
    pulse: z.coerce.number().min(20).max(250).optional(),
    temp: z.coerce.number().min(90).max(110).optional(),
    spo2: z.coerce.number().min(50).max(100).optional(),
    rr: z.coerce.number().min(5).max(80).optional(),
    weight: z.coerce.number().min(1).max(400).optional(),
  }),
  bodyExample: { bp: '132/86', pulse: 78, temp: 98.2, spo2: 97, rr: 16, weight: 70 },
  responses: {
    200: { description: 'Token with vitalsDone=true', schemaRef: 'Token' },
    404: { description: 'Unknown token', schemaRef: 'Error' },
  },
  handler: async (req, res) => {
    const token = await getDam().saveVitals(req.params.id, req.body, req.user.id);
    await getCache().del(`pubqueue:${token.dept}`);
    emitQueueChange(token.dept);
    res.json(token);
  },
});

export default router;
