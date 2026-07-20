/**
 * e-HR demo dataset — longitudinal, cross-facility record (ported from the
 * MP-HMIS v9_11 prototype). Until the laboratory module produces real results,
 * this stands in for the ABHA-linked history; visits recorded in this app can
 * be merged in later.
 */
export const EHR_CATS = {
  diab: { en: 'Diabetes panel', hin: 'मधुमेह पैनल', c: '#C2410C', bg: '#FFF1E7' },
  hema: { en: 'Blood count · CBC', hin: 'रक्त गणना', c: '#B91C4A', bg: '#FDECF1' },
  lipid: { en: 'Lipid profile', hin: 'लिपिड प्रोफ़ाइल', c: '#7C3AED', bg: '#F1ECFD' },
  kft: { en: 'Kidney · KFT', hin: 'किडनी', c: '#0E7490', bg: '#E6F5F8' },
  lft: { en: 'Liver · LFT', hin: 'लिवर', c: '#15803D', bg: '#E9F7EE' },
  thy: { en: 'Thyroid', hin: 'थायरॉइड', c: '#9A3412', bg: '#FDF0E7' },
  vital: { en: 'Vitals', hin: 'वाइटल्स', c: '#2E6BE6', bg: '#EAF1FD' },
};

/* v: [date, value, facility] — oldest first */
export const EHR_TESTS = [
  { k: 'fbs', cat: 'diab', en: 'FBS', hin: 'फास्टिंग शुगर', name: 'Fasting blood sugar', u: 'mg/dL', lo: 70, hi: 100, v: [['2024-08-14', 104, 'Kolar CHC'], ['2024-11-20', 126, 'Hamidia Hospital'], ['2025-02-11', 138, 'Hamidia Hospital'], ['2025-05-09', 131, 'Kolar CHC'], ['2025-09-16', 142, 'Hamidia Hospital'], ['2026-01-08', 148, 'Hamidia Hospital'], ['2026-07-16', 134, 'Hamidia Hospital']] },
  { k: 'ppbs', cat: 'diab', en: 'PPBS', hin: 'भोजनोपरांत शुगर', name: 'Post-prandial sugar', u: 'mg/dL', lo: 70, hi: 140, v: [['2024-11-20', 196, 'Hamidia Hospital'], ['2025-02-11', 214, 'Hamidia Hospital'], ['2025-09-16', 228, 'Hamidia Hospital'], ['2026-01-08', 236, 'Hamidia Hospital'], ['2026-07-16', 202, 'Hamidia Hospital']] },
  { k: 'hba1c', cat: 'diab', en: 'HbA1c', hin: 'ग्लाइकेटेड हीमोग्लोबिन', name: 'Glycated haemoglobin', u: '%', lo: 4, hi: 5.7, v: [['2024-11-20', 7.2, 'Hamidia Hospital'], ['2025-05-09', 7.9, 'Hamidia Hospital'], ['2026-01-08', 8.4, 'Hamidia Hospital'], ['2026-07-16', 7.6, 'Hamidia Hospital']] },
  { k: 'rbs', cat: 'diab', en: 'RBS', hin: 'रैंडम शुगर', name: 'Random blood sugar', u: 'mg/dL', lo: 70, hi: 140, v: [['2025-03-12', 188, 'Kolar CHC'], ['2026-07-16', 176, 'Hamidia Hospital']] },
  { k: 'hb', cat: 'hema', en: 'Haemoglobin', hin: 'हीमोग्लोबिन', name: 'Haemoglobin', u: 'g/dL', lo: 13, hi: 17, v: [['2024-08-14', 13.8, 'Kolar CHC'], ['2025-02-11', 12.9, 'Hamidia Hospital'], ['2025-09-16', 12.4, 'Hamidia Hospital'], ['2026-07-16', 13.1, 'Hamidia Hospital']] },
  { k: 'tlc', cat: 'hema', en: 'TLC / WBC', hin: 'श्वेत रक्त कोशिका', name: 'Total leukocyte count', u: '/µL', lo: 4000, hi: 11000, v: [['2024-08-14', 7800, 'Kolar CHC'], ['2025-02-11', 9400, 'Hamidia Hospital'], ['2026-07-16', 8200, 'Hamidia Hospital']] },
  { k: 'plt', cat: 'hema', en: 'Platelet', hin: 'प्लेटलेट', name: 'Platelet count', u: '/µL', lo: 150000, hi: 410000, v: [['2024-08-14', 248000, 'Kolar CHC'], ['2025-02-11', 196000, 'Hamidia Hospital'], ['2026-07-16', 232000, 'Hamidia Hospital']] },
  { k: 'tchol', cat: 'lipid', en: 'Total Cholesterol', hin: 'कुल कोलेस्ट्रॉल', name: 'Total cholesterol', u: 'mg/dL', lo: 0, hi: 200, v: [['2024-11-20', 214, 'Hamidia Hospital'], ['2025-09-16', 228, 'Hamidia Hospital'], ['2026-07-16', 196, 'Hamidia Hospital']] },
  { k: 'ldl', cat: 'lipid', en: 'LDL', hin: 'LDL (खराब)', name: 'LDL cholesterol', u: 'mg/dL', lo: 0, hi: 100, v: [['2024-11-20', 138, 'Hamidia Hospital'], ['2025-09-16', 146, 'Hamidia Hospital'], ['2026-07-16', 112, 'Hamidia Hospital']] },
  { k: 'hdl', cat: 'lipid', en: 'HDL', hin: 'HDL (अच्छा)', name: 'HDL cholesterol', u: 'mg/dL', lo: 40, hi: 80, v: [['2024-11-20', 38, 'Hamidia Hospital'], ['2025-09-16', 36, 'Hamidia Hospital'], ['2026-07-16', 42, 'Hamidia Hospital']] },
  { k: 'tg', cat: 'lipid', en: 'Triglycerides', hin: 'ट्राइग्लिसराइड', name: 'Triglycerides', u: 'mg/dL', lo: 0, hi: 150, v: [['2024-11-20', 186, 'Hamidia Hospital'], ['2025-09-16', 212, 'Hamidia Hospital'], ['2026-07-16', 164, 'Hamidia Hospital']] },
  { k: 'urea', cat: 'kft', en: 'Blood Urea', hin: 'यूरिया', name: 'Blood urea', u: 'mg/dL', lo: 15, hi: 40, v: [['2025-02-11', 34, 'Hamidia Hospital'], ['2026-01-08', 42, 'Hamidia Hospital'], ['2026-07-16', 38, 'Hamidia Hospital']] },
  { k: 'creat', cat: 'kft', en: 'Creatinine', hin: 'क्रिएटिनिन', name: 'Serum creatinine', u: 'mg/dL', lo: 0.7, hi: 1.3, v: [['2025-02-11', 1.1, 'Hamidia Hospital'], ['2026-01-08', 1.4, 'Hamidia Hospital'], ['2026-07-16', 1.2, 'Hamidia Hospital']] },
  { k: 'sgpt', cat: 'lft', en: 'ALT', hin: 'SGPT / ALT', name: 'Alanine transaminase', u: 'U/L', lo: 7, hi: 56, v: [['2025-02-11', 48, 'Hamidia Hospital'], ['2026-07-16', 52, 'Hamidia Hospital']] },
  { k: 'bili', cat: 'lft', en: 'Total Bilirubin', hin: 'बिलीरुबिन (कुल)', name: 'Total bilirubin', u: 'mg/dL', lo: 0.2, hi: 1.2, v: [['2025-02-11', 0.8, 'Hamidia Hospital'], ['2026-07-16', 0.9, 'Hamidia Hospital']] },
  { k: 'tsh', cat: 'thy', en: 'TSH', hin: 'TSH', name: 'Thyroid stimulating hormone', u: 'µIU/mL', lo: 0.4, hi: 4.2, v: [['2024-11-20', 3.1, 'Hamidia Hospital'], ['2026-07-16', 4.8, 'Hamidia Hospital']] },
  { k: 'bpsys', cat: 'vital', en: 'BP Systolic', hin: 'रक्तचाप (सिस्टोलिक)', name: 'Systolic blood pressure', u: 'mmHg', lo: 90, hi: 130, v: [['2024-08-14', 134, 'Kolar CHC'], ['2025-02-11', 146, 'Hamidia Hospital'], ['2025-09-16', 152, 'Hamidia Hospital'], ['2026-01-08', 148, 'Hamidia Hospital'], ['2026-07-16', 142, 'Hamidia Hospital']] },
  { k: 'bpdia', cat: 'vital', en: 'BP Diastolic', hin: 'रक्तचाप (डायस्टोलिक)', name: 'Diastolic blood pressure', u: 'mmHg', lo: 60, hi: 85, v: [['2024-08-14', 86, 'Kolar CHC'], ['2025-02-11', 92, 'Hamidia Hospital'], ['2025-09-16', 96, 'Hamidia Hospital'], ['2026-01-08', 90, 'Hamidia Hospital'], ['2026-07-16', 88, 'Hamidia Hospital']] },
  { k: 'wt', cat: 'vital', en: 'Weight', hin: 'वज़न', name: 'Body weight', u: 'kg', lo: 55, hi: 78, v: [['2024-08-14', 79, 'Kolar CHC'], ['2025-09-16', 82, 'Hamidia Hospital'], ['2026-07-16', 80, 'Hamidia Hospital']] },
];

export const EHR_VISITS = [
  { d: '2026-07-16', t: 'opd', title: 'OPD · General Medicine', sub: 'Dr. Verma · Uncontrolled diabetes, follow-up', fac: 'Hamidia Hospital' },
  { d: '2026-01-08', t: 'ipd', title: 'IPD admission · 3 days', sub: 'UTI + hyperglycaemia · discharged recovered', fac: 'Hamidia Hospital' },
  { d: '2025-09-16', t: 'opd', title: 'OPD · General Medicine', sub: 'Dr. Verma · medication adjustment', fac: 'Hamidia Hospital' },
  { d: '2025-03-12', t: 'opd', title: 'OPD · Orthopedics', sub: 'Dr. Sharma · knee pain', fac: 'Kolar CHC' },
  { d: '2024-11-20', t: 'opd', title: 'OPD · General Medicine', sub: 'Diabetes diagnosis confirmed · Metformin started', fac: 'Hamidia Hospital' },
  { d: '2024-08-14', t: 'opd', title: 'OPD · General', sub: 'Routine check · fever', fac: 'Kolar CHC' },
];

export const EHR_IMAGING = [
  { d: '2026-07-16', kind: 'ECG', title: '12-lead ECG', result: 'Sinus rhythm, no ischaemic changes', fac: 'Hamidia Hospital', ok: true },
  { d: '2026-01-08', kind: 'USG', title: 'Abdomen & pelvis', result: 'Grade-II fatty liver; both kidneys normal size', fac: 'Hamidia Hospital', ok: false },
  { d: '2026-01-08', kind: 'Culture', title: 'Urine C/S', result: 'E. coli growth · Nitrofurantoin sensitive', fac: 'Hamidia Hospital', ok: false },
  { d: '2025-09-16', kind: 'X-ray', title: 'Chest PA', result: 'Both lung fields clear, CT ratio normal', fac: 'Hamidia Hospital', ok: true },
  { d: '2025-03-12', kind: 'X-ray', title: 'Right knee AP/LAT', result: 'Mild osteoarthritis, reduced joint space', fac: 'Kolar CHC', ok: false },
];

export const EHR_RX = [
  { d: '2026-07-16', items: ['Metformin 500mg · 1-0-1 · 30 days', 'Telmisartan 40mg · 1-0-0 · 30 days', 'Atorvastatin 20mg · 0-0-1 · 30 days'] },
  { d: '2026-01-08', items: ['Nitrofurantoin 100mg · 1-0-1 · 7 days', 'Metformin 500mg · 1-0-1 · 30 days'] },
  { d: '2025-09-16', items: ['Metformin 500mg · 1-0-1 · 30 days', 'Glimepiride 1mg · 1-0-0 · 30 days'] },
  { d: '2025-03-12', items: ['Ibuprofen 400mg · 1-0-1 · 5 days', 'Pantoprazole 40mg · 1-0-0 · 5 days'] },
];

/* ---------- helpers ---------- */
export const testStatus = (t, v) => (v > t.hi ? 'high' : v < t.lo ? 'low' : 'ok');
export const latestOf = t => t.v[t.v.length - 1];
export const fmtVal = v => (v >= 100000 ? v.toLocaleString('en-IN') : String(v));

export const fmtDate = d =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export const relTime = (d) => {
  const days = Math.round((Date.now() - new Date(d).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.round(days / 30)} mo ago`;
  return `${(days / 365).toFixed(1)} yr ago`;
};

/** All test readings taken on one date (for the date-wise timeline). */
export const labsOnDate = d =>
  EHR_TESTS.flatMap(t => t.v.filter(r => r[0] === d).map(r => ({ t, val: r[1], status: testStatus(t, r[1]) })));

/** Latest-report abnormal chips for the attention band. */
export const latestAbnormal = () =>
  EHR_TESTS.map(t => ({ t, r: latestOf(t) }))
    .filter(({ t, r }) => testStatus(t, r[1]) !== 'ok')
    .sort((a, b) => b.r[0].localeCompare(a.r[0]));

export const totalReports = () => EHR_TESTS.reduce((s, t) => s + t.v.length, 0);
