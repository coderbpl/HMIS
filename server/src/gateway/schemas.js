import { z } from 'zod';

/** Shared validation patterns. */
export const patterns = {
  mobile: /^[6-9]\d{9}$/,
  tokenNo: /^[A-Za-z]-\d{1,4}$/,
  abha: /^[\d-]{14,20}$/,
  username: /^[a-z0-9.]{3,40}$/i,
  bp: /^\d{2,3}\/\d{2,3}$/,
};

/** Reusable field schemas. */
export const fields = {
  mobile: z.string().regex(patterns.mobile, 'must be a valid 10-digit Indian mobile number'),
  tokenNo: z.string().regex(patterns.tokenNo, 'must look like A-17'),
  abha: z.string().regex(patterns.abha, 'must be a valid ABHA number'),
  sex: z.enum(['M', 'F', 'O']),
  age: z.coerce.number().int().min(0).max(130),
  dept: z.string().min(2).max(60),
  id: z.string().min(1).max(24),
};

/**
 * Reusable response schemas — exposed in the OpenAPI document under
 * components.schemas and referenced from route definitions by name.
 */
export const COMPONENTS = {
  Error: z.object({
    error: z.string(),
    details: z.array(z.string()).optional(),
    correlationId: z.string().optional(),
  }),
  User: z.object({
    id: z.string(),
    name: z.string(),
    role: z.enum(['doctor', 'nurse', 'reception', 'pharmacy', 'admin']),
  }),
  AuthTokens: z.object({
    token: z.string().describe('Access JWT (30 min) — alias of accessToken'),
    accessToken: z.string(),
    refreshToken: z.string().describe('Refresh JWT (7 days), POST to /api/auth/refresh'),
    user: z.object({ id: z.string(), name: z.string(), role: z.string() }),
  }),
  Patient: z.object({
    id: z.string(),
    name: z.string(),
    mobile: z.string(),
    age: z.number(),
    sex: z.string(),
    dept: z.string(),
    abha: z.string().nullable(),
    scheme: z.string().nullable(),
    complaint: z.string().optional(),
    allergies: z.array(z.string()),
    conditions: z.array(z.string()),
    meds: z.array(z.string()),
  }),
  Token: z.object({
    id: z.string(),
    tokenNo: z.string(),
    patientId: z.string(),
    dept: z.string(),
    date: z.string(),
    status: z.enum(['booked', 'checked-in', 'waiting', 'in-consult', 'done', 'cancelled']),
    priority: z.enum(['normal', 'urgent']),
    category: z.enum(['normal', 'emergency', 'referral']).optional(),
    slot: z.string().nullable().optional(),
    vitalsDone: z.boolean(),
  }),
  PublicBoard: z.object({
    dept: z.string(),
    nowServing: z.string().nullable(),
    updatedAt: z.string(),
    rows: z.array(z.object({
      tokenNo: z.string(),
      status: z.string(),
      priority: z.string(),
      patient: z.string().nullable().describe('Privacy-masked display name'),
    })),
  }),
  TrackInfo: z.object({
    tokenNo: z.string(),
    dept: z.string(),
    status: z.string(),
    patientFirstName: z.string(),
    position: z.number(),
    nowServing: z.string().nullable(),
    estWaitMin: z.number(),
    vitalsDone: z.boolean(),
  }),
  Consult: z.object({
    id: z.string(),
    tokenId: z.string(),
    dispo: z.enum(['home', 'review', 'admit', 'refer']),
    completedAt: z.string(),
  }),
  Template: z.object({
    id: z.string(),
    name: z.string(),
    category: z.string(),
    diagnosis: z.string().optional(),
    prescription: z.array(z.any()).optional(),
  }),
  Medicine: z.object({
    id: z.string(),
    name: z.string(),
    stock: z.number().optional(),
  }),
  Prescription: z.object({
    id: z.string(),
    status: z.enum(['pending', 'dispensing', 'dispensed', 'cancelled']),
  }),
  Ok: z.object({ success: z.boolean() }),
};
