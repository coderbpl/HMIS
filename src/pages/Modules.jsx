import { useEffect, useState } from 'react';
import Icon from '../icons.jsx';
import { SecHead, Pill, StatusPill, Avatar, Bars, Meter } from '../ui.jsx';
import { OPD_QUEUE, PATIENTS, APPOINTMENTS, INVOICES, RX_QUEUE, INVENTORY, STAFF, WEEK_VISITS, WARDS, NURSE_TASKS, bedStats } from '../data.js';
import { api } from '../api.js';
import { BigChips } from '../components/touch.jsx';

const pt = pid => PATIENTS.find(p => p.id === pid);

/* mock rows shaped like API rows, for offline fallback */
const mockQueue = () => OPD_QUEUE.map(q => ({
  id: q.apiId, tokenNo: q.token, status: q.status, priority: q.priority,
  vitalsDone: q.vitalsDone, patient: pt(q.pid),
}));

/* ---------- OPD QUEUE (doctor) — live from the API ---------- */
export function OpdQueue({ openConsult }) {
  const [filter, setFilter] = useState('all');
  const [rows, setRows] = useState([]);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(null);

  const load = () => api.getQueue()
    .then(r => { setRows(r); setLive(true); })
    .catch(() => { setRows(mockQueue()); setLive(false); });
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, []);

  const start = async (q) => {
    setBusy(q.id);
    try {
      if (live && q.status !== 'in-consult') await api.updateTokenStatus(q.id, 'in-consult');
      openConsult(q);
    } catch (err) {
      alert(err.message); // e.g. someone else already advanced the queue
      load();
    } finally { setBusy(null); }
  };

  const shown = rows.filter(q => filter === 'all' ? true : q.status === filter);
  return (
    <>
      <div className="sec-head" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <b style={{ fontSize: 16 }}>OPD queue</b>
          <span> · Room 104 · Dr. Ravi Verma {live ? '· live' : ''}</span>
          {!live && <Pill tone="warn">offline demo</Pill>}
        </div>
        <div className="seg">
          {[['all', 'All'], ['waiting', 'Waiting'], ['in-consult', 'In consult'], ['checked-in', 'Checked in']].map(([k, l]) => (
            <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
      </div>
      {shown.length === 0 && <div className="card empty">No patients in this state.</div>}
      {shown.map(q => {
        const p = q.patient;
        return (
          <div key={q.id} className={`tok ${q.status === 'in-consult' ? 'now' : ''}`}>
            <div className="tno">{q.tokenNo}</div>
            <div className="tx">
              <b>{p.name} · {p.age} {p.sex} <span style={{ color: 'var(--muted)', fontWeight: 500 }}>· {p.id}</span></b>
              <span>{p.complaint || p.dept}</span>
            </div>
            <div className="acts">
              {q.priority === 'urgent' && <StatusPill s="urgent" />}
              <Pill tone={q.vitalsDone ? 'ok' : 'neu'}>{q.vitalsDone ? 'Vitals ✓' : 'Vitals pending'}</Pill>
              <StatusPill s={q.status} />
              <button className="btn primary sm" disabled={busy === q.id} onClick={() => start(q)}>
                {q.status === 'in-consult' ? 'Resume' : 'Start consult'}
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}

/* ---------- APPOINTMENTS ---------- */
export function Appointments() {
  const [dept, setDept] = useState('All');
  const depts = ['All', ...new Set(APPOINTMENTS.map(a => a.dept))];
  const rows = APPOINTMENTS.filter(a => dept === 'All' || a.dept === dept);
  return (
    <>
      <div className="sec-head" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div><b style={{ fontSize: 16 }}>Appointments</b><span> · Today, 17 Jul 2026</span></div>
        <div className="seg" style={{ overflowX: 'auto', maxWidth: '100%' }}>
          {depts.map(d => <button key={d} className={dept === d ? 'on' : ''} onClick={() => setDept(d)}>{d}</button>)}
        </div>
      </div>
      <div className="card">
        <div className="tbl-scroll">
          <table className="tbl">
            <thead><tr><th>Time</th><th>Patient</th><th>Department</th><th>Doctor</th><th>Type</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map(a => (
                <tr key={a.time + a.name} className="click">
                  <td style={{ fontWeight: 800 }}>{a.time}</td><td>{a.name}</td><td>{a.dept}</td><td>{a.doctor}</td>
                  <td><Pill tone="neu">{a.type}</Pill></td><td><StatusPill s={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="note-band mt">
        <span className="nd" />
        <div><b>2 free slots before 1 PM</b><span>11:45 General Medicine · 12:30 Orthopedics — walk-ins can be placed here.</span></div>
      </div>
    </>
  );
}

/* ---------- REGISTRATION (reception) — creates the patient via API ---------- */
const FEE_OPTIONS = [
  { label: '₹10 fee', feeAmount: 10, feeExemption: null },
  { label: 'BPL · free', feeAmount: 0, feeExemption: 'BPL' },
  { label: 'Govt exemption', feeAmount: 0, feeExemption: 'Govt scheme' },
  { label: 'JSY · free', feeAmount: 0, feeExemption: 'JSY' },
];
const CATEGORIES = ['● Normal', '↪ Referral-in', '🚨 Emergency'];
const catValue = c => c.includes('Emergency') ? 'emergency' : c.includes('Referral') ? 'referral' : 'normal';

export function Register() {
  const empty = { name: '', mobile: '', age: '', sex: 'F', dept: 'General Medicine', abha: '', scheme: '' };
  const [f, setF] = useState(empty);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [symptomList, setSymptomList] = useState([]);
  const [symptoms, setSymptoms] = useState([]);
  const [deptTouched, setDeptTouched] = useState(false);
  const [fee, setFee] = useState(FEE_OPTIONS[0].label);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF(x => ({ ...x, [k]: e.target.value }));
  const symLabel = s => `${s.en} · ${s.hin}`;

  useEffect(() => { api.symptoms().then(setSymptomList).catch(() => {}); }, []);

  // symptom taps route the department unless the operator picked one manually
  const pickSymptoms = (labels) => {
    const next = labels.slice(0, 3);
    setSymptoms(next);
    if (!deptTouched) {
      const first = symptomList.find(s => next.includes(symLabel(s)));
      if (first) setF(x => ({ ...x, dept: first.dept }));
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setResult(null);
    if (!f.name.trim() || !/^[6-9]\d{9}$/.test(f.mobile) || f.age === '') {
      setErr('Name, a valid 10-digit mobile and age are required.');
      return;
    }
    setBusy(true);
    try {
      const feeOpt = FEE_OPTIONS.find(o => o.label === fee) || FEE_OPTIONS[0];
      const res = await api.registerPatient({
        name: f.name.trim(), mobile: f.mobile, age: Number(f.age), sex: f.sex,
        dept: f.dept, abha: f.abha || undefined, scheme: f.scheme || undefined, issueToken: 'yes',
        category: catValue(category),
        symptoms: symptomList.filter(s => symptoms.includes(symLabel(s))).map(s => s.code),
        feeAmount: feeOpt.feeAmount, feeExemption: feeOpt.feeExemption || undefined,
      });
      setResult(res);
      setF(empty); setSymptoms([]); setCategory(CATEGORIES[0]); setFee(FEE_OPTIONS[0].label); setDeptTouched(false);
    } catch (ex) {
      setErr(ex.offline ? 'API unreachable — start the server (cd server && npm run dev) to register for real.' : ex.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="grid-2">
      <form className="card" onSubmit={submit}>
        <SecHead title="New patient registration" sub="UHID auto-generated · ABHA optional" />

        <span className="tlabel">Patient category <em className="hin">· रोगी श्रेणी</em></span>
        <div style={{ marginBottom: 12 }}>
          <BigChips options={CATEGORIES} value={category} onChange={v => setCategory(v || CATEGORIES[0])} cols={3} />
        </div>
        {catValue(category) === 'emergency' && (
          <div className="offline-band" style={{ background: '#FBE5E3', borderColor: '#F2B8B3', color: '#A02E24' }}>
            Emergency — token issued as <b>urgent</b>. Send the patient to ER triage immediately; paperwork can follow.
          </div>
        )}
        <div className="f-row">
          <div className="f-group"><label className="f-label">Full name *</label><input className="f-inp" placeholder="As per ID document" value={f.name} onChange={set('name')} /></div>
          <div className="f-group"><label className="f-label">Mobile number *</label><input className="f-inp" inputMode="numeric" placeholder="10 digits" value={f.mobile} onChange={e => setF(x => ({ ...x, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))} /></div>
        </div>
        <div className="f-row3">
          <div className="f-group"><label className="f-label">Age *</label><input className="f-inp" inputMode="numeric" placeholder="Years" value={f.age} onChange={e => setF(x => ({ ...x, age: e.target.value.replace(/\D/g, '').slice(0, 3) }))} /></div>
          <div className="f-group"><label className="f-label">Sex *</label><select className="f-sel" value={f.sex} onChange={set('sex')}><option value="F">Female</option><option value="M">Male</option><option value="O">Other</option></select></div>
          <div className="f-group"><label className="f-label">Scheme</label><select className="f-sel" value={f.scheme} onChange={set('scheme')}><option value="">None / Cash</option><option>Ayushman Bharat</option><option>JSY</option><option>State employee</option></select></div>
        </div>
        <div className="f-row">
          <div className="f-group"><label className="f-label">ABHA number <em>(scan or type)</em></label><input className="f-inp" placeholder="91-XXXX-XXXX-XXXX" value={f.abha} onChange={set('abha')} /></div>
          <div className="f-group"><label className="f-label">Department * <em>(auto from symptom)</em></label><select className="f-sel" value={f.dept} onChange={e => { setDeptTouched(true); set('dept')(e); }}><option>General Medicine</option><option>Pediatrics</option><option>Obstetrics</option><option>Orthopedics</option><option>ENT</option></select></div>
        </div>

        <span className="tlabel">Symptoms <em className="hin">· रोग → विभाग स्वतः (up to 3)</em></span>
        <div style={{ marginBottom: 12 }}>
          <BigChips multi options={symptomList.map(symLabel)} value={symptoms} onChange={pickSymptoms} cols={2} />
        </div>

        <span className="tlabel">Fee / exemption <em className="hin">· शुल्क / छूट</em></span>
        <div style={{ marginBottom: 12 }}>
          <BigChips options={FEE_OPTIONS.map(o => o.label)} value={fee} onChange={v => setFee(v || FEE_OPTIONS[0].label)} cols={4} />
        </div>

        {err && <div className="offline-band" style={{ background: '#FBE5E3', borderColor: '#F2B8B3', color: '#A02E24' }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button type="button" className="btn ghost"><Icon name="scan" size={15} /> Scan ABHA QR</button>
          <button type="submit" className="btn primary" style={{ flex: 1 }} disabled={busy}><Icon name="check" size={15} /> {busy ? 'Registering…' : 'Register & issue token'}</button>
        </div>
        {result && (
          <div className="note-band" style={{ marginTop: 14, background: '#E3F3EC', borderColor: '#BFE5D4' }}>
            <span className="nd" style={{ background: 'var(--green)' }} />
            <div>
              <b>Registered — Token {result.token?.tokenNo} issued{result.token?.feeExemption ? ` · ${result.token.feeExemption} (free)` : result.token?.feeAmount ? ` · ₹${result.token.feeAmount} collected` : ''}</b>
              <span>UHID {result.patient.id} · {result.patient.dept} queue{result.token?.complaint ? ` · complaint: ${result.token.complaint}` : ''} · trackable with mobile + token number.</span>
            </div>
          </div>
        )}
      </form>
      <div className="stack">
        <div className="card">
          <SecHead title="Counter status" />
          <div className="kv"><span className="k">Token series</span><span className="v">A (General)</span></div>
          <div className="kv"><span className="k">Last token issued</span><span className="v">A-19 · 10:52</span></div>
          <div className="kv"><span className="k">Average wait</span><span className="v">12 min</span></div>
          <div className="kv"><span className="k">OPD closes</span><span className="v">13:00</span></div>
        </div>
        <div className="card">
          <SecHead title="Quick revisit" sub="search returns the existing UHID" />
          <input className="f-inp" placeholder="UHID / mobile / ABHA…" style={{ marginBottom: 10 }} />
          {PATIENTS.slice(0, 3).map(p => (
            <div className="lrow" key={p.id}>
              <Avatar name={p.name} size="sm" />
              <div className="tx"><b>{p.name}</b><span>{p.id} · {p.dept}</span></div>
              <button className="btn ghost sm">Issue token</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- BILLING ---------- */
export function Billing() {
  const total = INVOICES.reduce((s, v) => s + (v.status === 'paid' ? v.amount : 0), 0);
  return (
    <>
      <div className="stat-grid">
        <div className="stat"><div className="big">₹{(total / 1000).toFixed(1)}k</div><div className="lh">Collected today</div><div className="le">this counter</div></div>
        <div className="stat"><div className="big">{INVOICES.filter(v => v.status === 'pending').length}</div><div className="lh">Pending invoices</div><div className="le">₹5,250 outstanding</div></div>
        <div className="stat"><div className="big">62%</div><div className="lh">Digital payments</div><div className="le">UPI + card</div></div>
        <div className="stat"><div className="big">1</div><div className="lh">Scheme waivers</div><div className="le">JSY</div></div>
      </div>
      <div className="card mt">
        <SecHead title="Invoices" sub="today" more="New invoice" />
        <div className="tbl-scroll">
          <table className="tbl">
            <thead><tr><th>Invoice</th><th>Patient</th><th>Type</th><th>Amount</th><th>Mode</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {INVOICES.map(v => (
                <tr key={v.no}>
                  <td style={{ fontWeight: 700 }}>{v.no}</td><td>{v.name}</td><td>{v.type}</td>
                  <td style={{ fontWeight: 800 }}>{v.amount ? `₹${v.amount}` : '—'}</td><td>{v.mode}</td>
                  <td><StatusPill s={v.status} /></td>
                  <td>{v.status === 'pending' ? <button className="btn primary sm">Collect</button> : <button className="btn ghost sm">Receipt</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ---------- NURSE TRIAGE — vitals captured via the API ---------- */
export function Triage() {
  const [rows, setRows] = useState([]);
  const [live, setLive] = useState(false);
  const [sel, setSel] = useState(null);
  const [v, setV] = useState({ bp: '', pulse: '', temp: '', spo2: '', rr: '', weight: '' });
  const [msg, setMsg] = useState(null); // { ok, text }
  const [busy, setBusy] = useState(false);
  const setv = k => e => setV(x => ({ ...x, [k]: e.target.value }));

  const load = () => api.getQueue()
    .then(r => { setRows(r); setLive(true); })
    .catch(() => { setRows(mockQueue()); setLive(false); });
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, []);

  const pending = rows.filter(q => !q.vitalsDone && q.status !== 'done');

  const save = async (e) => {
    e.preventDefault();
    if (!sel) return;
    setMsg(null); setBusy(true);
    try {
      const body = {};
      if (v.bp) body.bp = v.bp;
      for (const k of ['pulse', 'temp', 'spo2', 'rr', 'weight']) if (v[k] !== '') body[k] = Number(v[k]);
      if (live) await api.saveVitals(sel.id, body);
      setMsg({ ok: true, text: `Vitals saved for ${sel.patient.name} (${sel.tokenNo}) — visible to the doctor now.` });
      setSel(null); setV({ bp: '', pulse: '', temp: '', spo2: '', rr: '', weight: '' });
      load();
    } catch (err) {
      setMsg({ ok: false, text: err.offline ? 'API unreachable — vitals not saved.' : err.message });
    } finally { setBusy(false); }
  };

  return (
    <div className="grid-2">
      <div>
        <SecHead title="Vitals pending — OPD triage" sub={`${pending.length} patients${live ? ' · live' : ' · offline demo'}`} />
        {pending.length === 0 && <div className="card empty">All caught up — no vitals pending. 🎉</div>}
        {pending.map(q => (
          <div key={q.id} className={`tok ${sel?.id === q.id ? 'now' : ''}`}>
            <div className="tno">{q.tokenNo}</div>
            <div className="tx"><b>{q.patient.name} · {q.patient.age} {q.patient.sex}</b><span>{q.patient.dept}{q.patient.complaint ? ` · ${q.patient.complaint.slice(0, 44)}…` : ''}</span></div>
            <div className="acts">
              <button className="btn primary sm" onClick={() => { setSel(q); setMsg(null); }}>
                {sel?.id === q.id ? 'Selected' : 'Record vitals'}
              </button>
            </div>
          </div>
        ))}
        {msg && (
          <div className="note-band" style={msg.ok ? { background: '#E3F3EC', borderColor: '#BFE5D4' } : { background: '#FBE5E3', borderColor: '#F2B8B3' }}>
            <span className="nd" style={{ background: msg.ok ? 'var(--green)' : 'var(--red)' }} />
            <div><b>{msg.text}</b></div>
          </div>
        )}
      </div>
      <form className="card" onSubmit={save}>
        <SecHead title="Capture vitals" sub={sel ? `${sel.patient.name} · token ${sel.tokenNo}` : 'select a patient from the queue'} />
        <div className="f-row">
          <div className="f-group"><label className="f-label">BP (mmHg)</label><input className="f-inp" placeholder="120/80" value={v.bp} onChange={setv('bp')} style={{ minHeight: 48, fontSize: 15 }} /></div>
          <div className="f-group"><label className="f-label">Pulse (bpm)</label><input className="f-inp" inputMode="numeric" placeholder="72" value={v.pulse} onChange={setv('pulse')} style={{ minHeight: 48, fontSize: 15 }} /></div>
        </div>
        <div className="f-row">
          <div className="f-group"><label className="f-label">Temp (°F)</label><input className="f-inp" inputMode="decimal" placeholder="98.6" value={v.temp} onChange={setv('temp')} style={{ minHeight: 48, fontSize: 15 }} /></div>
          <div className="f-group"><label className="f-label">SpO₂ (%)</label><input className="f-inp" inputMode="numeric" placeholder="98" value={v.spo2} onChange={setv('spo2')} style={{ minHeight: 48, fontSize: 15 }} /></div>
        </div>
        <div className="f-row">
          <div className="f-group"><label className="f-label">Weight (kg)</label><input className="f-inp" inputMode="decimal" value={v.weight} onChange={setv('weight')} style={{ minHeight: 48, fontSize: 15 }} /></div>
          <div className="f-group"><label className="f-label">RR (/min)</label><input className="f-inp" inputMode="numeric" value={v.rr} onChange={setv('rr')} style={{ minHeight: 48, fontSize: 15 }} /></div>
        </div>
        <button className="btn primary block" style={{ minHeight: 50 }} disabled={!sel || busy}>
          <Icon name="check" size={15} /> {busy ? 'Saving…' : sel ? `Save vitals for ${sel.tokenNo}` : 'Select a patient first'}
        </button>
      </form>
    </div>
  );
}

/* ---------- PHARMACY PAGES ---------- */
import { DEMO_PRESCRIPTIONS } from '../data.js';

export function RxList() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [selectedRx, setSelectedRx] = useState(null);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const prs = await api.getPrescriptions();
      setPrescriptions(prs.length ? prs : DEMO_PRESCRIPTIONS);
      setLive(true);
    } catch (err) {
      setPrescriptions(DEMO_PRESCRIPTIONS);
      setLive(false);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 8000);
    return () => clearInterval(timer);
  }, []);

  const handleUpdateStatus = async (rxId, status) => {
    setBusy(true);
    try {
      if (live) {
        await api.updatePrescriptionStatus(rxId, status);
      } else {
        setPrescriptions(prev => prev.map(p => p.id === rxId ? { ...p, status } : p));
      }
      
      // Update selected state locally
      if (selectedRx && selectedRx.id === rxId) {
        setSelectedRx(prev => ({ ...prev, status }));
      }
      load();
    } catch (err) {
      alert('Error updating status: ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  const filtered = prescriptions.filter(p => {
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const name = p.patient?.name || p.patientName || '';
    const token = p.tokenNo || '';
    const matchesSearch = name.toLowerCase().includes(search.toLowerCase()) || token.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  if (selectedRx) {
    const p = selectedRx;
    const patientName = p.patient?.name || p.patientName || 'Unknown';
    const patientAge = p.patient?.age || p.Age || '';
    const patientSex = p.patient?.sex || p.Sex || '';
    const patientMobile = p.patient?.mobile || p.Mobile || '';
    
    return (
      <div className="card">
        <div className="pt-head" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 15 }}>
          <button className="icon-btn" onClick={() => setSelectedRx(null)} title="Back to list"><Icon name="back" /></button>
          <div className="who">
            <b>{patientName} · {patientAge} {patientSex}</b>
            <span>Mobile: {patientMobile}</span>
          </div>
          <div className="meta">
            <Pill tone="info">Rx: {p.id}</Pill>
            <StatusPill s={p.status} />
          </div>
        </div>

        <SecHead title="Prescribed Medicines" sub={`Doctor: ${p.doctorName || 'General Practitioner'}`} />
        
        <div style={{ margin: '15px 0' }}>
          {p.items && p.items.map((item, idx) => (
            <div key={idx} className="lrow" style={{ padding: '12px 10px', background: 'var(--bg-card)', borderRadius: 8, marginBottom: 8, border: '1px solid var(--border)' }}>
              <Icon name="pill" size={18} style={{ color: 'var(--blue)', marginRight: 10 }} />
              <div className="tx">
                <b style={{ fontSize: 14 }}>{item.name || item.med}</b>
                <span>Dose: {item.dose} · Duration: {item.duration || item.days} days</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="badge" style={{ background: 'var(--sky)', color: 'var(--blue)', padding: '5px 10px', borderRadius: 4, fontWeight: 700 }}>
                  Qty: {item.qty}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button type="button" className="btn ghost" onClick={() => window.print()}>
            Print Prescription Slip
          </button>
          
          {p.status === 'pending' && (
            <button type="button" className="btn primary" onClick={() => handleUpdateStatus(p.id, 'dispensing')} disabled={busy}>
              Start Dispensing
            </button>
          )}
          
          {p.status === 'dispensing' && (
            <button type="button" className="btn primary" onClick={() => handleUpdateStatus(p.id, 'dispensed')} disabled={busy}>
              Confirm Dispensed (Hand over)
            </button>
          )}

          {p.status !== 'dispensed' && p.status !== 'cancelled' && (
            <button type="button" className="btn danger sm" onClick={() => handleUpdateStatus(p.id, 'cancelled')} disabled={busy}>
              Cancel Rx
            </button>
          )}

          <button type="button" className="btn ghost" onClick={() => setSelectedRx(null)}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="sec-head" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <b style={{ fontSize: 16 }}>Pharmacy Queue</b>
          <span> {live ? '· live' : '· offline demo'}</span>
        </div>
        <div className="seg">
          {[['all', 'All'], ['pending', 'Pending'], ['dispensing', 'Dispensing'], ['dispensed', 'Dispensed']].map(([k, l]) => (
            <button key={k} className={statusFilter === k ? 'on' : ''} onClick={() => setStatusFilter(k)}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 15 }}>
        <input className="f-inp" placeholder="Search by patient name or token number..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 && <div className="card empty">No prescriptions in this queue.</div>}
      
      {filtered.map(p => {
        const patientName = p.patient?.name || p.patientName || 'Unknown';
        const patientAge = p.patient?.age || p.Age || '';
        const patientSex = p.patient?.sex || p.Sex || '';
        const itemsCount = p.items ? p.items.length : 0;
        
        return (
          <div className="tok" key={p.id} onClick={() => setSelectedRx(p)} style={{ cursor: 'pointer' }}>
            <div className="tno" style={{ fontSize: 11 }}>{p.id.split('-')[1] || p.id}</div>
            <div className="tx">
              <b>{patientName} · {patientAge} {patientSex}</b>
              <span>ID: {p.id} · {itemsCount} items · {p.doctorName || 'Doctor'}</span>
            </div>
            <div className="acts" onClick={e => e.stopPropagation()}>
              <StatusPill s={p.status} />
              <button className="btn primary sm" onClick={() => setSelectedRx(p)}>
                {p.status === 'pending' ? 'Start Dispense' : p.status === 'dispensing' ? 'Complete' : 'Open'}
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}

export function Inventory() {
  return (
    <div className="card">
      <SecHead title="Central store inventory" sub={`${INVENTORY.length} tracked items`} more="Raise indent" />
      <div className="tbl-scroll">
        <table className="tbl">
          <thead><tr><th>Item</th><th>Category</th><th>Stock</th><th>Reorder at</th><th>Expiry</th><th>Status</th></tr></thead>
          <tbody>
            {INVENTORY.map(i => (
              <tr key={i.item}>
                <td style={{ fontWeight: 700 }}>{i.item}</td><td>{i.cat}</td>
                <td style={{ fontWeight: 800 }}>{i.stock}</td><td>{i.reorder}</td><td>{i.expiry}</td>
                <td><StatusPill s={i.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- ADMIN PAGES ---------- */
export function Analytics() {
  const beds = bedStats();
  const openDocs = () => {
    if (!api.accessToken) return alert('Sign in online to open the API documentation.');
    window.open(`/api-docs/?token=${encodeURIComponent(api.accessToken)}`, '_blank');
  };
  return (
    <>
      <div className="sec-head" style={{ alignItems: 'center' }}>
        <div><b style={{ fontSize: 16 }}>Analytics</b><span> · hospital performance</span></div>
        <button className="btn ghost sm" onClick={openDocs}><Icon name="doc" size={14} /> API documentation (Swagger)</button>
      </div>
      <div className="grid-2eq">
        <div className="card">
          <SecHead title="Patient load" sub="OPD vs IPD, this week" />
          <Bars data={WEEK_VISITS} keys={['opd', 'ipd']} labels={['OPD visits', 'IPD admissions']} height={200} />
        </div>
        <div className="card">
          <SecHead title="Capacity" sub="live" />
          <Meter label="All beds" value={beds.occ} total={beds.total} />
          {WARDS.map(w => <Meter key={w.code} label={w.name} value={w.beds.filter(b => b.patient).length} total={w.beds.length} />)}
        </div>
      </div>
      <div className="grid-2eq mt">
        <div className="card">
          <SecHead title="Key indicators" sub="month to date" />
          <div className="kv"><span className="k">Average length of stay</span><span className="v">3.4 days</span></div>
          <div className="kv"><span className="k">Bed turnover</span><span className="v">8.2 / bed / month</span></div>
          <div className="kv"><span className="k">OPD → IPD conversion</span><span className="v">6.8%</span></div>
          <div className="kv"><span className="k">Left against medical advice</span><span className="v">1.2%</span></div>
          <div className="kv"><span className="k">Average OPD wait</span><span className="v">14 min</span></div>
        </div>
        <div className="card">
          <SecHead title="Alerts" />
          <div className="lrow"><Pill tone="bad">Stock</Pill><div className="tx"><b>Rabies vaccine critical (12 left)</b><span>Indent raised · expected in 2 days</span></div></div>
          <div className="lrow"><Pill tone="warn">Capacity</Pill><div className="tx"><b>ICU at 75%</b><span>1 bed free · escalation plan on standby</span></div></div>
          <div className="lrow"><Pill tone="info">HR</Pill><div className="tx"><b>Night-shift nurse roster gap on Sat</b><span>Approve swap request from Sr. B. Ekka</span></div></div>
        </div>
      </div>
    </>
  );
}

export function StaffPage() {
  return (
    <div className="card">
      <SecHead title="Staff roster" sub="today" more="Edit roster" />
      <div className="tbl-scroll">
        <table className="tbl">
          <thead><tr><th>Name</th><th>Role</th><th>Shift</th><th>Status</th></tr></thead>
          <tbody>
            {STAFF.map(s => (
              <tr key={s.name}>
                <td style={{ fontWeight: 700 }}><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Avatar name={s.name} size="sm" />{s.name}</div></td>
                <td>{s.role}</td><td>{s.shift}</td><td><StatusPill s={s.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- NURSE WARD (bed board + tasks) ---------- */
export function NurseWard({ openChart }) {
  return (
    <>
      <div className="grid-2">
        <div className="card">
          <SecHead title="Due now" sub="medication & care" />
          {NURSE_TASKS.filter(t => !t.done).slice(0, 4).map((t, i) => (
            <div className="lrow" key={i}>
              <Pill tone={t.kind === 'med' ? 'info' : 'warn'}>{t.time}</Pill>
              <div className="tx"><b>{t.task}</b><span>Bed {t.bed}</span></div>
              <button className="btn ghost sm">Done</button>
            </div>
          ))}
        </div>
        <div className="card">
          <SecHead title="Watch list" />
          {WARDS.flatMap(w => w.beds.filter(b => b.state === 'critical' || b.state === 'watch').map(b => ({ ...b, ward: w.name }))).slice(0, 4).map(b => (
            <div className="lrow click" key={b.no} onClick={() => openChart(b)}>
              <div className="tx"><b>{b.patient} · {b.no}</b><span>{b.dx}</span></div>
              <StatusPill s={b.state} />
            </div>
          ))}
        </div>
      </div>
      <div className="mt" />
    </>
  );
}
