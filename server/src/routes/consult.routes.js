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
    dx: z.string().max(400).optional(),          // one or more diagnoses, '; ' separated
    rx: z.array(
      z.object({
        med: z.string().max(200).optional(),     // accept both med/name and days/duration
        name: z.string().max(200).optional(),
        dose: z.string().max(20),
        days: z.coerce.number().int().min(1).max(365).optional(),
        duration: z.coerce.number().int().min(1).max(365).optional(),
        qty: z.coerce.number().int().min(1).max(2000).optional(),
      }).refine(r => (r.med || r.name) && (r.days || r.duration), { message: 'medicine name and duration are required' })
    ).max(30).default([]),
    labs: z.array(z.string().max(60)).max(20).default([]),
    dispo: z.enum(['home', 'review', 'admit', 'refer']).default('home'),
    notes: z.string().max(4000).optional(),
    // clinical context captured during the consult — persisted to the patient record
    allergies: z.object({
      med: z.array(z.string().max(60)).max(15).default([]),
      food: z.array(z.string().max(60)).max(15).default([]),
    }).optional(),
    bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'Unknown']).optional(),
    familyHistory: z.array(z.object({
      relation: z.string().max(30),
      condition: z.string().max(60),
    })).max(20).optional(),
    pastIllness: z.array(z.string().max(60)).max(15).optional(),
    social: z.array(z.string().max(40)).max(8).optional(),
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
    // normalize rx items to one shape regardless of which field names came in
    const rx = req.body.rx.map(r => ({
      name: r.name || r.med,
      dose: r.dose,
      duration: r.duration || r.days,
      qty: r.qty || null,
    }));
    const consult = await getDam().saveConsult({ ...req.body, rx, doctorId: req.user.id });
    await getCache().del(`pubqueue:${consult.dept}`);
    await getCache().del('pubqueue:null');
    emitQueueChange(consult.dept);
    res.status(201).json(consult);
  },
});

export default router;
