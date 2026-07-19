import { useState } from 'react';
import Shell from './Shell.jsx';
import Login from './pages/Login.jsx';
import Consult from './pages/Consult.jsx';
import PatientPortal from './pages/Patient.jsx';
import { api } from './api.js';
import { BedBoard, IpdChart } from './pages/IPD.jsx';
import { DoctorDashboard, NurseDashboard, ReceptionDashboard, PharmacyDashboard, AdminDashboard } from './pages/Dashboards.jsx';
import { OpdQueue, Appointments, Register, Billing, Triage, RxList, Inventory, Analytics, StaffPage, NurseWard } from './pages/Modules.jsx';
import { ROLES, PATIENTS } from './data.js';

const NAV = {
  doctor: [
    { key: 'dashboard', label: 'Dashboard', hin: 'डैशबोर्ड', icon: 'home', short: 'Home' },
    { key: 'opd', label: 'OPD Queue', hin: 'ओपीडी', icon: 'users', short: 'OPD' },
    { key: 'ipd', label: 'IPD · Bed Board', hin: 'आईपीडी', icon: 'bed', short: 'IPD' },
    { key: 'appointments', label: 'Appointments', hin: 'अपॉइंटमेंट', icon: 'cal', short: 'Appts' },
  ],
  nurse: [
    { key: 'dashboard', label: 'Dashboard', hin: 'डैशबोर्ड', icon: 'home', short: 'Home' },
    { key: 'triage', label: 'OPD Triage', hin: 'ट्राइएज', icon: 'pulse', short: 'Triage' },
    { key: 'ward', label: 'Ward & Beds', hin: 'वार्ड', icon: 'bed', short: 'Ward' },
  ],
  reception: [
    { key: 'dashboard', label: 'Dashboard', hin: 'डैशबोर्ड', icon: 'home', short: 'Home' },
    { key: 'register', label: 'Registration', hin: 'पंजीकरण', icon: 'plus', short: 'Register' },
    { key: 'appointments', label: 'Appointments', hin: 'अपॉइंटमेंट', icon: 'cal', short: 'Appts' },
    { key: 'billing', label: 'Billing', hin: 'बिलिंग', icon: 'rupee', short: 'Billing' },
  ],
  pharmacy: [
    { key: 'dashboard', label: 'Dashboard', hin: 'डैशबोर्ड', icon: 'home', short: 'Home' },
    { key: 'prescriptions', label: 'Prescriptions', hin: 'पर्ची', icon: 'pill', short: 'Rx' },
    { key: 'inventory', label: 'Inventory', hin: 'भंडार', icon: 'box', short: 'Stock' },
  ],
  admin: [
    { key: 'dashboard', label: 'Dashboard', hin: 'डैशबोर्ड', icon: 'home', short: 'Home' },
    { key: 'analytics', label: 'Analytics', hin: 'विश्लेषण', icon: 'chart', short: 'Charts' },
    { key: 'staff', label: 'Staff Roster', hin: 'स्टाफ', icon: 'users', short: 'Staff' },
  ],
};

const TITLES = {
  dashboard: ['Dashboard', 'Today at a glance'],
  opd: ['OPD', 'Outpatient queue & consultations'],
  ipd: ['IPD', 'Inpatient wards & bed board'],
  appointments: ['Appointments', 'Slot booking & schedule'],
  register: ['Registration', 'New patient & revisit tokens'],
  billing: ['Billing', 'Invoices & collections'],
  triage: ['OPD Triage', 'Vitals capture before consult'],
  ward: ['Ward & Beds', 'Inpatient care board'],
  prescriptions: ['Prescriptions', 'Dispensing queue'],
  inventory: ['Inventory', 'Central store stock'],
  analytics: ['Analytics', 'Hospital performance'],
  staff: ['Staff', 'Roster & duty status'],
  consult: ['Consultation', 'OPD workspace'],
  'ipd-chart': ['Inpatient Chart', 'Bedside record'],
};

export default function App() {
  // Patient view survives the browser closing — staff sessions never do.
  const [roleKey, setRoleKey] = useState(() => {
    try { return localStorage.getItem('hmis.patientMode') ? 'patient' : null; } catch { return null; }
  });
  const [page, setPage] = useState('dashboard');
  const [consultCtx, setConsultCtx] = useState(null);
  const [chartBed, setChartBed] = useState(null);
  const [offline, setOffline] = useState(false);

  if (!roleKey) return (
    <Login
      onAuthed={user => { setOffline(false); setRoleKey(user.role); setPage('dashboard'); }}
      onOffline={rk => { setOffline(true); setRoleKey(rk); setPage('dashboard'); }}
      onPatient={() => { try { localStorage.setItem('hmis.patientMode', '1'); } catch { /* ignore */ } setRoleKey('patient'); }}
    />
  );
  if (roleKey === 'patient') return <PatientPortal onExit={() => { try { localStorage.removeItem('hmis.patientMode'); } catch { /* ignore */ } setRoleKey(null); }} />;

  const role = ROLES.find(r => r.key === roleKey);
  const nav = NAV[roleKey];
  const go = p => { setConsultCtx(null); setChartBed(null); setPage(p); };

  /** Accepts an API queue row ({ id, tokenNo, patient }) or a mock row ({ pid, token, apiId }). */
  const openConsult = row => {
    const patient = row.patient || PATIENTS.find(p => p.id === row.pid);
    if (!patient) return;
    setConsultCtx({ patient, tokenId: row.id || row.apiId || null, tokenNo: row.tokenNo || row.token || '' });
    setPage('consult');
  };
  const openChart = bed => { setChartBed(bed); setPage('ipd-chart'); };
  const logout = () => { api.logout(); setRoleKey(null); setConsultCtx(null); setChartBed(null); };

  const fixed = page === 'consult' || page === 'ipd-chart';
  const backPage = roleKey === 'nurse' ? 'ward' : 'ipd';

  const body = (() => {
    if (page === 'consult' && consultCtx)
      return <Consult patient={consultCtx.patient} tokenId={consultCtx.tokenId} tokenNo={consultCtx.tokenNo} onClose={() => go('opd')} />;
    if (page === 'ipd-chart' && chartBed)
      return <IpdChart bed={chartBed} onClose={() => go(backPage)} />;

    switch (`${roleKey}:${page}`) {
      case 'doctor:dashboard': return <DoctorDashboard go={go} openConsult={openConsult} />;
      case 'doctor:opd': return <OpdQueue openConsult={openConsult} />;
      case 'doctor:ipd': return <BedBoard openChart={openChart} role={roleKey} />;
      case 'doctor:appointments': return <Appointments />;
      case 'nurse:dashboard': return <NurseDashboard go={go} />;
      case 'nurse:triage': return <Triage />;
      case 'nurse:ward': return (<><NurseWard openChart={openChart} /><BedBoard openChart={openChart} role={roleKey} /></>);
      case 'reception:dashboard': return <ReceptionDashboard go={go} />;
      case 'reception:register': return <Register />;
      case 'reception:appointments': return <Appointments />;
      case 'reception:billing': return <Billing />;
      case 'pharmacy:dashboard': return <PharmacyDashboard go={go} />;
      case 'pharmacy:prescriptions': return <RxList />;
      case 'pharmacy:inventory': return <Inventory />;
      case 'admin:dashboard': return <AdminDashboard go={go} />;
      case 'admin:analytics': return <Analytics />;
      case 'admin:staff': return <StaffPage />;
      default: return <div className="card empty">Module coming soon.</div>;
    }
  })();

  const [title, subtitle] = TITLES[page] || TITLES.dashboard;

  return (
    <Shell role={role} nav={nav} page={page} setPage={go} title={title} subtitle={subtitle} onLogout={logout} fixed={fixed} offline={offline}>
      {body}
    </Shell>
  );
}
