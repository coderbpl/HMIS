import { z } from 'zod';
import { getDam } from '../dam/index.js';
import { createGatewayRouter } from '../gateway/registry.js';
import { fields } from '../gateway/schemas.js';

const { router, route } = createGatewayRouter('/api/pharmacy', 'Pharmacy Dispensing');

route({
  method: 'get', path: '/prescriptions',
  summary: 'List prescriptions for dispensing',
  auth: { perm: 'pharmacy:read' },
  query: z.object({
    status: z.enum(['pending', 'dispensing', 'dispensed', 'cancelled']).optional(),
    facilityCode: z.string().max(40).optional(),
  }),
  responses: { 200: { description: 'Prescriptions', schema: z.array(z.any()) } },
  handler: async (req, res) => {
    res.json(await getDam().listPrescriptions({
      status: req.query.status || null,
      facilityCode: req.query.facilityCode || null,
    }));
  },
});

route({
  method: 'patch', path: '/prescriptions/:id/status',
  summary: 'Update a prescription status (e.g. dispensed)',
  auth: { perm: 'pharmacy:dispense' },
  params: z.object({ id: fields.id }),
  body: z.object({ status: z.enum(['pending', 'dispensing', 'dispensed', 'cancelled']) }),
  bodyExample: { status: 'dispensed' },
  responses: {
    200: { description: 'Updated prescription', schemaRef: 'Prescription' },
    404: { description: 'Unknown prescription', schemaRef: 'Error' },
  },
  handler: async (req, res) => {
    res.json(await getDam().updatePrescriptionStatus(req.params.id, req.body.status, req.user.id));
  },
});

export default router;
