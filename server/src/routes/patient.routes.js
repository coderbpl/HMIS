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
  method: 'post', path: '/',
  summary: 'Register a patient (optionally issuing an OPD token)',
  description: 'Front-desk registration. When issueToken is not "no", a queue token for the chosen department is issued in the same call and the live boards update instantly.',
  auth: { perm: 'patients:register' },
  body: z.object({
    name: z.string().min(2).max(120),
    mobile: fields.mobile,
    age: fields.age,
    sex: fields.sex,
    dept: fields.dept,
    abha: fields.abha.optional(),
    scheme: z.string().max(40).optional(),
    issueToken: z.enum(['yes', 'no']).default('yes'),
    category: z.enum(['normal', 'emergency', 'referral']).default('normal'),
    symptoms: z.array(z.string().max(20)).max(4).optional(),
    complaint: z.string().max(200).optional(),
    feeAmount: z.coerce.number().int().min(0).max(10000).optional(),
    feeExemption: z.string().max(30).optional(),
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
    const { issueToken, category, symptoms = [], complaint, feeAmount, feeExemption, ...fieldsIn } = req.body;
    const patient = await dam.createPatient(fieldsIn);
    await dam.audit({ actorId: req.user.id, action: 'patient.create', entity: 'patient', entityId: patient.id });
    let token = null;
    if (issueToken !== 'no') {
      token = await dam.issueToken({
        patientId: patient.id, dept: fieldsIn.dept,
        category, source: 'counter', symptoms, complaint,
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
