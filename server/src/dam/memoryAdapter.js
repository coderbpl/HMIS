import bcrypt from 'bcryptjs';
import { config } from '../config.js';

/**
 * In-memory DAM adapter. Zero external dependencies — lets the whole stack run
 * on any laptop. Mirrors the MSSQL adapter's behaviour (including token
 * numbering and queue-position rules) so the UI cannot tell them apart.
 */
const DEPARTMENTS = [
  { code: 'GM', name: 'General Medicine', series: 'A' },
  { code: 'PD', name: 'Pediatrics', series: 'B' },
  { code: 'OB', name: 'Obstetrics', series: 'C' },
  { code: 'OR', name: 'Orthopedics', series: 'D' },
  { code: 'EN', name: 'ENT', series: 'E' },
];

const maskName = full => {
  const [first = '', ...rest] = String(full).trim().split(/\s+/);
  const head = first.length <= 2 ? first : `${first[0]}${'*'.repeat(Math.max(first.length - 2, 1))}${first[first.length - 1]}`;
  return rest.length ? `${head} ${rest[rest.length - 1][0]}.` : head;
};

/** Symptom → department routing. Patients pick symptoms; the dept follows. */
const SYMPTOMS = [
  { code: 'fever', en: 'Fever / cough', hin: 'बुखार / खांसी', dept: 'General Medicine' },
  { code: 'chest', en: 'Chest pain', hin: 'छाती में दर्द', dept: 'General Medicine' },
  { code: 'stomach', en: 'Stomach pain', hin: 'पेट दर्द', dept: 'General Medicine' },
  { code: 'bone', en: 'Bone / joint pain', hin: 'हड्डी / जोड़ दर्द', dept: 'Orthopedics' },
  { code: 'child', en: "Child's illness", hin: 'बच्चे की समस्या', dept: 'Pediatrics' },
  { code: 'pregnancy', en: 'Pregnancy care', hin: 'गर्भावस्था', dept: 'Obstetrics' },
  { code: 'ent', en: 'Ear / nose / throat', hin: 'कान / नाक / गला', dept: 'ENT' },
  { code: 'skin', en: 'Skin problem', hin: 'त्वचा समस्या', dept: 'General Medicine' },
];

/** Advance-booking slots: fixed OPD half-hours, fixed capacity per slot. */
const SLOT_TIMES = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30'];
const SLOT_CAPACITY = 6;
const BOOKED_GRACE_MIN = 60; // unclaimed self-service tokens expire after this

export function createMemoryAdapter() {
  const db = { 
    users: [], 
    patients: [], 
    tokens: [], 
    consults: [], 
    audits: [],
    facilities: [],
    medicines: [],
    facilityMedicines: [],
    doctorMedicines: [],
    consultTemplates: [],
    prescriptions: []
  };
  let seq = { patient: 24076, token: 0, consult: 0, template: 0, prescription: 1, uhid: {} }; // PR-1 is seeded
  const today = () => new Date().toISOString().slice(0, 10);

  const seedPatient = (p) => { db.patients.push(p); return p; };
  const seedToken = (tokenNo, patientId, dept, status, priority = 'normal', vitalsDone = true) => {
    const t = {
      id: `T-${++seq.token}`, tokenNo, patientId, dept, date: today(),
      status, priority, vitalsDone, issuedAt: new Date().toISOString(),
    };
    db.tokens.push(t); return t;
  };

  return {
    async init() {
      const passHash = await bcrypt.hash(config.seedPassword, 10);
      db.users = [
        { id: 'U-1', username: 'dr.ravi', name: 'Dr. Ravi Verma', role: 'doctor', facilityCode: 'DIST_HOSP_01', passHash },
        { id: 'U-2', username: 'nurse.meena', name: 'Sr. Meena Joshi', role: 'nurse', facilityCode: 'DIST_HOSP_01', passHash },
        { id: 'U-3', username: 'frontdesk.rahul', name: 'Rahul Sen', role: 'reception', facilityCode: 'DIST_HOSP_01', passHash },
        { id: 'U-4', username: 'pharm.vikas', name: 'Vikas Rao', role: 'pharmacy', facilityCode: 'DIST_HOSP_01', passHash },
        { id: 'U-5', username: 'admin.sk', name: 'Dr. S. Kulkarni', role: 'admin', facilityCode: 'DIST_HOSP_01', passHash },
      ];
      
      // state / district / short codes feed the UHID: MP-BPL-DH01-26-00001
      db.facilities = [
        { code: 'DIST_HOSP_01', name: 'District Hospital, Bhopal', type: 'District Hospital', address: 'Bhopal', state: 'MP', district: 'BPL', short: 'DH01' },
        { code: 'PHC_AHD_02', name: 'Primary Health Centre, Anand Nagar', type: 'PHC', address: 'Anand Nagar', state: 'MP', district: 'BPL', short: 'PH02' },
        { code: 'CHC_COL_03', name: 'Community Health Centre, Kolar', type: 'CHC', address: 'Kolar', state: 'MP', district: 'BPL', short: 'CH03' }
      ];

      db.medicines = [
        { id: 'M-01', name: 'Paracetamol 500mg', genericName: 'Paracetamol', category: 'Analgesics', doseForms: ['tablet', 'syrup'], strengths: ['500mg', '125mg/5ml'], defaultRoute: 'oral', defaultFrequency: 'TDS', defaultDuration: '3 days', isControlled: false },
        { id: 'M-02', name: 'Ibuprofen 400mg', genericName: 'Ibuprofen', category: 'Analgesics', doseForms: ['tablet'], strengths: ['400mg'], defaultRoute: 'oral', defaultFrequency: 'BD', defaultDuration: '3 days', isControlled: false },
        { id: 'M-03', name: 'Amoxicillin 500mg', genericName: 'Amoxicillin', category: 'Antibiotics', doseForms: ['capsule', 'syrup'], strengths: ['500mg', '250mg/5ml'], defaultRoute: 'oral', defaultFrequency: 'TDS', defaultDuration: '5 days', isControlled: false },
        { id: 'M-04', name: 'Azithromycin 500mg', genericName: 'Azithromycin', category: 'Antibiotics', doseForms: ['tablet'], strengths: ['500mg', '250mg'], defaultRoute: 'oral', defaultFrequency: 'OD', defaultDuration: '3 days', isControlled: false },
        { id: 'M-05', name: 'Cetirizine 10mg', genericName: 'Cetirizine', category: 'Antihistamines', doseForms: ['tablet'], strengths: ['10mg'], defaultRoute: 'oral', defaultFrequency: 'HS', defaultDuration: '5 days', isControlled: false },
        { id: 'M-06', name: 'Metformin 500mg', genericName: 'Metformin', category: 'Antidiabetics', doseForms: ['tablet'], strengths: ['500mg', '850mg', '1000mg'], defaultRoute: 'oral', defaultFrequency: 'BD', defaultDuration: '30 days', isControlled: false },
        { id: 'M-07', name: 'Glimepiride 2mg', genericName: 'Glimepiride', category: 'Antidiabetics', doseForms: ['tablet'], strengths: ['1mg', '2mg'], defaultRoute: 'oral', defaultFrequency: 'OD', defaultDuration: '30 days', isControlled: false },
        { id: 'M-08', name: 'Telmisartan 40mg', genericName: 'Telmisartan', category: 'Antihypertensives', doseForms: ['tablet'], strengths: ['20mg', '40mg', '80mg'], defaultRoute: 'oral', defaultFrequency: 'OD', defaultDuration: '30 days', isControlled: false },
        { id: 'M-09', name: 'Amlodipine 5mg', genericName: 'Amlodipine', category: 'Antihypertensives', doseForms: ['tablet'], strengths: ['2.5mg', '5mg', '10mg'], defaultRoute: 'oral', defaultFrequency: 'OD', defaultDuration: '30 days', isControlled: false },
        { id: 'M-10', name: 'Pantoprazole 40mg', genericName: 'Pantoprazole', category: 'Gastrointestinal', doseForms: ['tablet'], strengths: ['40mg'], defaultRoute: 'oral', defaultFrequency: 'OD', defaultDuration: '10 days', isControlled: false },
        { id: 'M-11', name: 'Ranitidine 150mg', genericName: 'Ranitidine', category: 'Gastrointestinal', doseForms: ['tablet'], strengths: ['150mg', '300mg'], defaultRoute: 'oral', defaultFrequency: 'BD', defaultDuration: '7 days', isControlled: false },
        { id: 'M-12', name: 'Atorvastatin 10mg', genericName: 'Atorvastatin', category: 'Cardiovascular', doseForms: ['tablet'], strengths: ['10mg', '20mg', '40mg'], defaultRoute: 'oral', defaultFrequency: 'HS', defaultDuration: '30 days', isControlled: false },
        { id: 'M-13', name: 'Salbutamol Inhaler', genericName: 'Salbutamol', category: 'Respiratory', doseForms: ['inhaler'], strengths: ['100mcg/puff'], defaultRoute: 'inhalation', defaultFrequency: 'PRN', defaultDuration: '15 days', isControlled: false },
        { id: 'M-14', name: 'Montelukast 10mg', genericName: 'Montelukast', category: 'Respiratory', doseForms: ['tablet'], strengths: ['10mg', '5mg'], defaultRoute: 'oral', defaultFrequency: 'HS', defaultDuration: '10 days', isControlled: false },
        { id: 'M-15', name: 'Amoxicillin + Clavulanic Acid 625mg', genericName: 'Amoxicillin + Clavulanic Acid', category: 'Antibiotics', doseForms: ['tablet'], strengths: ['625mg', '375mg'], defaultRoute: 'oral', defaultFrequency: 'BD', defaultDuration: '5 days', isControlled: false },
        { id: 'M-16', name: 'Ciprofloxacin 500mg', genericName: 'Ciprofloxacin', category: 'Antibiotics', doseForms: ['tablet'], strengths: ['500mg'], defaultRoute: 'oral', defaultFrequency: 'BD', defaultDuration: '5 days', isControlled: false },
        { id: 'M-17', name: 'ORSalts (ORS) sachet', genericName: 'Oral Rehydration Salts', category: 'Gastrointestinal', doseForms: ['powder'], strengths: ['20.5g'], defaultRoute: 'oral', defaultFrequency: 'PRN', defaultDuration: '3 days', isControlled: false },
        { id: 'M-18', name: 'Loperamide 2mg', genericName: 'Loperamide', category: 'Gastrointestinal', doseForms: ['capsule'], strengths: ['2mg'], defaultRoute: 'oral', defaultFrequency: 'STAT', defaultDuration: '1 day', isControlled: false },
        { id: 'M-19', name: 'Morphine 10mg', genericName: 'Morphine', category: 'Analgesics', doseForms: ['tablet', 'injection'], strengths: ['10mg', '15mg/ml'], defaultRoute: 'oral', defaultFrequency: 'TDS', defaultDuration: '2 days', isControlled: true },
        { id: 'M-20', name: 'Insulin Glargine 100 IU/ml', genericName: 'Insulin Glargine', category: 'Antidiabetics', doseForms: ['injection'], strengths: ['100 IU/ml'], defaultRoute: 'subcutaneous', defaultFrequency: 'OD', defaultDuration: '30 days', isControlled: false },
        { id: 'M-21', name: 'Multivitamin', genericName: 'Multivitamin', category: 'Others', doseForms: ['tablet'], strengths: ['1 tab'], defaultRoute: 'oral', defaultFrequency: 'OD', defaultDuration: '30 days', isControlled: false },
        { id: 'M-22', name: 'Folic Acid 5mg', genericName: 'Folic Acid', category: 'Others', doseForms: ['tablet'], strengths: ['5mg'], defaultRoute: 'oral', defaultFrequency: 'OD', defaultDuration: '90 days', isControlled: false },
        { id: 'M-23', name: 'Calcium Carbonate + Vit D3', genericName: 'Calcium + Vitamin D3', category: 'Others', doseForms: ['tablet'], strengths: ['500mg'], defaultRoute: 'oral', defaultFrequency: 'OD', defaultDuration: '30 days', isControlled: false },
        { id: 'M-24', name: 'Iron + Folic Acid (IFA)', genericName: 'Iron + Folic Acid', category: 'Others', doseForms: ['tablet'], strengths: ['100mg Iron + 0.5mg FA'], defaultRoute: 'oral', defaultFrequency: 'OD', defaultDuration: '90 days', isControlled: false },
        { id: 'M-25', name: 'Diclofenac 50mg', genericName: 'Diclofenac', category: 'Analgesics', doseForms: ['tablet', 'gel'], strengths: ['50mg', '1% gel'], defaultRoute: 'oral', defaultFrequency: 'BD', defaultDuration: '5 days', isControlled: false }
      ];

      // Populate facilityMedicines
      db.facilityMedicines = [];
      db.medicines.forEach(m => {
        db.facilityMedicines.push({ facilityCode: 'DIST_HOSP_01', medicineId: m.id });
      });

      const phcMeds = ['M-01', 'M-02', 'M-03', 'M-04', 'M-05', 'M-06', 'M-07', 'M-08', 'M-09', 'M-10', 'M-11', 'M-13', 'M-14', 'M-17', 'M-18', 'M-21', 'M-22', 'M-23', 'M-24', 'M-25'];
      phcMeds.forEach(mId => {
        db.facilityMedicines.push({ facilityCode: 'PHC_AHD_02', medicineId: mId });
      });

      db.medicines.filter(m => m.id !== 'M-19').forEach(m => {
        db.facilityMedicines.push({ facilityCode: 'CHC_COL_03', medicineId: m.id });
      });

      db.doctorMedicines = [
        { doctorId: 'U-1', medicineId: 'M-01', isQuickPick: true },
        { doctorId: 'U-1', medicineId: 'M-03', isQuickPick: true },
        { doctorId: 'U-1', medicineId: 'M-05', isQuickPick: true },
        { doctorId: 'U-1', medicineId: 'M-06', isQuickPick: true },
        { doctorId: 'U-1', medicineId: 'M-08', isQuickPick: true },
        { doctorId: 'U-1', medicineId: 'M-10', isQuickPick: true },
        { doctorId: 'U-1', medicineId: 'M-17', isQuickPick: true }
      ];

      db.consultTemplates = [
        {
          id: 'TMP-system-urti',
          doctorId: null,
          name: 'URTI (Common Cold)',
          category: 'General Medicine',
          isSystemDefault: true,
          complaints: 'Sore throat, nasal congestion, runny nose, low-grade fever for 2 days.',
          examination: 'Throat congestion (+), chest clear, no lymphadenopathy.',
          diagnosis: 'Acute Upper Respiratory Tract Infection (URTI)',
          prescription: [
            { name: 'Paracetamol 500mg', dose: '1-0-1', route: 'oral', frequency: 'BD', duration: '3 days', qty: 6 },
            { name: 'Cetirizine 10mg', dose: '0-0-1', route: 'oral', frequency: 'HS', duration: '5 days', qty: 5 }
          ],
          advice: 'Warm water gargling TDS. Warm fluids. Rest.',
          followUp: 'OPD review if fever persists > 3 days.'
        },
        {
          id: 'TMP-system-ge',
          doctorId: null,
          name: 'Acute Gastroenteritis',
          category: 'General Medicine',
          isSystemDefault: true,
          complaints: 'Watery diarrhea 4-5 times, vomiting 2 times, abdominal cramps since yesterday.',
          examination: 'Mild dehydration (+), abdomen soft, hyperactive bowel sounds.',
          diagnosis: 'Acute Gastroenteritis',
          prescription: [
            { name: 'ORSalts (ORS) sachet', dose: 'SOS', route: 'oral', frequency: 'SOS', duration: '3 days', qty: 5 },
            { name: 'Loperamide 2mg', dose: '1-0-0', route: 'oral', frequency: 'STAT', duration: '1 day', qty: 1 }
          ],
          advice: 'Drink ORS after every loose motion. Light diet (khichdi). Avoid dairy.',
          followUp: 'Return immediately if vomiting prevents oral intake or blood in stool.'
        },
        {
          id: 'TMP-system-htn',
          doctorId: null,
          name: 'Hypertension Follow-Up',
          category: 'General Medicine',
          isSystemDefault: true,
          complaints: 'Routine follow-up. No headache, chest pain, or dyspnea.',
          examination: 'BP: 130/80 mmHg, pulse: 76 bpm. S1 S2 normal.',
          diagnosis: 'Essential Hypertension',
          prescription: [
            { name: 'Telmisartan 40mg', dose: '1-0-0', route: 'oral', frequency: 'OD', duration: '30 days', qty: 30 }
          ],
          advice: 'Salt restricted diet. Daily walking 30 mins. Monitor BP weekly.',
          followUp: 'Review with BP chart in 1 month.'
        }
      ];

      const base = { lastVisit: 'First visit', meds: [], conditions: [], allergies: [] };
      seedPatient({ ...base, id: 'P-24071', abha: '91-4523-8871-2210', name: 'Ramesh Patel', mobile: '9800000001', age: 54, sex: 'M', dept: 'General Medicine', complaint: 'Chest discomfort, breathlessness on exertion (3 days)', allergies: ['Penicillin'], conditions: ['Type 2 Diabetes (2016)', 'Hypertension (2019)'], bp: '148/94', pulse: 96, temp: 99.1, spo2: 94, rr: 20, weight: 78, lastVisit: '02 Jun 2026', meds: ['Metformin 500 mg BD', 'Telmisartan 40 mg OD'] });
      seedPatient({ ...base, id: 'P-24072', abha: '91-8810-2245-9034', name: 'Sunita Devi', mobile: '9800000002', age: 32, sex: 'F', dept: 'Obstetrics', complaint: 'ANC check-up, 28 weeks, mild pedal edema', conditions: ['G2P1 · 28 wks'], bp: '118/76', pulse: 84, temp: 98.4, spo2: 98, rr: 16, weight: 64, lastVisit: '20 Jun 2026', meds: ['IFA tablets OD', 'Calcium 500 mg OD'] });
      seedPatient({ ...base, id: 'P-24073', abha: '91-3312-7789-4456', name: 'Arjun Malhotra', mobile: '9800000003', age: 8, sex: 'M', dept: 'General Medicine', complaint: 'High fever with rash, 2 days', bp: '100/64', pulse: 110, temp: 102.3, spo2: 97, rr: 24, weight: 24 });
      seedPatient({ ...base, id: 'P-24074', abha: '91-9902-1123-8867', name: 'Fatima Begum', mobile: '9800000004', age: 61, sex: 'F', dept: 'Orthopedics', complaint: 'Left knee pain, difficulty climbing stairs', allergies: ['Sulfa drugs'], conditions: ['Osteoarthritis (2021)'], bp: '132/86', pulse: 78, temp: 98.2, spo2: 97, rr: 16, weight: 70, lastVisit: '11 May 2026', meds: ['Glucosamine OD'] });
      seedPatient({ ...base, id: 'P-24075', abha: '91-5567-3390-1272', name: 'Mohan Lal', mobile: '9800000005', age: 45, sex: 'M', dept: 'General Medicine', complaint: 'Follow-up: fatty liver, deranged LFT', conditions: ['NAFLD (2024)'], bp: '126/82', pulse: 74, temp: 98.6, spo2: 98, rr: 15, weight: 88, lastVisit: '28 May 2026', meds: ['Ursodeoxycholic acid 300 BD'] });
      seedPatient({ ...base, id: 'P-24076', abha: '91-2231-9987-3345', name: 'Kavita Sharma', mobile: '9800000006', age: 27, sex: 'F', dept: 'ENT', complaint: 'Recurrent sore throat and ear fullness', bp: '112/74', pulse: 80, temp: 99.0, spo2: 99, rr: 15, weight: 55 });

      seq.token = 13;
      seedToken('A-14', 'P-24071', 'General Medicine', 'in-consult');
      seedToken('A-15', 'P-24073', 'General Medicine', 'waiting', 'urgent');
      seedToken('A-16', 'P-24075', 'General Medicine', 'waiting');
      seedToken('C-04', 'P-24072', 'Obstetrics', 'waiting');
      seedToken('D-07', 'P-24074', 'Orthopedics', 'waiting', 'normal', false);
      seedToken('E-03', 'P-24076', 'ENT', 'checked-in', 'normal', false);

      db.prescriptions = [
        {
          id: 'PR-1',
          consultId: 'C-mock-1',
          tokenId: 'T-14',
          patientId: 'P-24071',
          doctorId: 'U-1',
          facilityCode: 'DIST_HOSP_01',
          status: 'pending',
          items: [
            { name: 'Metformin 500mg', dose: '1-0-1', route: 'oral', frequency: 'BD', duration: '30 days', qty: 60 },
            { name: 'Telmisartan 40mg', dose: '1-0-0', route: 'oral', frequency: 'OD', duration: '30 days', qty: 30 }
          ],
          dispensedBy: null,
          dispensedAt: null
        }
      ];
    },

    async getUserByUsername(username) {
      return db.users.find(u => u.username === username) || null;
    },

    async getUserById(id) {
      const u = db.users.find(x => x.id === id);
      return u ? { id: u.id, username: u.username, name: u.name, role: u.role, facilityCode: u.facilityCode || null } : null;
    },

    /**
     * UHID format: {STATE}-{DISTRICT}-{FACILITY}-{YY}-{SEQ}
     * e.g. MP-BPL-DH01-26-00001 — unique across every facility state-wide,
     * human-readable on a slip, and the prefix tells you where the patient
     * was first registered. Sequence resets per facility per year.
     * (Legacy seed patients keep their old P-xxxxx ids.)
     */
    async createPatient({ name, mobile, age, sex, dept, abha, scheme, facilityCode }) {
      const fac = db.facilities.find(f => f.code === facilityCode) || db.facilities[0];
      const yy = String(new Date().getFullYear()).slice(-2);
      const key = `${fac.code}-${yy}`;
      seq.uhid[key] = (seq.uhid[key] || 0) + 1;
      const uhid = `${fac.state}-${fac.district}-${fac.short}-${yy}-${String(seq.uhid[key]).padStart(5, '0')}`;
      const p = {
        id: uhid, name,
        mobile: mobile || null,                                   // null for unknown emergency patients
        age: age === null || age === undefined || age === '' ? null : Number(age),
        sex,
        dept, abha: abha || null, scheme: scheme || null,
        facilityCode: fac.code,
        complaint: '', allergies: [], conditions: [], meds: [],
        lastVisit: 'First visit', createdAt: new Date().toISOString(),
      };
      db.patients.push(p);
      return p;
    },

    async searchPatients(query) {
      const q = String(query || '').toLowerCase();
      if (!q) return [];
      return db.patients
        .filter(p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || (p.mobile || '').includes(q))
        .slice(0, 20);
    },

    async getPatientById(id) {
      return db.patients.find(p => p.id === id) || null;
    },

    async getPatientByAbha(abha) {
      const norm = String(abha).replace(/\D/g, '');
      return db.patients.find(p => p.abha && p.abha.replace(/\D/g, '') === norm) || null;
    },

    /**
     * Families share one mobile, so a mobile can map to several patients.
     * With a name: return the same-mobile patient whose name matches
     * (case-insensitive), or null so the caller registers a new record.
     * Without a name: first match (returning-patient quick path).
     */
    async getPatientByMobile(mobile, name = null) {
      if (!mobile) return null; // never match the null mobiles of unknown emergency patients
      const matches = db.patients.filter(p => p.mobile && String(p.mobile) === String(mobile));
      if (!name) return matches[0] || null;
      const norm = String(name).trim().toLowerCase().replace(/\s+/g, ' ');
      return matches.find(p => p.name.trim().toLowerCase().replace(/\s+/g, ' ') === norm) || null;
    },

    async saveVitals(tokenId, vitals, actorId) {
      const t = db.tokens.find(x => x.id === tokenId || x.tokenNo === tokenId);
      if (!t) throw Object.assign(new Error('Token not found'), { status: 404 });
      const p = db.patients.find(x => x.id === t.patientId);
      Object.assign(p, {
        bp: vitals.bp ?? p.bp, pulse: vitals.pulse ?? p.pulse, temp: vitals.temp ?? p.temp,
        spo2: vitals.spo2 ?? p.spo2, rr: vitals.rr ?? p.rr, weight: vitals.weight ?? p.weight,
        height: vitals.height ?? p.height,
        vitalsAt: new Date().toISOString(),
      });
      t.vitalsDone = true;
      await this.audit({ actorId, action: 'vitals.save', entity: 'token', entityId: t.id, detail: vitals.bp || '' });
      return { ...t, patient: p };
    },

    async issueToken({ patientId, dept, priority = 'normal', category = 'normal', source = 'counter', symptoms = [], complaint = '', feeAmount = null, feeExemption = null, date = null, slot = null }) {
      const d = DEPARTMENTS.find(x => x.name === dept);
      if (!d) throw Object.assign(new Error('Unknown department'), { status: 400 });
      const targetDate = date || today();
      if (targetDate < today()) throw Object.assign(new Error('Cannot book a past date'), { status: 400 });

      // one active token per patient per date
      const dup = db.tokens.find(t => t.patientId === patientId && t.date === targetDate && !['done', 'cancelled'].includes(t.status));
      if (dup) throw Object.assign(new Error(`Already holds token ${dup.tokenNo} for ${targetDate === today() ? 'today' : targetDate}`), { status: 409, token: dup });

      if (slot) {
        if (!SLOT_TIMES.includes(slot)) throw Object.assign(new Error('Unknown slot'), { status: 400 });
        const taken = db.tokens.filter(t => t.dept === dept && t.date === targetDate && t.slot === slot && t.status !== 'cancelled').length;
        if (taken >= SLOT_CAPACITY) throw Object.assign(new Error('Slot is full — pick another'), { status: 409 });
      }

      const dateTokens = db.tokens.filter(t => t.dept === dept && t.date === targetDate);
      const nextNo = dateTokens.reduce((m, t) => Math.max(m, Number(t.tokenNo.split('-')[1])), 0) + 1;
      const symptomText = symptoms
        .map(c => SYMPTOMS.find(s => s.code === c)?.en).filter(Boolean).join(', ');
      const t = {
        id: `T-${++seq.token}`, tokenNo: `${d.series}-${String(nextNo).padStart(2, '0')}`,
        patientId, dept, date: targetDate,
        // self-service and advance bookings wait for arrival check-in
        status: (source === 'self' || targetDate > today()) ? 'booked' : 'waiting',
        priority: category === 'emergency' ? 'urgent' : priority,
        category, source, slot,
        complaint: complaint || symptomText || '',
        feeAmount, feeExemption,
        vitalsDone: false, issuedAt: new Date().toISOString(),
      };
      db.tokens.push(t);
      return t;
    },

    /** Recovery lookup: every live token for a mobile, today or upcoming.
     *  Callers must have proved mobile ownership (OTP) before using this. */
    async listTokensByMobile(mobile) {
      this.expireStaleBookings();
      const pids = db.patients.filter(p => String(p.mobile) === String(mobile)).map(p => p.id);
      return db.tokens
        .filter(t => pids.includes(t.patientId) && t.date >= today() && t.status !== 'cancelled')
        .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id, undefined, { numeric: true }))
        .map(t => ({ tokenNo: t.tokenNo, dept: t.dept, date: t.date, slot: t.slot || null, status: t.status }));
    },

    /** Unclaimed self-service tokens lapse after the grace period. */
    expireStaleBookings() {
      const now = Date.now();
      db.tokens.forEach(t => {
        if (t.status !== 'booked' || t.date !== today()) return;
        const anchor = t.slot
          ? new Date(`${t.date}T${t.slot}:00`).getTime()
          : new Date(t.issuedAt).getTime();
        if (now - anchor > BOOKED_GRACE_MIN * 60 * 1000) t.status = 'cancelled';
      });
    },

    async getQueueByDept(dept) {
      this.expireStaleBookings();
      return db.tokens
        .filter(t => t.date === today() && (!dept || t.dept === dept) && !['done', 'cancelled'].includes(t.status))
        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
        .map(t => {
          const patient = db.patients.find(p => p.id === t.patientId) || null;
          return { ...t, patient: patient ? { ...patient, complaint: t.complaint || patient.complaint } : null };
        });
    },

    async listSymptoms() { return SYMPTOMS; },

    async listSlots(dept, date) {
      const d = date || today();
      return SLOT_TIMES.map(time => {
        const taken = db.tokens.filter(t => t.dept === dept && t.date === d && t.slot === time && t.status !== 'cancelled').length;
        const past = d === today() && time <= new Date().toTimeString().slice(0, 5);
        return { time, free: Math.max(0, SLOT_CAPACITY - taken), past };
      });
    },

    async checkInToken({ mobile, tokenNo }, actorId = null) {
      this.expireStaleBookings();
      const t = db.tokens.find(x => x.tokenNo.toUpperCase() === String(tokenNo).toUpperCase() && x.date === today() && x.status === 'booked');
      if (!t) throw Object.assign(new Error('No booked token for today with that number — it may have lapsed'), { status: 404 });
      const p = db.patients.find(x => x.id === t.patientId);
      if (!p || String(p.mobile) !== String(mobile)) throw Object.assign(new Error('Mobile number does not match this token'), { status: 403 });
      t.status = 'waiting';
      t.arrivedAt = new Date().toISOString();
      await this.audit({ actorId, action: 'token.check-in', entity: 'token', entityId: t.id, detail: t.tokenNo });
      return t;
    },

    /** Doctor sends the patient back to nursing: vitals wiped, token returns
     *  to the triage queue and leaves the doctor's list. */
    async returnToTriage(tokenId, actorId) {
      const t = db.tokens.find(x => x.id === tokenId || x.tokenNo === tokenId);
      if (!t) throw Object.assign(new Error('Token not found'), { status: 404 });
      if (!['waiting', 'in-consult'].includes(t.status)) {
        throw Object.assign(new Error(`Cannot send a ${t.status} token back to triage`), { status: 409 });
      }
      t.status = 'waiting';
      t.vitalsDone = false;
      await this.audit({ actorId, action: 'token.triage-return', entity: 'token', entityId: t.id, detail: t.tokenNo });
      return { ...t, patient: db.patients.find(p => p.id === t.patientId) || null };
    },

    /** Advance booking → today: cancels the future token and issues a fresh
     *  one in today's series (same dept). Mobile must match the booking. */
    async preponeToken({ mobile, tokenNo }) {
      this.expireStaleBookings();
      const t = db.tokens.find(x =>
        x.tokenNo.toUpperCase() === String(tokenNo).toUpperCase() &&
        x.date > today() && x.status === 'booked');
      if (!t) throw Object.assign(new Error('No upcoming booking with that token number'), { status: 404 });
      const p = db.patients.find(x => x.id === t.patientId);
      if (!p || String(p.mobile) !== String(mobile)) {
        throw Object.assign(new Error('Mobile number does not match this booking'), { status: 403 });
      }
      const fresh = await this.issueToken({
        patientId: t.patientId, dept: t.dept, priority: t.priority,
        category: t.category, source: 'self', complaint: t.complaint,
      });
      t.status = 'cancelled';
      await this.audit({ actorId: null, action: 'token.prepone', entity: 'token', entityId: fresh.id, detail: `${t.tokenNo} (${t.date}) → ${fresh.tokenNo} today` });
      return fresh;
    },

    async getPublicQueue(dept) {
      // booked-but-not-arrived tokens stay off the public board
      const rows = (await this.getQueueByDept(dept)).filter(t => t.status !== 'booked');
      const nowServing = rows.find(t => t.status === 'in-consult')?.tokenNo || null;
      return {
        dept: dept || 'All',
        nowServing,
        updatedAt: new Date().toISOString(),
        rows: rows.map(t => ({
          tokenNo: t.tokenNo,
          status: t.status,
          priority: t.priority,
          patient: t.patient ? maskName(t.patient.name) : null, // masked — no PHI on public board
        })),
      };
    },

    async updateTokenStatus(tokenId, status, actorId) {
      const t = db.tokens.find(x => x.id === tokenId || x.tokenNo === tokenId);
      if (!t) throw Object.assign(new Error('Token not found'), { status: 404 });
      const allowed = { booked: ['waiting', 'cancelled'], 'checked-in': ['waiting'], waiting: ['in-consult', 'checked-in'], 'in-consult': ['done', 'waiting'] };
      if (!(allowed[t.status] || []).includes(status)) {
        throw Object.assign(new Error(`Cannot move token from ${t.status} to ${status}`), { status: 409 });
      }
      if (status === 'in-consult') {
        // triage gate: no patient reaches the doctor before vitals are recorded
        // (emergencies bypass — treatment first, paperwork later)
        if (!t.vitalsDone && t.category !== 'emergency') {
          throw Object.assign(new Error(`Vitals pending for ${t.tokenNo} — patient must pass triage first`), { status: 409 });
        }
        // one patient in consult per department at a time
        db.tokens.filter(x => x.dept === t.dept && x.status === 'in-consult' && x.id !== t.id)
          .forEach(x => { x.status = 'waiting'; });
        t.calledAt = new Date().toISOString();
      }
      t.status = status;
      await this.audit({ actorId, action: 'token.status', entity: 'token', entityId: t.id, detail: status });
      return t;
    },

    async trackToken({ mobile, tokenNo }) {
      this.expireStaleBookings();
      // today's token first, else the nearest future booking with that number
      const matches = db.tokens
        .filter(x => x.date >= today() && x.status !== 'cancelled' && x.tokenNo.toUpperCase() === String(tokenNo).toUpperCase())
        .sort((a, b) => a.date.localeCompare(b.date));
      const t = matches[0];
      if (!t) return null;
      const p = db.patients.find(x => x.id === t.patientId);
      if (!p || String(p.mobile) !== String(mobile)) return null; // both must match — token no alone reveals nothing
      const queue = await this.getQueueByDept(t.dept);
      const position = t.status === 'waiting'
        ? queue.filter(x => x.status === 'waiting').findIndex(x => x.id === t.id) + 1
        : 0;
      return {
        tokenNo: t.tokenNo,
        dept: t.dept,
        date: t.date,
        slot: t.slot || null,
        status: t.status,
        category: t.category || 'normal',
        patientFirstName: p.name.split(' ')[0],
        position,
        nowServing: queue.find(x => x.status === 'in-consult')?.tokenNo || null,
        estWaitMin: position > 0 ? position * 8 : 0,
        vitalsDone: t.vitalsDone,
        canCheckIn: t.status === 'booked' && t.date === today(),
        prescriptionStatus: db.prescriptions.find(pr => pr.tokenId === t.id)?.status || null
      };
    },

    async saveConsult({ tokenId, doctorId, dx, rx, labs, dispo, notes, allergies, bloodGroup, familyHistory, pastIllness, social }) {
      const t = db.tokens.find(x => x.id === tokenId || x.tokenNo === tokenId);
      if (!t) throw Object.assign(new Error('Token not found'), { status: 404 });
      const c = {
        id: `C-${++seq.consult}`, tokenId: t.id, patientId: t.patientId, doctorId,
        dx: dx || null, rx: rx || [], labs: labs || [], dispo: dispo || 'home',
        notes: notes || '', completedAt: new Date().toISOString(),
      };
      db.consults.push(c);
      t.status = 'done';

      // clinical context recorded during the consult lives on the patient record
      const pat = db.patients.find(x => x.id === t.patientId);
      if (pat) {
        if (allergies) {
          pat.allergies = [...new Set([...(pat.allergies || []), ...allergies.med])];
          pat.foodAllergies = [...new Set([...(pat.foodAllergies || []), ...allergies.food])];
        }
        if (bloodGroup && bloodGroup !== 'Unknown') pat.bloodGroup = bloodGroup;
        if (familyHistory?.length) pat.familyHistory = familyHistory;
        if (pastIllness?.length) pat.conditions = [...new Set([...(pat.conditions || []), ...pastIllness])];
        if (social?.length) pat.social = social;
      }
      
      if (rx && rx.length > 0) {
        const doctor = db.users.find(u => u.id === doctorId);
        db.prescriptions.push({
          id: `PR-${++seq.prescription}`,
          consultId: c.id,
          tokenId: t.id,
          patientId: t.patientId,
          doctorId,
          facilityCode: doctor?.facilityCode || 'DIST_HOSP_01',
          status: 'pending',
          items: rx,
          dispensedBy: null,
          dispensedAt: null
        });
      }
      
      await this.audit({ actorId: doctorId, action: 'consult.save', entity: 'consult', entityId: c.id, detail: c.dispo });
      return { ...c, dept: t.dept };
    },

    async listDepartments() { return DEPARTMENTS; },

    async audit({ actorId, action, entity, entityId, detail }) {
      db.audits.push({ at: new Date().toISOString(), actorId, action, entity, entityId, detail });
    },

    async listMedicines(facilityCode, doctorId) {
      const facMeds = db.facilityMedicines.filter(fm => fm.facilityCode === facilityCode).map(fm => fm.medicineId);
      const docMeds = db.doctorMedicines.filter(dm => dm.doctorId === doctorId && dm.isQuickPick).map(dm => dm.medicineId);
      return db.medicines
        .filter(m => facMeds.includes(m.id))
        .map(m => ({
          ...m,
          isQuickPick: docMeds.includes(m.id)
        }));
    },

    async searchMedicines(query, facilityCode) {
      const q = String(query || '').toLowerCase();
      const facMeds = db.facilityMedicines.filter(fm => fm.facilityCode === facilityCode).map(fm => fm.medicineId);
      return db.medicines
        .filter(m => facMeds.includes(m.id) && (m.name.toLowerCase().includes(q) || m.genericName.toLowerCase().includes(q)))
        .slice(0, 20);
    },

    async getDoctorQuickMeds(doctorId) {
      const docMeds = db.doctorMedicines.filter(dm => dm.doctorId === doctorId && dm.isQuickPick).map(dm => dm.medicineId);
      return db.medicines.filter(m => docMeds.includes(m.id));
    },

    async setDoctorQuickMeds(doctorId, medicineIds) {
      db.doctorMedicines = db.doctorMedicines.filter(dm => dm.doctorId !== doctorId);
      medicineIds.forEach(mId => {
        db.doctorMedicines.push({ doctorId, medicineId: mId, isQuickPick: true });
      });
    },

    async listTemplates(doctorId) {
      return db.consultTemplates.filter(t => t.doctorId === doctorId || t.isSystemDefault);
    },

    async getTemplate(templateId) {
      return db.consultTemplates.find(t => t.id === templateId) || null;
    },

    async saveTemplate(doctorId, template) {
      if (template.id) {
        const idx = db.consultTemplates.findIndex(t => t.id === template.id);
        if (idx !== -1) {
          if (db.consultTemplates[idx].doctorId !== doctorId && !db.consultTemplates[idx].isSystemDefault) {
            throw Object.assign(new Error('Unauthorized to update this template'), { status: 403 });
          }
          db.consultTemplates[idx] = {
            ...db.consultTemplates[idx],
            ...template,
            doctorId,
            isSystemDefault: false
          };
          return db.consultTemplates[idx];
        }
      }
      const newT = {
        ...template,
        id: `TMP-${++seq.template}`,
        doctorId,
        isSystemDefault: false
      };
      db.consultTemplates.push(newT);
      return newT;
    },

    async deleteTemplate(templateId, doctorId) {
      const idx = db.consultTemplates.findIndex(t => t.id === templateId);
      if (idx !== -1) {
        if (db.consultTemplates[idx].isSystemDefault) {
          throw Object.assign(new Error('Cannot delete system default template'), { status: 400 });
        }
        if (db.consultTemplates[idx].doctorId !== doctorId) {
          throw Object.assign(new Error('Unauthorized to delete this template'), { status: 403 });
        }
        db.consultTemplates.splice(idx, 1);
      }
    },

    async listFacilities() {
      return db.facilities;
    },

    async getFacilityMedicines(facilityCode) {
      const facMeds = db.facilityMedicines.filter(fm => fm.facilityCode === facilityCode).map(fm => fm.medicineId);
      return db.medicines.filter(m => facMeds.includes(m.id));
    },

    async listPrescriptions(filters = {}) {
      let list = db.prescriptions;
      if (filters.status) {
        list = list.filter(p => p.status === filters.status);
      }
      if (filters.facilityCode) {
        list = list.filter(p => p.facilityCode === filters.facilityCode);
      }
      return list.map(p => ({
        ...p,
        patient: db.patients.find(pt => pt.id === p.patientId) || null,
        doctorName: db.users.find(u => u.id === p.doctorId)?.name || 'Doctor'
      }));
    },

    async updatePrescriptionStatus(id, status, pharmacistId) {
      const p = db.prescriptions.find(x => x.id === id);
      if (!p) throw Object.assign(new Error('Prescription not found'), { status: 404 });
      p.status = status;
      if (status === 'dispensed') {
        p.dispensedBy = pharmacistId;
        p.dispensedAt = new Date().toISOString();
      }
      await this.audit({ actorId: pharmacistId, action: 'prescription.status', entity: 'prescription', entityId: p.id, detail: status });
      return p;
    },

    async getAdminFlowStats(facilityCode) {
      const todayTokens = db.tokens.filter(t => t.date === today());
      return {
        totalTokens: todayTokens.length,
        waiting: todayTokens.filter(t => t.status === 'waiting').length,
        calling: todayTokens.filter(t => t.status === 'calling').length,
        inConsult: todayTokens.filter(t => t.status === 'in-consult').length,
        done: todayTokens.filter(t => t.status === 'done').length,
        atPharmacy: db.prescriptions.filter(p => p.status === 'pending' || p.status === 'dispensing').length,
        dispensed: db.prescriptions.filter(p => p.status === 'dispensed').length,
        avgWaitTimeMin: 12,
        avgConsultTimeMin: 8,
      };
    },

    async getAdminQueueTimeline(facilityCode, date) {
      const targetDate = date || today();
      const tokens = db.tokens.filter(t => t.date === targetDate);
      return tokens.map(t => {
        const patient = db.patients.find(p => p.id === t.patientId);
        return {
          tokenId: t.id,
          tokenNo: t.tokenNo,
          patientName: patient ? maskName(patient.name) : 'Unknown',
          dept: t.dept,
          status: t.status,
          priority: t.priority,
          issuedAt: t.issuedAt,
          calledAt: t.calledAt || null,
          vitalsDone: t.vitalsDone,
          prescriptionStatus: db.prescriptions.find(p => p.tokenId === t.id)?.status || null
        };
      }).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
    },
  };
}
