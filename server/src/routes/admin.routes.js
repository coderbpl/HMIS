import { z } from 'zod';
import { getDam } from '../dam/index.js';
import { createGatewayRouter } from '../gateway/registry.js';

const { router, route } = createGatewayRouter('/api/admin', 'Administration & Reports');

route({
  method: 'get', path: '/flow-stats',
  summary: 'Hospital-wide patient-flow counters',
  auth: { perm: 'reports:read' },
  query: z.object({ facilityCode: z.string().max(40).default('DIST_HOSP_01') }),
  responses: { 200: { description: 'Aggregate counts for the flow dashboard', example: { totalTokens: 15, waiting: 5, inConsult: 1, done: 8, atPharmacy: 2, avgWaitTimeMin: 12 } } },
  handler: async (req, res) => {
    res.json(await getDam().getAdminFlowStats(req.query.facilityCode));
  },
});

route({
  method: 'get', path: '/timeline',
  summary: 'Chronological queue timeline for a facility',
  auth: { perm: 'reports:read' },
  query: z.object({
    facilityCode: z.string().max(40).default('DIST_HOSP_01'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD').optional(),
  }),
  responses: { 200: { description: 'Token-level timeline rows', schema: z.array(z.any()) } },
  handler: async (req, res) => {
    res.json(await getDam().getAdminQueueTimeline(req.query.facilityCode, req.query.date || null));
  },
});

export default router;
