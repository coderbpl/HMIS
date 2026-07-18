import { z } from 'zod';
import { getDam } from '../dam/index.js';
import { createGatewayRouter } from '../gateway/registry.js';

const { router, route } = createGatewayRouter('/api/medicines', 'Pharmacy & Formulary');

route({
  method: 'get', path: '/facilities',
  summary: 'List facilities',
  auth: { authenticated: true },
  responses: { 200: { description: 'Facilities', example: [{ code: 'DIST_HOSP_01', name: 'District Hospital, Bhopal' }] } },
  handler: async (_req, res) => res.json(await getDam().listFacilities()),
});

route({
  method: 'get', path: '/',
  summary: 'List medicines available at a facility',
  auth: { perm: 'medicines:read' },
  query: z.object({ facility: z.string().max(40).default('DIST_HOSP_01') }),
  responses: { 200: { description: 'Formulary for the facility', schema: z.array(z.any()) } },
  handler: async (req, res) => {
    res.json(await getDam().listMedicines(req.query.facility, req.user.id));
  },
});

route({
  method: 'get', path: '/search',
  summary: 'Search the facility formulary',
  auth: { perm: 'medicines:read' },
  query: z.object({ q: z.string().max(80).default(''), facility: z.string().max(40).default('DIST_HOSP_01') }),
  responses: { 200: { description: 'Matches', schema: z.array(z.any()) } },
  handler: async (req, res) => {
    res.json(await getDam().searchMedicines(req.query.q, req.query.facility));
  },
});

route({
  method: 'get', path: '/quick',
  summary: "Doctor's quick-pick medicines",
  auth: { perm: 'medicines:quick' },
  responses: { 200: { description: 'Quick picks for the signed-in doctor', schema: z.array(z.any()) } },
  handler: async (req, res) => res.json(await getDam().getDoctorQuickMeds(req.user.id)),
});

route({
  method: 'put', path: '/quick',
  summary: "Update the doctor's quick-pick medicines",
  auth: { perm: 'medicines:quick' },
  body: z.object({ medicineIds: z.array(z.string().max(40)).max(50) }),
  bodyExample: { medicineIds: ['MED-001', 'MED-014'] },
  responses: { 200: { description: 'Saved', schemaRef: 'Ok' } },
  handler: async (req, res) => {
    await getDam().setDoctorQuickMeds(req.user.id, req.body.medicineIds);
    await getDam().audit({ actorId: req.user.id, action: 'doctor.quickmeds.update', entity: 'user', entityId: req.user.id });
    res.json({ success: true });
  },
});

export default router;
