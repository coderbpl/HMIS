import { z } from 'zod';
import { getDam } from '../dam/index.js';
import { createGatewayRouter } from '../gateway/registry.js';
import { fields } from '../gateway/schemas.js';

const { router, route } = createGatewayRouter('/api/templates', 'Consultation Templates');

const templateBody = z.object({
  name: z.string().min(1).max(100),
  category: z.string().min(1).max(40),
  complaints: z.string().max(2000).optional(),
  examination: z.string().max(2000).optional(),
  diagnosis: z.string().max(200).optional(),
  prescription: z.array(z.any()).max(30).optional(),
  advice: z.string().max(2000).optional(),
  followUp: z.string().max(1000).optional(),
});

route({
  method: 'get', path: '/',
  summary: 'List consultation templates (own + system defaults)',
  auth: { perm: 'templates:read' },
  responses: { 200: { description: 'Templates', schema: z.array(z.any()) } },
  handler: async (req, res) => res.json(await getDam().listTemplates(req.user.id)),
});

route({
  method: 'get', path: '/:id',
  summary: 'Fetch one template',
  auth: { perm: 'templates:read' },
  params: z.object({ id: fields.id }),
  responses: {
    200: { description: 'The template', schemaRef: 'Template' },
    404: { description: 'Unknown template', schemaRef: 'Error' },
  },
  handler: async (req, res) => {
    const template = await getDam().getTemplate(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found', correlationId: req.id });
    res.json(template);
  },
});

route({
  method: 'post', path: '/',
  summary: 'Create a template',
  auth: { perm: 'templates:write' },
  body: templateBody,
  bodyExample: { name: 'Viral fever adult', category: 'General Medicine', diagnosis: 'Acute viral fever', prescription: [{ med: 'Tab. Paracetamol 650', dose: '1-1-1', days: 5 }] },
  responses: { 201: { description: 'Created', schemaRef: 'Template' } },
  handler: async (req, res) => {
    const template = await getDam().saveTemplate(req.user.id, req.body);
    await getDam().audit({ actorId: req.user.id, action: 'template.create', entity: 'template', entityId: template.id });
    res.status(201).json(template);
  },
});

route({
  method: 'put', path: '/:id',
  summary: 'Update a template',
  auth: { perm: 'templates:write' },
  params: z.object({ id: fields.id }),
  body: templateBody,
  responses: { 200: { description: 'Updated', schemaRef: 'Template' } },
  handler: async (req, res) => {
    const template = await getDam().saveTemplate(req.user.id, { ...req.body, id: req.params.id });
    await getDam().audit({ actorId: req.user.id, action: 'template.update', entity: 'template', entityId: template.id });
    res.json(template);
  },
});

route({
  method: 'delete', path: '/:id',
  summary: 'Delete a template',
  auth: { perm: 'templates:write' },
  params: z.object({ id: fields.id }),
  responses: { 200: { description: 'Deleted', schemaRef: 'Ok' } },
  handler: async (req, res) => {
    await getDam().deleteTemplate(req.params.id, req.user.id);
    await getDam().audit({ actorId: req.user.id, action: 'template.delete', entity: 'template', entityId: req.params.id });
    res.json({ success: true });
  },
});

export default router;
