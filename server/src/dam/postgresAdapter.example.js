/**
 * POSTGRES ADAPTER TEMPLATE — copy to postgresAdapter.js to activate.
 *
 * The DAM contract (contract.js) is the complete integration surface: implement
 * these methods and the entire HMIS runs on PostgreSQL with zero changes
 * elsewhere. Mirror the MSSQL adapter's behaviour:
 *   - all SQL as parameterized queries or pl/pgsql functions ($1, $2 — never
 *     string concatenation)
 *   - grant the app role EXECUTE/nothing else if you port the procedures
 *   - same shapes returned as memoryAdapter.js (the reference implementation)
 *
 * Setup:  npm i pg   and set DB_DRIVER=postgres, PG_URL=postgres://…
 */
// import pg from 'pg';
// import { config } from '../config.js';

export function createPostgresAdapter() {
  // const pool = new pg.Pool({ connectionString: process.env.PG_URL });
  return {
    async init() {
      // await pool.query('select 1');
      throw new Error('postgresAdapter: port the contract methods below, then delete this throw');
    },

    // () -> void
    async init() { throw new Error('postgresAdapter: init() not implemented yet'); },

    // (username) -> { id, username, name, role, passHash } | null
    async getUserByUsername() { throw new Error('postgresAdapter: getUserByUsername() not implemented yet'); },

    // (id) -> { id, username, name, role } | null
    async getUserById() { throw new Error('postgresAdapter: getUserById() not implemented yet'); },

    // ({ name, mobile, age, sex, dept, abha, scheme }) -> patient
    async createPatient() { throw new Error('postgresAdapter: createPatient() not implemented yet'); },

    // (query) -> patient[]
    async searchPatients() { throw new Error('postgresAdapter: searchPatients() not implemented yet'); },

    // (id) -> patient | null
    async getPatientById() { throw new Error('postgresAdapter: getPatientById() not implemented yet'); },

    // (abha) -> patient | null
    async getPatientByAbha() { throw new Error('postgresAdapter: getPatientByAbha() not implemented yet'); },

    // (mobile) -> patient | null
    async getPatientByMobile() { throw new Error('postgresAdapter: getPatientByMobile() not implemented yet'); },

    // (tokenId, { bp, pulse, temp, spo2, rr, weight }, actorId) -> token
    async saveVitals() { throw new Error('postgresAdapter: saveVitals() not implemented yet'); },

    // (patientId) -> EHR events [{ type, at, date, title, detail, … }] newest first
    async getPatientHistory() { throw new Error('postgresAdapter: getPatientHistory() not implemented yet'); },

    // ({ patientId, dept, priority, category, source, symptoms, complaint, feeAmount, feeExemption, date, slot }) -> token
    async issueToken() { throw new Error('postgresAdapter: issueToken() not implemented yet'); },

    // (dept) -> [{ ...token, patient }]
    async getQueueByDept() { throw new Error('postgresAdapter: getQueueByDept() not implemented yet'); },

    // () -> [{ code, en, hin, dept }]
    async listSymptoms() { throw new Error('postgresAdapter: listSymptoms() not implemented yet'); },

    // (dept, date) -> [{ time, free, past }]
    async listSlots() { throw new Error('postgresAdapter: listSlots() not implemented yet'); },

    // ({ mobile, tokenNo }, actorId) -> token  (booked -> waiting)
    async checkInToken() { throw new Error('postgresAdapter: checkInToken() not implemented yet'); },

    // (tokenId, actorId) -> token  (vitals wiped, back to nurse queue)
    async returnToTriage() { throw new Error('postgresAdapter: returnToTriage() not implemented yet'); },

    // ({ mobile, tokenNo }) -> token  (future booking -> today's queue)
    async preponeToken() { throw new Error('postgresAdapter: preponeToken() not implemented yet'); },

    // (dept) -> masked queue rows (no PHI)
    async getPublicQueue() { throw new Error('postgresAdapter: getPublicQueue() not implemented yet'); },

    // (tokenId, status, actorId) -> token
    async updateTokenStatus() { throw new Error('postgresAdapter: updateTokenStatus() not implemented yet'); },

    // ({ mobile, tokenNo }) -> { tokenNo, status, position, nowServing } | null
    async trackToken() { throw new Error('postgresAdapter: trackToken() not implemented yet'); },

    // (mobile) -> [{ tokenNo, dept, date, slot, status }] active today/upcoming
    async listTokensByMobile() { throw new Error('postgresAdapter: listTokensByMobile() not implemented yet'); },

    // ({ tokenId, doctorId, dx, rx, labs, dispo, notes }) -> consult
    async saveConsult() { throw new Error('postgresAdapter: saveConsult() not implemented yet'); },

    // () -> [{ code, name, series }]
    async listDepartments() { throw new Error('postgresAdapter: listDepartments() not implemented yet'); },

    // ({ actorId, action, entity, entityId, detail }) -> void
    async audit() { throw new Error('postgresAdapter: audit() not implemented yet'); },

    // (facilityCode, doctorId) -> medicines
    async listMedicines() { throw new Error('postgresAdapter: listMedicines() not implemented yet'); },

    // (query, facilityCode) -> medicines
    async searchMedicines() { throw new Error('postgresAdapter: searchMedicines() not implemented yet'); },

    // (doctorId) -> medicines[]
    async getDoctorQuickMeds() { throw new Error('postgresAdapter: getDoctorQuickMeds() not implemented yet'); },

    // (doctorId, medicineIds[]) -> void
    async setDoctorQuickMeds() { throw new Error('postgresAdapter: setDoctorQuickMeds() not implemented yet'); },

    // (doctorId) -> templates[]
    async listTemplates() { throw new Error('postgresAdapter: listTemplates() not implemented yet'); },

    // (templateId) -> template | null
    async getTemplate() { throw new Error('postgresAdapter: getTemplate() not implemented yet'); },

    // (doctorId, template) -> template
    async saveTemplate() { throw new Error('postgresAdapter: saveTemplate() not implemented yet'); },

    // (templateId, doctorId) -> void
    async deleteTemplate() { throw new Error('postgresAdapter: deleteTemplate() not implemented yet'); },

    // () -> facilities[]
    async listFacilities() { throw new Error('postgresAdapter: listFacilities() not implemented yet'); },

    // (facilityCode) -> medicines[]
    async getFacilityMedicines() { throw new Error('postgresAdapter: getFacilityMedicines() not implemented yet'); },

    // (filters) -> prescriptions[]
    async listPrescriptions() { throw new Error('postgresAdapter: listPrescriptions() not implemented yet'); },

    // (id, status, pharmacistId) -> prescription
    async updatePrescriptionStatus() { throw new Error('postgresAdapter: updatePrescriptionStatus() not implemented yet'); },

    // (facilityCode) -> stats
    async getAdminFlowStats() { throw new Error('postgresAdapter: getAdminFlowStats() not implemented yet'); },

    // (facilityCode, date) -> timeline[]
    async getAdminQueueTimeline() { throw new Error('postgresAdapter: getAdminQueueTimeline() not implemented yet'); },
  };
}
