import { z } from 'zod';
import { getDam } from '../dam/index.js';
import { getCache } from '../cache.js';
import { createGatewayRouter } from '../gateway/registry.js';
import { fields } from '../gateway/schemas.js';
import { emitQueueChange } from '../events.js';

const { router, route } = createGatewayRouter('/api/patients', 'Patients');

route({
  method: 'get', path: '/',
  summary: 'Search patients by name, UHID or mobile',
  auth: { perm: 'patients:read' },
  query: z.object({ query: z.string().max(80).default('') }),
  responses: { 200: { description: 'Up to 20 matches', schema: z.array(z.any()), example: [{ id: 'P-24071', name: 'Ramesh Patel', mobile: '9800000001', dept: 'General Medicine' }] } },
  handler: async (req, res) => {
    res.json(await getDam().searchPatients(req.query.query));
  },
});

route({
  method: 'get', path: '/:id',
  summary: 'Fetch one patient by UHID',
  auth: { perm: 'patients:read' },
  params: z.object({ id: fields.id }),
  responses: {
    200: { description: 'The patient record', schemaRef: 'Patient' },
    404: { description: 'Unknown UHID', schemaRef: 'Error', example: { error: 'Patient not found' } },
  },
  handler: async (req, res) => {
    const p = await getDam().getPatientById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Patient not found', correlationId: req.id });
    res.json(p);
  },
});

route({
  method: 'get', path: '/:id/history',
  summary: 'EHR timeline for one patient',
  description: 'Every visit, vitals reading, consultation and prescription as typed events, newest first. The client groups by date and filters by category.',
  auth: { perm: 'patients:read' },
  params: z.object({ id: fields.id }),
  responses: {
    200: { description: 'Typed events, newest first', schema: z.array(z.any()), example: [{ type: 'consult', date: '2026-07-20', title: 'I10 Essential hypertension', detail: 'disposition: review' }] },
    404: { description: 'Unknown UHID', schemaRef: 'Error' },
  },
  handler: async (req, res) => {
    res.json(await getDam().getPatientHistory(req.params.id));
  },
});

route({
  method: 'post', path: '/',
  summary: 'Register a patient (optionally issuing an OPD token)',
  description: 'Front-desk registration. When issueToken is not "no", a queue token for the chosen department is issued in the same call and the live boards update instantly.',
  auth: { perm: 'patients:register' },
  // Emergency admissions are treatment-first: an unconscious or unidentified
  // patient has no mobile/age/ABHA yet, so those become optional for
  // category=emergency and stay mandatory for normal/referral registration.
  body: z.object({
    name: z.string().min(2).max(120).optional(),
    mobile: fields.mobile.optional().or(z.literal('')),
    age: fields.age.optional(),
    sex: fields.sex.default('O'),
    dept: fields.dept,
    abha: fields.abha.optional(),
    scheme: z.string().max(40).optional(),
    issueToken: z.enum(['yes', 'no']).default('yes'),
    category: z.enum(['normal', 'emergency', 'referral']).default('normal'),
    triage: z.enum(['red', 'yellow', 'green']).optional(), // emergency severity
    symptoms: z.array(z.string().max(20)).max(4).optional(),
    complaint: z.string().max(200).optional(),
    feeAmount: z.coerce.number().int().min(0).max(10000).optional(),
    feeExemption: z.string().max(30).optional(),
  }).superRefine((b, ctx) => {
    if (b.category !== 'emergency') {
      if (!b.name) ctx.addIssue({ code: 'custom', path: ['name'], message: 'name is required' });
      if (!b.mobile) ctx.addIssue({ code: 'custom', path: ['mobile'], message: 'a valid 10-digit mobile is required' });
      if (b.age === undefined) ctx.addIssue({ code: 'custom', path: ['age'], message: 'age is required' });
    }
  }),
  bodyExample: { name: 'Geeta Bai', mobile: '9822334455', age: 38, sex: 'F', dept: 'General Medicine', symptoms: ['fever'], feeAmount: 10 },
  responses: {
    201: {
      description: 'Created — patient plus token (token is null when issueToken=no)',
      example: { patient: { id: 'P-24078', name: 'Geeta Bai' }, token: { tokenNo: 'A-17', dept: 'General Medicine', status: 'waiting' } },
    },
  },
  handler: async (req, res) => {
    const dam = getDam();
    const { issueToken, category, triage, symptoms = [], complaint, feeAmount, feeExemption, ...fieldsIn } = req.body;
    if (category === 'emergency') {
      // unknown-patient defaults — identity is completed later at the counter
      fieldsIn.name = fieldsIn.name || 'Unknown patient';
      fieldsIn.mobile = fieldsIn.mobile || null;
      fieldsIn.age = fieldsIn.age ?? null;
    }
    // the operator's facility scopes the UHID (MP-BPL-DH01-26-00001)
    const patient = await dam.createPatient({ ...fieldsIn, facilityCode: req.user.facilityCode });
    await dam.audit({ actorId: req.user.id, action: 'patient.create', entity: 'patient', entityId: patient.id });
    let token = null;
    if (issueToken !== 'no') {
      token = await dam.issueToken({
        patientId: patient.id, dept: fieldsIn.dept,
        category, triage, source: 'counter', symptoms, complaint,
        feeAmount: feeAmount ?? null, feeExemption: feeExemption ?? null,
      });
      await dam.audit({ actorId: req.user.id, action: 'token.issue', entity: 'token', entityId: token.id, detail: category });
      await getCache().del(`pubqueue:${fieldsIn.dept}`);
      emitQueueChange(fieldsIn.dept);
    }
    res.status(201).json({ patient, token });
  },
});

export default router;
