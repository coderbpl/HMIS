/**
 * Data Access Manager (DAM) contract.
 *
 * Every adapter (mssql, memory, future postgres/mongo…) must implement exactly
 * these methods with these signatures. Services depend only on this contract,
 * never on a driver, so swapping databases means writing one new adapter file
 * and changing DB_DRIVER — no service or route changes.
 */
export const DAM_METHODS = [
  'init',                 // () -> void
  'getUserByUsername',    // (username) -> { id, username, name, role, passHash } | null
  'getUserById',          // (id) -> { id, username, name, role } | null
  'createPatient',        // ({ name, mobile, age, sex, dept, abha, scheme }) -> patient
  'searchPatients',       // (query) -> patient[]
  'getPatientById',       // (id) -> patient | null
  'getPatientByAbha',     // (abha) -> patient | null
  'getPatientByMobile',   // (mobile) -> patient | null
  'saveVitals',           // (tokenId, { bp, pulse, temp, spo2, rr, weight }, actorId) -> token
  'issueToken',           // ({ patientId, dept, priority, category, source, symptoms, complaint, feeAmount, feeExemption, date, slot }) -> token
  'getQueueByDept',       // (dept) -> [{ ...token, patient }]
  'listSymptoms',         // () -> [{ code, en, hin, dept }]
  'listSlots',            // (dept, date) -> [{ time, free, past }]
  'checkInToken',         // ({ mobile, tokenNo }, actorId) -> token  (booked -> waiting)
  'returnToTriage',       // (tokenId, actorId) -> token  (vitals wiped, back to nurse queue)
  'preponeToken',         // ({ mobile, tokenNo }) -> token  (future booking -> today's queue)
  'getPublicQueue',       // (dept) -> masked queue rows (no PHI)
  'updateTokenStatus',    // (tokenId, status, actorId) -> token
  'trackToken',           // ({ mobile, tokenNo }) -> { tokenNo, status, position, nowServing } | null
  'listTokensByMobile',   // (mobile) -> [{ tokenNo, dept, date, slot, status }] active today/upcoming
  'saveConsult',          // ({ tokenId, doctorId, dx, rx, labs, dispo, notes }) -> consult
  'listDepartments',      // () -> [{ code, name, series }]
  'audit',                // ({ actorId, action, entity, entityId, detail }) -> void
  
  // New Methods
  'listMedicines',             // (facilityCode, doctorId) -> medicines
  'searchMedicines',           // (query, facilityCode) -> medicines
  'getDoctorQuickMeds',        // (doctorId) -> medicines[]
  'setDoctorQuickMeds',        // (doctorId, medicineIds[]) -> void
  'listTemplates',             // (doctorId) -> templates[]
  'getTemplate',               // (templateId) -> template | null
  'saveTemplate',              // (doctorId, template) -> template
  'deleteTemplate',            // (templateId, doctorId) -> void
  'listFacilities',            // () -> facilities[]
  'getFacilityMedicines',      // (facilityCode) -> medicines[]
  'listPrescriptions',         // (filters) -> prescriptions[]
  'updatePrescriptionStatus',  // (id, status, pharmacistId) -> prescription
  'getAdminFlowStats',         // (facilityCode) -> stats
  'getAdminQueueTimeline',     // (facilityCode, date) -> timeline[]
];

export function assertImplements(adapter, name) {
  for (const m of DAM_METHODS) {
    if (typeof adapter[m] !== 'function') {
      throw new Error(`DAM adapter "${name}" is missing method ${m}()`);
    }
  }
  return adapter;
}
