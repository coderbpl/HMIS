import sql from 'mssql';
import { config } from '../config.js';
import { log } from '../logger.js';

/**
 * MSSQL DAM adapter. Every database touch is a stored procedure or function
 * call with typed, parameterized inputs (never string-built SQL), so the app
 * account only needs EXECUTE permission — no direct table access.
 * Schema + procedures live in server/sql/.
 */
export function createMssqlAdapter() {
  let pool;

  const exec = async (proc, bind = (r) => r) => {
    const req = pool.request();
    bind(req);
    return req.execute(proc);
  };

  const rowToPatient = r => r && ({
    id: r.PatientCode, name: r.FullName, mobile: r.Mobile, age: r.Age, sex: r.Sex,
    dept: r.Department, abha: r.Abha, scheme: r.Scheme,
    complaint: r.Complaint || '', lastVisit: r.LastVisit || 'First visit',
    allergies: JSON.parse(r.AllergiesJson || '[]'),
    foodAllergies: JSON.parse(r.FoodAllergiesJson || '[]'),
    familyHistory: JSON.parse(r.FamilyJson || '[]'),
    bloodGroup: r.BloodGroup || null,
    conditions: JSON.parse(r.ConditionsJson || '[]'),
    meds: JSON.parse(r.MedsJson || '[]'),
    bp: r.Bp, pulse: r.Pulse, temp: r.Temp, spo2: r.Spo2, rr: r.Rr, weight: r.Weight,
    height: r.Height ?? null, vitalsAt: r.VitalsAt ?? null,
  });

  const rowToToken = r => r && ({
    id: `T-${r.TokenId}`, tokenNo: r.TokenNo, patientId: r.PatientCode, dept: r.Department,
    date: r.TokenDate?.toISOString?.().slice(0, 10) ?? r.TokenDate,
    status: r.Status, priority: r.Priority, vitalsDone: !!r.VitalsDone,
    category: r.Category || 'normal', source: r.Source || 'counter',
    triage: r.TriageLevel || null,
    complaint: r.Complaint || '', slot: r.SlotTime || null,
    feeAmount: r.FeeAmount ?? null, feeExemption: r.FeeExemption ?? null,
    issuedAt: r.IssuedAt, arrivedAt: r.ArrivedAt, calledAt: r.CalledAt,
  });

  return {
    async init() {
      pool = await sql.connect({ ...config.mssql });
      log.info('mssql: connected', { db: config.mssql.database });
    },

    async getUserByUsername(username) {
      const res = await exec('dbo.usp_User_GetByUsername', r => r.input('Username', sql.NVarChar(64), username));
      const u = res.recordset[0];
      return u ? { id: `U-${u.UserId}`, username: u.Username, name: u.FullName, role: u.RoleName, passHash: u.PassHash } : null;
    },

    async getUserById(id) {
      const res = await exec('dbo.usp_User_GetById', r => r.input('UserId', sql.Int, Number(String(id).replace(/^U-/, ''))));
      const u = res.recordset[0];
      return u ? { id: `U-${u.UserId}`, username: u.Username, name: u.FullName, role: u.RoleName } : null;
    },

    async createPatient({ name, mobile, age, sex, dept, abha, scheme, facilityCode }) {
      const res = await exec('dbo.usp_Patient_Create', r => r
        .input('FullName', sql.NVarChar(120), name)
        .input('Mobile', sql.VarChar(15), mobile)
        .input('Age', sql.Int, Number(age))
        .input('Sex', sql.Char(1), sex)
        .input('Department', sql.NVarChar(60), dept)
        .input('Abha', sql.VarChar(20), abha || null)
        .input('Scheme', sql.NVarChar(40), scheme || null)
        .input('FacilityCode', sql.VarChar(20), facilityCode || 'DIST_HOSP_01'));
      return rowToPatient(res.recordset[0]);
    },

    async searchPatients(query) {
      const res = await exec('dbo.usp_Patient_Search', r => r.input('Query', sql.NVarChar(80), query));
      return res.recordset.map(rowToPatient);
    },

    async getPatientById(id) {
      const res = await exec('dbo.usp_Patient_GetByCode', r => r.input('PatientCode', sql.VarChar(24), id));
      return rowToPatient(res.recordset[0]) || null;
    },

    async getPatientByAbha(abha) {
      const res = await exec('dbo.usp_Patient_GetByAbha', r => r.input('Abha', sql.VarChar(20), abha));
      return rowToPatient(res.recordset[0]) || null;
    },

    async getPatientByMobile(mobile, name = null) {
      const res = await exec('dbo.usp_Patient_GetByMobile', r => r
        .input('Mobile', sql.VarChar(15), mobile)
        .input('FullName', sql.NVarChar(120), name || null));
      return rowToPatient(res.recordset[0]) || null;
    },

    async returnToTriage(tokenId, actorId) {
      const res = await exec('dbo.usp_Token_ReturnToTriage', r => r
        .input('TokenRef', sql.VarChar(16), String(tokenId).replace(/^T-/, ''))
        .input('ActorRef', sql.VarChar(16), String(actorId || '').replace(/^U-/, '')));
      return rowToToken(res.recordset[0]);
    },

    async preponeToken({ mobile, tokenNo }) {
      const res = await exec('dbo.usp_Token_Prepone', r => r
        .input('Mobile', sql.VarChar(15), mobile)
        .input('TokenNo', sql.VarChar(8), tokenNo));
      return rowToToken(res.recordset[0]);
    },

    async saveVitals(tokenId, vitals, actorId) {
      const res = await exec('dbo.usp_Vitals_Save', r => r
        .input('TokenRef', sql.VarChar(16), String(tokenId).replace(/^T-/, ''))
        .input('Bp', sql.VarChar(9), vitals.bp || null)
        .input('Pulse', sql.Int, vitals.pulse ?? null)
        .input('Temp', sql.Decimal(5, 1), vitals.temp ?? null)
        .input('Spo2', sql.Int, vitals.spo2 ?? null)
        .input('Rr', sql.Int, vitals.rr ?? null)
        .input('Weight', sql.Decimal(5, 1), vitals.weight ?? null)
        .input('Height', sql.Decimal(5, 1), vitals.height ?? null)
        .input('ActorRef', sql.VarChar(16), String(actorId || '').replace(/^U-/, '')));
      return rowToToken(res.recordset[0]);
    },

    async issueToken({ patientId, dept, priority = 'normal', category = 'normal', source = 'counter', symptoms = [], complaint = '', feeAmount = null, feeExemption = null, date = null, slot = null, triage = null }) {
      const symptomText = complaint || (symptoms.length ? symptoms.join(', ') : null);
      const res = await exec('dbo.usp_Token_Issue', r => r
        .input('PatientCode', sql.VarChar(24), patientId)
        .input('Department', sql.NVarChar(60), dept)
        .input('Priority', sql.VarChar(10), priority)
        .input('Category', sql.VarChar(10), category)
        .input('Source', sql.VarChar(8), source)
        .input('Complaint', sql.NVarChar(200), symptomText)
        .input('FeeAmount', sql.Int, feeAmount)
        .input('FeeExemption', sql.NVarChar(30), feeExemption)
        .input('TokenDate', sql.Date, date)
        .input('SlotTime', sql.Char(5), slot)
        .input('TriageLevel', sql.VarChar(6), category === 'emergency' ? (triage || 'yellow') : null));
      return rowToToken(res.recordset[0]);
    },

    async getPatientHistory(patientId) {
      const res = await exec('dbo.usp_Patient_History', r => r.input('PatientCode', sql.VarChar(24), patientId));
      return res.recordset.map(r => ({
        type: r.EventType, at: r.At, date: r.EventDate?.toISOString?.().slice(0, 10) ?? String(r.EventDate),
        title: r.Title, detail: r.Detail || '', status: r.Status || null,
        doctor: r.ByName || null, recordedBy: r.ByName || null,
      }));
    },

    async listSymptoms() {
      const res = await exec('dbo.usp_Symptom_List');
      return res.recordset.map(r => ({ code: r.Code, en: r.NameEn, hin: r.NameHin, dept: r.Department }));
    },

    async listSlots(dept, date) {
      const res = await exec('dbo.usp_Slot_List', r => r
        .input('Department', sql.NVarChar(60), dept)
        .input('OnDate', sql.Date, date || new Date().toISOString().slice(0, 10)));
      const now = new Date().toTimeString().slice(0, 5);
      const isToday = !date || date === new Date().toISOString().slice(0, 10);
      return res.recordset.map(r => ({ time: r.SlotTime, free: r.Free, past: isToday && r.SlotTime <= now }));
    },

    async checkInToken({ mobile, tokenNo }) {
      const res = await exec('dbo.usp_Token_CheckIn', r => r
        .input('Mobile', sql.VarChar(15), mobile)
        .input('TokenNo', sql.VarChar(8), tokenNo));
      return rowToToken(res.recordset[0]);
    },

    async getQueueByDept(dept) {
      const res = await exec('dbo.usp_Queue_ByDepartment', r => r.input('Department', sql.NVarChar(60), dept || null));
      return res.recordset.map(r => ({ ...rowToToken(r), patient: rowToPatient(r) }));
    },

    async getPublicQueue(dept) {
      // proc returns pre-masked names via fn_MaskName — PHI never leaves the DB
      const res = await exec('dbo.usp_Queue_PublicBoard', r => r.input('Department', sql.NVarChar(60), dept || null));
      const rows = res.recordset.map(r => ({
        tokenNo: r.TokenNo, status: r.Status, priority: r.Priority, patient: r.MaskedName,
      }));
      return {
        dept: dept || 'All',
        nowServing: rows.find(x => x.status === 'in-consult')?.tokenNo || null,
        updatedAt: new Date().toISOString(),
        rows,
      };
    },

    async updateTokenStatus(tokenId, status, actorId) {
      const res = await exec('dbo.usp_Token_UpdateStatus', r => r
        .input('TokenRef', sql.VarChar(16), String(tokenId).replace(/^T-/, ''))
        .input('NewStatus', sql.VarChar(12), status)
        .input('ActorRef', sql.VarChar(16), String(actorId || '').replace(/^U-/, '')));
      return rowToToken(res.recordset[0]);
    },

    async trackToken({ mobile, tokenNo }) {
      const res = await exec('dbo.usp_Token_Track', r => r
        .input('Mobile', sql.VarChar(15), mobile)
        .input('TokenNo', sql.VarChar(8), tokenNo));
      const row = res.recordset[0];
      if (!row) return null;
      return {
        tokenNo: row.TokenNo, dept: row.Department, status: row.Status,
        date: row.TokenDate?.toISOString?.().slice(0, 10) ?? row.TokenDate,
        slot: row.SlotTime || null, category: row.Category || 'normal',
        patientFirstName: row.FirstName, position: row.QueuePosition,
        nowServing: row.NowServing, estWaitMin: row.QueuePosition > 0 ? row.QueuePosition * 8 : 0,
        vitalsDone: !!row.VitalsDone,
        canCheckIn: !!row.CanCheckIn,
        prescriptionStatus: row.PrescriptionStatus || null
      };
    },

    async listTokensByMobile(mobile) {
      const res = await exec('dbo.usp_Token_ListByMobile', r => r.input('Mobile', sql.VarChar(15), mobile));
      return res.recordset.map(r => ({
        tokenNo: r.TokenNo, dept: r.Department,
        date: r.TokenDate?.toISOString?.().slice(0, 10) ?? r.TokenDate,
        slot: r.Slot || null, status: r.Status,
      }));
    },

    async saveConsult({ tokenId, doctorId, dx, rx, labs, dispo, notes, allergies, bloodGroup, familyHistory, pastIllness, social }) {
      const res = await exec('dbo.usp_Consult_Save', r => r
        .input('TokenRef', sql.VarChar(16), String(tokenId).replace(/^T-/, ''))
        .input('DoctorRef', sql.VarChar(16), String(doctorId || '').replace(/^U-/, ''))
        .input('Diagnosis', sql.NVarChar(400), dx || null)
        .input('RxJson', sql.NVarChar(sql.MAX), JSON.stringify(rx || []))
        .input('LabsJson', sql.NVarChar(sql.MAX), JSON.stringify(labs || []))
        .input('Disposition', sql.VarChar(12), dispo || 'home')
        .input('Notes', sql.NVarChar(sql.MAX), notes || '')
        .input('AllergiesJson', sql.NVarChar(sql.MAX), allergies?.med?.length ? JSON.stringify(allergies.med) : null)
        .input('FoodAllergiesJson', sql.NVarChar(sql.MAX), allergies?.food?.length ? JSON.stringify(allergies.food) : null)
        .input('BloodGroup', sql.VarChar(7), bloodGroup && bloodGroup !== 'Unknown' ? bloodGroup : null)
        .input('FamilyJson', sql.NVarChar(sql.MAX), familyHistory?.length ? JSON.stringify(familyHistory) : null)
        .input('PastIllnessJson', sql.NVarChar(sql.MAX), pastIllness?.length ? JSON.stringify(pastIllness) : null)
        .input('SocialJson', sql.NVarChar(sql.MAX), social?.length ? JSON.stringify(social) : null));
      const c = res.recordset[0];
      // dept drives the route's cache invalidation + SSE push
      return { id: `C-${c.ConsultId}`, tokenId, dispo: c.Disposition, completedAt: c.CompletedAt, dept: c.Department };
    },

    async listDepartments() {
      const res = await exec('dbo.usp_Department_List');
      return res.recordset.map(r => ({ code: r.Code, name: r.Name, series: r.Series }));
    },

    async audit({ actorId, action, entity, entityId, detail }) {
      await exec('dbo.usp_Audit_Insert', r => r
        .input('ActorRef', sql.VarChar(16), String(actorId || '').replace(/^U-/, ''))
        .input('Action', sql.VarChar(40), action)
        .input('Entity', sql.VarChar(30), entity)
        .input('EntityRef', sql.VarChar(30), String(entityId || ''))
        .input('Detail', sql.NVarChar(400), detail || null));
    },

    async listMedicines(facilityCode, doctorId) {
      const res = await exec('dbo.usp_Medicines_List', r => r
        .input('FacilityCode', sql.VarChar(20), facilityCode)
        .input('DoctorId', sql.Int, Number(String(doctorId).replace(/^U-/, ''))));
      return res.recordset.map(r => ({
        ...r,
        doseForms: JSON.parse(r.doseForms || '[]'),
        strengths: JSON.parse(r.strengths || '[]'),
        isQuickPick: !!r.isQuickPick,
        isControlled: !!r.isControlled
      }));
    },

    async searchMedicines(query, facilityCode) {
      const res = await exec('dbo.usp_Medicines_Search', r => r
        .input('Query', sql.NVarChar(80), query)
        .input('FacilityCode', sql.VarChar(20), facilityCode));
      return res.recordset.map(r => ({
        ...r,
        doseForms: JSON.parse(r.doseForms || '[]'),
        strengths: JSON.parse(r.strengths || '[]'),
        isControlled: !!r.isControlled
      }));
    },

    async getDoctorQuickMeds(doctorId) {
      const res = await exec('dbo.usp_DoctorMedicines_Get', r => r
        .input('DoctorId', sql.Int, Number(String(doctorId).replace(/^U-/, ''))));
      return res.recordset.map(r => ({
        ...r,
        doseForms: JSON.parse(r.doseForms || '[]'),
        strengths: JSON.parse(r.strengths || '[]'),
        isControlled: !!r.isControlled
      }));
    },

    async setDoctorQuickMeds(doctorId, medicineIds) {
      await exec('dbo.usp_DoctorMedicines_Set', r => r
        .input('DoctorId', sql.Int, Number(String(doctorId).replace(/^U-/, '')))
        .input('MedicineIdsJson', sql.NVarChar(sql.MAX), JSON.stringify(medicineIds)));
    },

    async listTemplates(doctorId) {
      const res = await exec('dbo.usp_ConsultTemplates_List', r => r
        .input('DoctorId', sql.Int, Number(String(doctorId).replace(/^U-/, ''))));
      return res.recordset.map(r => ({
        ...r,
        prescription: JSON.parse(r.prescription || '[]'),
        isSystemDefault: !!r.isSystemDefault
      }));
    },

    async getTemplate(templateId) {
      const res = await exec('dbo.usp_ConsultTemplates_Get', r => r
        .input('TemplateId', sql.Int, Number(templateId)));
      const t = res.recordset[0];
      return t ? {
        ...t,
        prescription: JSON.parse(t.prescription || '[]'),
        isSystemDefault: !!t.isSystemDefault
      } : null;
    },

    async saveTemplate(doctorId, template) {
      const res = await exec('dbo.usp_ConsultTemplates_Save', r => r
        .input('DoctorId', sql.Int, Number(String(doctorId).replace(/^U-/, '')))
        .input('TemplateId', sql.Int, template.id ? Number(template.id.replace(/^TMP-/, '')) : null)
        .input('Name', sql.NVarChar(100), template.name)
        .input('Category', sql.VarChar(40), template.category)
        .input('Complaints', sql.NVarChar(sql.MAX), template.complaints || null)
        .input('Examination', sql.NVarChar(sql.MAX), template.examination || null)
        .input('Diagnosis', sql.NVarChar(200), template.diagnosis || null)
        .input('PrescriptionJson', sql.NVarChar(sql.MAX), JSON.stringify(template.prescription || []))
        .input('Advice', sql.NVarChar(sql.MAX), template.advice || null)
        .input('FollowUp', sql.NVarChar(sql.MAX), template.followUp || null));
      const id = res.recordset[0].id;
      return { ...template, id: `TMP-${id}`, doctorId, isSystemDefault: false };
    },

    async deleteTemplate(templateId, doctorId) {
      await exec('dbo.usp_ConsultTemplates_Delete', r => r
        .input('TemplateId', sql.Int, Number(String(templateId).replace(/^TMP-/, '')))
        .input('DoctorId', sql.Int, Number(String(doctorId).replace(/^U-/, ''))));
    },

    async listFacilities() {
      const res = await exec('dbo.usp_Facilities_List');
      return res.recordset;
    },

    async getFacilityMedicines(facilityCode) {
      const res = await exec('dbo.usp_FacilityMedicines_Get', r => r
        .input('FacilityCode', sql.VarChar(20), facilityCode));
      return res.recordset.map(r => ({
        ...r,
        doseForms: JSON.parse(r.doseForms || '[]'),
        strengths: JSON.parse(r.strengths || '[]'),
        isControlled: !!r.isControlled
      }));
    },

    async listPrescriptions(filters = {}) {
      const res = await exec('dbo.usp_Prescriptions_List', r => r
        .input('Status', sql.VarChar(20), filters.status || null)
        .input('FacilityCode', sql.VarChar(20), filters.facilityCode || null));
      return res.recordset.map(r => ({
        id: `PR-${r.id}`,
        consultId: r.consultId ? `C-${r.consultId}` : null,
        tokenId: `T-${r.tokenId}`,
        patientId: `P-${r.patientId}`,
        doctorId: `U-${r.doctorId}`,
        facilityCode: r.facilityCode,
        status: r.status,
        items: JSON.parse(r.items || '[]'),
        dispensedBy: r.dispensedBy ? `U-${r.dispensedBy}` : null,
        dispensedAt: r.dispensedAt,
        doctorName: r.doctorName,
        patient: {
          id: r.PatientCode,
          name: r.patientName,
          age: r.Age,
          sex: r.Sex,
          mobile: r.Mobile
        }
      }));
    },

    async updatePrescriptionStatus(id, status, pharmacistId) {
      const res = await exec('dbo.usp_Prescriptions_UpdateStatus', r => r
        .input('PrescriptionId', sql.Int, Number(String(id).replace(/^PR-/, '')))
        .input('Status', sql.VarChar(20), status)
        .input('PharmacistId', sql.Int, Number(String(pharmacistId).replace(/^U-/, ''))));
      const row = res.recordset[0];
      return { id: `PR-${row.id}`, status: row.status };
    },

    async getAdminFlowStats(facilityCode) {
      const res = await exec('dbo.usp_Admin_FlowStats', r => r.input('FacilityCode', sql.VarChar(20), facilityCode));
      return res.recordset[0];
    },

    async getAdminQueueTimeline(facilityCode, date) {
      const res = await exec('dbo.usp_Admin_QueueTimeline', r => r
        .input('FacilityCode', sql.VarChar(20), facilityCode)
        .input('Date', sql.Date, date || null));
      return res.recordset.map(r => ({
        tokenId: `T-${r.tokenId}`,
        tokenNo: r.tokenNo,
        patientName: r.patientName,
        dept: r.dept,
        status: r.status,
        priority: r.priority,
        issuedAt: r.issuedAt,
        calledAt: r.calledAt,
        vitalsDone: !!r.vitalsDone,
        prescriptionStatus: r.prescriptionStatus
      }));
    },
  };
}
