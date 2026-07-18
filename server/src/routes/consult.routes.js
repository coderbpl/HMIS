import { z } from 'zod';
import { getDam } from '../dam/index.js';
import { getCache } from '../cache.js';
import { createGatewayRouter } from '../gateway/registry.js';
import { fields } from '../gateway/schemas.js';
import { emitQueueChange } from '../events.js';

const { router, route } = createGatewayRouter('/api/consults', 'OPD Consultations');

route({
  method: 'post', path: '/',
  summary: 'Complete a consultation',
  description: 'Saves diagnosis, prescription, lab orders and disposition; marks the token done and pushes the queue update to every connected board.',
  auth: { perm: 'consults:write' },
  body: z.object({
    tokenId: fields.id,
    dx: z.string().max(200).optional(),
    rx: z.array(z.object({
      med: z.string().max(200),
      dose: z.string().max(20),
      days: z.coerce.number().int().min(1).max(365),
      qty: z.coerce.number().int().min(1).max(2000).optional(),
    })).max(30).default([]),
    labs: z.array(z.string().max(60)).max(20).default([]),
    dispo: z.enum(['home', 'review', 'admit', 'refer']).default('home'),
    notes: z.string().max(4000).optional(),
  }),
  bodyExample: {
    tokenId: 'T-14', dx: 'I20.9 Angina pectoris', dispo: 'review',
    rx: [{ med: 'Tab. Aspirin 75', dose: '0-1-0', days: 30, qty: 30 }],
    labs: ['ECG', 'CBC'],
  },
  responses: {
    201: { description: 'The saved consultation', schemaRef: 'Consult' },
    404: { description: 'Unknown token', schemaRef: 'Error' },
  },
  handler: async (req, res) => {
    const consult = await getDam().saveConsult({ ...req.body, doctorId: req.user.id });
    await getCache().del(`pubqueue:${consult.dept}`);
    await getCache().del('pubqueue:null');
    emitQueueChange(consult.dept);
    res.status(201).json(consult);
  },
});

export default router;
