export const HOSPITAL = { name: 'Arogya HMIS', sub: 'District Hospital · Bhopal' };

export const ROLES = [
  { key: 'doctor', name: 'Doctor', hin: 'डॉक्टर', desc: 'OPD consults, IPD rounds, prescriptions', persona: 'Dr. Asha Verma', detail: 'General Medicine · MD', color: '#EAF1FD', ink: '#16357E', icon: 'stetho' },
  { key: 'nurse', name: 'Nurse', hin: 'नर्स', desc: 'Vitals, triage, ward & bedside care', persona: 'Sr. Meena Joshi', detail: 'Ward In-charge · GNM', color: '#FDEEF4', ink: '#B03A6B', icon: 'heart' },
  { key: 'reception', name: 'Front Desk', hin: 'पंजीकरण', desc: 'Registration, appointments, billing', persona: 'Rahul Sen', detail: 'Registration Counter 2', color: '#E9F7F1', ink: '#116B46', icon: 'clip' },
  { key: 'pharmacy', name: 'Pharmacy & Lab', hin: 'फार्मेसी', desc: 'Dispensing, lab orders, inventory', persona: 'Vikas Rao', detail: 'Pharmacist · Central Store', color: '#FDF3E3', ink: '#8a5a00', icon: 'pill' },
  { key: 'admin', name: 'Administrator', hin: 'प्रशासक', desc: 'Hospital analytics, staff, reports', persona: 'Dr. S. Kulkarni', detail: 'Medical Superintendent', color: '#EFEDFB', ink: '#4c3fa0', icon: 'chart' },
];

export const PATIENTS = [
  { id: 'P-24071', abha: '91-4523-8871-2210', name: 'Ramesh Patel', age: 54, sex: 'M', dept: 'General Medicine', complaint: 'Chest discomfort, breathlessness on exertion (3 days)', allergies: ['Penicillin'], conditions: ['Type 2 Diabetes (2016)', 'Hypertension (2019)'], bp: '148/94', pulse: 96, temp: 99.1, spo2: 94, rr: 20, weight: 78, lastVisit: '02 Jun 2026', meds: ['Metformin 500 mg BD', 'Telmisartan 40 mg OD'] },
  { id: 'P-24072', abha: '91-8810-2245-9034', name: 'Sunita Devi', age: 32, sex: 'F', dept: 'Obstetrics', complaint: 'ANC check-up, 28 weeks, mild pedal edema', allergies: [], conditions: ['G2P1 · 28 wks'], bp: '118/76', pulse: 84, temp: 98.4, spo2: 98, rr: 16, weight: 64, lastVisit: '20 Jun 2026', meds: ['IFA tablets OD', 'Calcium 500 mg OD'] },
  { id: 'P-24073', abha: '91-3312-7789-4456', name: 'Arjun Malhotra', age: 8, sex: 'M', dept: 'Pediatrics', complaint: 'High fever with rash, 2 days', allergies: [], conditions: [], bp: '100/64', pulse: 110, temp: 102.3, spo2: 97, rr: 24, weight: 24, lastVisit: 'First visit', meds: [] },
  { id: 'P-24074', abha: '91-9902-1123-8867', name: 'Fatima Begum', age: 61, sex: 'F', dept: 'Orthopedics', complaint: 'Left knee pain, difficulty climbing stairs', allergies: ['Sulfa drugs'], conditions: ['Osteoarthritis (2021)'], bp: '132/86', pulse: 78, temp: 98.2, spo2: 97, rr: 16, weight: 70, lastVisit: '11 May 2026', meds: ['Glucosamine OD'] },
  { id: 'P-24075', abha: '91-5567-3390-1272', name: 'Mohan Lal', age: 45, sex: 'M', dept: 'General Medicine', complaint: 'Follow-up: fatty liver, deranged LFT', allergies: [], conditions: ['NAFLD (2024)'], bp: '126/82', pulse: 74, temp: 98.6, spo2: 98, rr: 15, weight: 88, lastVisit: '28 May 2026', meds: ['Ursodeoxycholic acid 300 BD'] },
  { id: 'P-24076', abha: '91-2231-9987-3345', name: 'Kavita Sharma', age: 27, sex: 'F', dept: 'ENT', complaint: 'Recurrent sore throat and ear fullness', allergies: [], conditions: [], bp: '112/74', pulse: 80, temp: 99.0, spo2: 99, rr: 15, weight: 55, lastVisit: 'First visit', meds: [] },
];

export const OPD_QUEUE = [
  { token: 'A-14', apiId: 'T-14', pid: 'P-24071', time: '10:05', status: 'in-consult', priority: 'normal', vitalsDone: true },
  { token: 'A-15', apiId: 'T-15', pid: 'P-24073', time: '10:15', status: 'waiting', priority: 'urgent', vitalsDone: true },
  { token: 'A-16', apiId: 'T-16', pid: 'P-24075', time: '10:25', status: 'waiting', priority: 'normal', vitalsDone: true },
  { token: 'C-04', apiId: 'T-17', pid: 'P-24072', time: '10:35', status: 'waiting', priority: 'normal', vitalsDone: true },
  { token: 'D-07', apiId: 'T-18', pid: 'P-24074', time: '10:45', status: 'waiting', priority: 'normal', vitalsDone: false },
  { token: 'E-03', apiId: 'T-19', pid: 'P-24076', time: '10:55', status: 'checked-in', priority: 'normal', vitalsDone: false },
];

export const WARDS = [
  {
    name: 'General Ward', code: 'GW', beds: [
      { no: 'GW-01', pid: 'P-24071', patient: 'Dinesh Kumar', dx: 'CAP · Day 3 antibiotics', los: 3, state: 'stable' },
      { no: 'GW-02', patient: 'Salim Khan', dx: 'Acute gastroenteritis', los: 1, state: 'stable' },
      { no: 'GW-03', patient: 'Prem Singh', dx: 'Uncontrolled T2DM', los: 4, state: 'watch' },
      { no: 'GW-04' },
      { no: 'GW-05', patient: 'Rajni Bai', dx: 'Post-op cholecystectomy', los: 2, state: 'stable' },
      { no: 'GW-06' },
      { no: 'GW-07', patient: 'Gopal Yadav', dx: 'Dengue with warning signs', los: 2, state: 'watch' },
      { no: 'GW-08', patient: 'Iqbal Ahmed', dx: 'CKD - fluid overload', los: 6, state: 'stable' },
    ],
  },
  {
    name: 'ICU', code: 'ICU', beds: [
      { no: 'ICU-1', patient: 'Shanta Bai', dx: 'Septic shock · vasopressors', los: 2, state: 'critical' },
      { no: 'ICU-2', patient: 'Vikram Rathore', dx: 'STEMI · post-thrombolysis', los: 1, state: 'critical' },
      { no: 'ICU-3', patient: 'Munni Devi', dx: 'DKA · insulin infusion', los: 3, state: 'watch' },
      { no: 'ICU-4' },
    ],
  },
  {
    name: 'Maternity', code: 'MAT', beds: [
      { no: 'MAT-1', patient: 'Pooja Verma', dx: 'Post LSCS Day 1', los: 1, state: 'stable' },
      { no: 'MAT-2', patient: 'Rekha Kumari', dx: 'Latent labour, monitoring', los: 0, state: 'watch' },
      { no: 'MAT-3' },
      { no: 'MAT-4', patient: 'Sana Parveen', dx: 'PIH · BP monitoring', los: 2, state: 'watch' },
    ],
  },
  {
    name: 'Pediatric', code: 'PED', beds: [
      { no: 'PED-1', patient: 'Aarav Gupta', dx: 'Bronchiolitis · O2 support', los: 2, state: 'watch' },
      { no: 'PED-2' },
      { no: 'PED-3', patient: 'Meera Sahu', dx: 'Enteric fever · Day 4', los: 4, state: 'stable' },
      { no: 'PED-4' },
    ],
  },
];

export const APPOINTMENTS = [
  { time: '09:00', name: 'Leela Bai', dept: 'General Medicine', doctor: 'Dr. Asha Verma', type: 'Follow-up', status: 'done' },
  { time: '09:30', name: 'Ramesh Patel', dept: 'General Medicine', doctor: 'Dr. Asha Verma', type: 'New', status: 'done' },
  { time: '10:15', name: 'Arjun Malhotra', dept: 'Pediatrics', doctor: 'Dr. N. Iyer', type: 'New', status: 'in-progress' },
  { time: '10:25', name: 'Sunita Devi', dept: 'Obstetrics', doctor: 'Dr. F. Khan', type: 'ANC', status: 'waiting' },
  { time: '11:00', name: 'Fatima Begum', dept: 'Orthopedics', doctor: 'Dr. R. Saxena', type: 'Follow-up', status: 'waiting' },
  { time: '11:30', name: 'Kavita Sharma', dept: 'ENT', doctor: 'Dr. P. Nair', type: 'New', status: 'booked' },
  { time: '12:00', name: 'Mohan Lal', dept: 'General Medicine', doctor: 'Dr. Asha Verma', type: 'Review', status: 'booked' },
];

export const WEEK_VISITS = [
  { d: 'Mon', opd: 212, ipd: 14 },
  { d: 'Tue', opd: 246, ipd: 18 },
  { d: 'Wed', opd: 198, ipd: 11 },
  { d: 'Thu', opd: 260, ipd: 16 },
  { d: 'Fri', opd: 234, ipd: 19 },
  { d: 'Sat', opd: 172, ipd: 9 },
  { d: 'Today', opd: 148, ipd: 7 },
];

export const RX_QUEUE = [
  { rx: 'RX-1182', name: 'Ramesh Patel', doctor: 'Dr. Asha Verma', items: 4, status: 'ready' },
  { rx: 'RX-1183', name: 'Leela Bai', doctor: 'Dr. Asha Verma', items: 2, status: 'dispensing' },
  { rx: 'RX-1184', name: 'Gopal Yadav (GW-07)', doctor: 'Dr. N. Iyer', items: 6, status: 'queued' },
  { rx: 'RX-1185', name: 'Prem Singh (GW-03)', doctor: 'Dr. Asha Verma', items: 3, status: 'queued' },
  { rx: 'RX-1186', name: 'Kavita Sharma', doctor: 'Dr. P. Nair', items: 2, status: 'queued' },
];

export const INVENTORY = [
  { item: 'Amoxicillin 500 mg', cat: 'Antibiotic', stock: 1240, reorder: 500, expiry: 'Mar 2027', status: 'ok' },
  { item: 'Paracetamol 650 mg', cat: 'Analgesic', stock: 320, reorder: 800, expiry: 'Dec 2026', status: 'low' },
  { item: 'Insulin (Regular) 40IU', cat: 'Hormone', stock: 86, reorder: 60, expiry: 'Nov 2026', status: 'ok' },
  { item: 'ORS sachets', cat: 'Rehydration', stock: 148, reorder: 400, expiry: 'Aug 2027', status: 'low' },
  { item: 'Normal Saline 500 ml', cat: 'IV Fluid', stock: 640, reorder: 300, expiry: 'Jan 2028', status: 'ok' },
  { item: 'Rabies vaccine', cat: 'Vaccine', stock: 12, reorder: 40, expiry: 'Sep 2026', status: 'critical' },
];

export const LAB_TESTS = ['CBC', 'Blood Sugar (F/PP)', 'HbA1c', 'LFT', 'KFT', 'Lipid Profile', 'ECG', 'Chest X-Ray', 'Urine R/M', 'Dengue NS1', 'Widal', 'TSH'];

export const INVOICES = [
  { no: 'INV-3301', name: 'Ramesh Patel', type: 'OPD', amount: 150, mode: 'UPI', status: 'paid', time: '09:42' },
  { no: 'INV-3302', name: 'Arjun Malhotra', type: 'OPD + Lab', amount: 620, mode: 'Cash', status: 'paid', time: '10:04' },
  { no: 'INV-3303', name: 'Rajni Bai', type: 'IPD Interim', amount: 4800, mode: '—', status: 'pending', time: '10:15' },
  { no: 'INV-3304', name: 'Sunita Devi', type: 'ANC Package', amount: 0, mode: 'JSY Scheme', status: 'waived', time: '10:22' },
  { no: 'INV-3305', name: 'Fatima Begum', type: 'OPD + X-Ray', amount: 450, mode: '—', status: 'pending', time: '10:31' },
];

export const STAFF = [
  { name: 'Dr. Asha Verma', role: 'Physician · Gen Med', shift: 'OPD 9–1', status: 'on-duty' },
  { name: 'Dr. N. Iyer', role: 'Pediatrician', shift: 'OPD 9–1', status: 'on-duty' },
  { name: 'Dr. R. Saxena', role: 'Orthopedician', shift: 'OPD 9–1 · OT 2–5', status: 'on-duty' },
  { name: 'Sr. Meena Joshi', role: 'Ward In-charge', shift: 'Morning', status: 'on-duty' },
  { name: 'Sr. Anita Toppo', role: 'ICU Nurse', shift: 'Morning', status: 'on-duty' },
  { name: 'Dr. F. Khan', role: 'Obstetrician', shift: 'On call', status: 'on-call' },
  { name: 'Sr. B. Ekka', role: 'Staff Nurse', shift: 'Night', status: 'off' },
];

export const NURSE_TASKS = [
  { time: '11:00', task: 'IV Ceftriaxone 1g — Dinesh Kumar', bed: 'GW-01', done: false, kind: 'med' },
  { time: '11:00', task: 'Vitals q4h — Gopal Yadav', bed: 'GW-07', done: false, kind: 'vitals' },
  { time: '11:15', task: 'Insulin scale check — Munni Devi', bed: 'ICU-3', done: false, kind: 'med' },
  { time: '11:30', task: 'Wound dressing — Rajni Bai', bed: 'GW-05', done: false, kind: 'proc' },
  { time: '12:00', task: 'BP recheck — Sana Parveen', bed: 'MAT-4', done: false, kind: 'vitals' },
  { time: '10:00', task: 'Nebulisation — Aarav Gupta', bed: 'PED-1', done: true, kind: 'proc' },
];

export const bedStats = () => {
  let total = 0, occ = 0;
  WARDS.forEach(w => w.beds.forEach(b => { total++; if (b.patient) occ++; }));
  return { total, occ, pct: Math.round((occ / total) * 100) };
};

export const DEMO_FACILITIES = [
  { code: 'DIST_HOSP_01', name: 'District Hospital, Bhopal', type: 'District Hospital', address: 'Bhopal' },
  { code: 'PHC_AHD_02', name: 'Primary Health Centre, Anand Nagar', type: 'PHC', address: 'Anand Nagar' },
  { code: 'CHC_COL_03', name: 'Community Health Centre, Kolar', type: 'CHC', address: 'Kolar' }
];

export const DEMO_MEDICINES = [
  { id: 'M-01', name: 'Paracetamol 500mg', genericName: 'Paracetamol', category: 'Analgesics', doseForms: ['tablet', 'syrup'], strengths: ['500mg', '125mg/5ml'], defaultRoute: 'oral', defaultFrequency: 'TDS', defaultDuration: '3 days', isControlled: false, isQuickPick: true },
  { id: 'M-02', name: 'Ibuprofen 400mg', genericName: 'Ibuprofen', category: 'Analgesics', doseForms: ['tablet'], strengths: ['400mg'], defaultRoute: 'oral', defaultFrequency: 'BD', defaultDuration: '3 days', isControlled: false, isQuickPick: false },
  { id: 'M-03', name: 'Amoxicillin 500mg', genericName: 'Amoxicillin', category: 'Antibiotics', doseForms: ['capsule', 'syrup'], strengths: ['500mg', '250mg/5ml'], defaultRoute: 'oral', defaultFrequency: 'TDS', defaultDuration: '5 days', isControlled: false, isQuickPick: true },
  { id: 'M-04', name: 'Azithromycin 500mg', genericName: 'Azithromycin', category: 'Antibiotics', doseForms: ['tablet'], strengths: ['500mg', '250mg'], defaultRoute: 'oral', defaultFrequency: 'OD', defaultDuration: '3 days', isControlled: false, isQuickPick: false },
  { id: 'M-05', name: 'Cetirizine 10mg', genericName: 'Cetirizine', category: 'Antihistamines', doseForms: ['tablet'], strengths: ['10mg'], defaultRoute: 'oral', defaultFrequency: 'HS', defaultDuration: '5 days', isControlled: false, isQuickPick: true },
  { id: 'M-06', name: 'Metformin 500mg', genericName: 'Metformin', category: 'Antidiabetics', doseForms: ['tablet'], strengths: ['500mg', '850mg', '1000mg'], defaultRoute: 'oral', defaultFrequency: 'BD', defaultDuration: '30 days', isControlled: false, isQuickPick: true },
  { id: 'M-07', name: 'Glimepiride 2mg', genericName: 'Glimepiride', category: 'Antidiabetics', doseForms: ['tablet'], strengths: ['1mg', '2mg'], defaultRoute: 'oral', defaultFrequency: 'OD', defaultDuration: '30 days', isControlled: false, isQuickPick: false },
  { id: 'M-08', name: 'Telmisartan 40mg', genericName: 'Telmisartan', category: 'Antihypertensives', doseForms: ['tablet'], strengths: ['20mg', '40mg', '80mg'], defaultRoute: 'oral', defaultFrequency: 'OD', defaultDuration: '30 days', isControlled: false, isQuickPick: true },
  { id: 'M-10', name: 'Pantoprazole 40mg', genericName: 'Pantoprazole', category: 'Gastrointestinal', doseForms: ['tablet'], strengths: ['40mg'], defaultRoute: 'oral', defaultFrequency: 'OD', defaultDuration: '10 days', isControlled: false, isQuickPick: true },
  { id: 'M-17', name: 'ORSalts (ORS) sachet', genericName: 'Oral Rehydration Salts', category: 'Gastrointestinal', doseForms: ['powder'], strengths: ['20.5g'], defaultRoute: 'oral', defaultFrequency: 'PRN', defaultDuration: '3 days', isControlled: false, isQuickPick: true },
  { id: 'M-18', name: 'Loperamide 2mg', genericName: 'Loperamide', category: 'Gastrointestinal', doseForms: ['capsule'], strengths: ['2mg'], defaultRoute: 'oral', defaultFrequency: 'STAT', defaultDuration: '1 day', isControlled: false, isQuickPick: false },
  { id: 'M-19', name: 'Morphine 10mg', genericName: 'Morphine', category: 'Analgesics', doseForms: ['tablet', 'injection'], strengths: ['10mg', '15mg/ml'], defaultRoute: 'oral', defaultFrequency: 'TDS', defaultDuration: '2 days', isControlled: true, isQuickPick: false }
];

export const DEMO_TEMPLATES = [
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

export const DEMO_PRESCRIPTIONS = [
  {
    id: 'PR-1',
    consultId: 'C-mock-1',
    tokenId: 'T-14',
    patientId: 'P-24071',
    patient: { id: 'P-24071', name: 'Ramesh Patel', age: 54, sex: 'M', mobile: '9800000001' },
    doctorId: 'U-1',
    doctorName: 'Dr. Asha Verma',
    facilityCode: 'DIST_HOSP_01',
    status: 'pending',
    items: [
      { name: 'Metformin 500mg', dose: '1-0-1', route: 'oral', frequency: 'BD', duration: '30 days', qty: 60 },
      { name: 'Telmisartan 40mg', dose: '1-0-0', route: 'oral', frequency: 'OD', duration: '30 days', qty: 30 }
    ],
    dispensedBy: null,
    dispensedAt: null
  },
  {
    id: 'PR-2',
    consultId: 'C-mock-2',
    tokenId: 'T-15',
    patientId: 'P-24073',
    patient: { id: 'P-24073', name: 'Arjun Malhotra', age: 8, sex: 'M', mobile: '9800000003' },
    doctorId: 'U-1',
    doctorName: 'Dr. Asha Verma',
    facilityCode: 'DIST_HOSP_01',
    status: 'dispensing',
    items: [
      { name: 'Paracetamol 500mg', dose: '1-0-1', route: 'oral', frequency: 'BD', duration: '3 days', qty: 6 },
      { name: 'Cetirizine 10mg', dose: '0-0-1', route: 'oral', frequency: 'HS', duration: '5 days', qty: 5 }
    ],
    dispensedBy: null,
    dispensedAt: null
  }
];
