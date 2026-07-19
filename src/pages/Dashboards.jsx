import { useState, useEffect } from 'react';
import Icon from '../icons.jsx';
import { Stat, SecHead, Bars, Meter, StatusPill, Avatar, Pill } from '../ui.jsx';
import { OPD_QUEUE, PATIENTS, WARDS, WEEK_VISITS, APPOINTMENTS, RX_QUEUE, INVENTORY, STAFF, NURSE_TASKS, INVOICES, bedStats, DEMO_FACILITIES } from '../data.js';
import { api } from '../api.js';

const pt = pid => PATIENTS.find(p => p.id === pid);

function Hero({ name, line, children }) {
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return (
    <div className="hero">
      <div className="greet">
        <div className="g">{greet} <span className="hin">· नमस्ते</span></div>
        <div className="n">{name}</div>
        <div className="s">{line}</div>
      </div>
      <div className="h-acts">{children}</div>
    </div>
  );
}

/* ---------- DOCTOR ---------- */
export function DoctorDashboard({ go, openConsult }) {
  const waiting = OPD_QUEUE.filter(q => q.status !== 'done' && q.status !== 'in-consult');
  const current = OPD_QUEUE.find(q => q.status === 'in-consult');
  const beds = bedStats();
  return (
    <>
      <Hero name="Dr. Ravi Verma" line={`OPD 9:00–13:00 · Room 104 · ${OPD_QUEUE.length} booked today`}>
        {current && <button className="btn amber" onClick={() => openConsult(current)}><Icon name="stetho" size={16} /> Resume {current.token}</button>}
        <button className="btn ghost" style={{ background: 'rgba(255,255,255,.14)', border: 0, color: '#fff' }} onClick={() => go('ipd')}><Icon name="bed" size={16} /> Ward rounds</button>
      </Hero>

      <div className="stat-grid">
        <Stat icon="users" big={OPD_QUEUE.length} label="OPD patients today" sub="6 seen · 1 in consult" delta="12% vs yesterday" dir="up" />
        <Stat icon="pulse" tint="#FDF1DA" ink="#8a5a00" big={waiting.length} label="Waiting now" sub={`Next token ${waiting[0]?.token || '—'}`} />
        <Stat icon="bed" tint="#FDEEF4" ink="#B03A6B" big="9" label="IPD under my care" sub="2 discharge-ready" />
        <Stat icon="flask" tint="#E9F7F1" ink="#116B46" big="5" label="Lab results pending" sub="2 flagged abnormal" delta="review needed" dir="down" />
      </div>

      <div className="grid-2 mt">
        <div className="card">
          <SecHead title="OPD queue" sub="live" more="Open queue" onMore={() => go('opd')} />
          {(current ? [current, ...waiting] : waiting).slice(0, 4).map(q => {
            const p = pt(q.pid);
            return (
              <div key={q.token} className={`tok ${q.status === 'in-consult' ? 'now' : ''}`} style={{ marginBottom: 10 }}>
                <div className="tno">{q.token}</div>
                <div className="tx">
                  <b>{p.name} · {p.age}{p.sex}</b>
                  <span>{p.complaint.slice(0, 52)}…</span>
                </div>
                <div className="acts">
                  {q.priority === 'urgent' && <StatusPill s="urgent" />}
                  <StatusPill s={q.status} />
                  <button className="btn primary sm" onClick={() => openConsult(q)}>
                    {q.status === 'in-consult' ? 'Resume' : 'Start'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="stack">
          <div className="card">
            <SecHead title="This week" sub="OPD consultations" />
            <Bars data={WEEK_VISITS} keys={['opd']} labels={['OPD visits']} height={150} />
          </div>
          <div className="card">
            <SecHead title="Ward snapshot" more="Bed board" onMore={() => go('ipd')} />
            <Meter label="Overall occupancy" value={beds.occ} total={beds.total} />
            <Meter label="ICU" value={3} total={4} />
            <div className="note-band" style={{ marginTop: 12 }}>
              <span className="nd" />
              <div><b>2 critical patients in ICU</b><span>Shanta Bai (septic shock) · Vikram Rathore (post-STEMI)</span></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------- NURSE ---------- */
export function NurseDashboard({ go }) {
  const beds = bedStats();
  const pending = NURSE_TASKS.filter(t => !t.done);
  return (
    <>
      <Hero name="Sr. Meena Joshi" line="Morning shift · General Ward & ICU · 14 patients assigned">
        <button className="btn amber" onClick={() => go('triage')}><Icon name="pulse" size={16} /> Record vitals</button>
      </Hero>
      <div className="stat-grid">
        <Stat icon="clip" big={pending.length} label="Tasks due" sub="Next at 11:00" delta="2 medication rounds" dir="flat" />
        <Stat icon="pulse" tint="#FDF1DA" ink="#8a5a00" big={OPD_QUEUE.filter(q => !q.vitalsDone).length} label="Vitals pending (OPD)" sub="Triage queue" />
        <Stat icon="bed" tint="#FDEEF4" ink="#B03A6B" big={`${beds.pct}%`} label="Bed occupancy" sub={`${beds.occ}/${beds.total} occupied`} />
        <Stat icon="warn" tint="#FBE5E3" ink="#A02E24" big="3" label="Patients on watch" sub="Dengue · PIH · Bronchiolitis" />
      </div>
      <div className="grid-2 mt">
        <div className="card">
          <SecHead title="Task list" sub="medication & care due" more="Ward view" onMore={() => go('ward')} />
          {NURSE_TASKS.map((t, i) => (
            <div className="lrow" key={i}>
              <Pill tone={t.done ? 'ok' : t.kind === 'med' ? 'info' : 'warn'}>{t.time}</Pill>
              <div className="tx"><b style={t.done ? { textDecoration: 'line-through', color: 'var(--muted)' } : null}>{t.task}</b><span>Bed {t.bed}</span></div>
              {t.done ? <Pill tone="ok">Done</Pill> : <button className="btn ghost sm">Mark done</button>}
            </div>
          ))}
        </div>
        <div className="card">
          <SecHead title="Ward occupancy" more="Bed board" onMore={() => go('ward')} />
          {WARDS.map(w => (
            <Meter key={w.code} label={w.name} value={w.beds.filter(b => b.patient).length} total={w.beds.length} />
          ))}
          <div className="note-band" style={{ marginTop: 14 }}>
            <span className="nd" />
            <div><b>Shift handover at 14:00</b><span>Update nursing notes for GW-07 and ICU-3 before handover.</span></div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------- RECEPTION ---------- */
export function ReceptionDashboard({ go }) {
  return (
    <>
      <Hero name="Rahul Sen" line="Registration Counter 2 · Token series A · Avg wait 12 min">
        <button className="btn amber" onClick={() => go('register')}><Icon name="plus" size={16} /> New patient</button>
        <button className="btn ghost" style={{ background: 'rgba(255,255,255,.14)', border: 0, color: '#fff' }} onClick={() => go('appointments')}><Icon name="cal" size={16} /> Book slot</button>
      </Hero>
      <div className="stat-grid">
        <Stat icon="users" big="86" label="Registrations today" sub="14 new · 72 revisit" delta="8% vs yesterday" dir="up" />
        <Stat icon="cal" tint="#E9F7F1" ink="#116B46" big={APPOINTMENTS.length} label="Appointments" sub="2 slots free before 1 PM" />
        <Stat icon="rupee" tint="#FDF1DA" ink="#8a5a00" big="₹18.4k" label="Collections" sub="UPI 62% · Cash 38%" delta="2 invoices pending" dir="flat" />
        <Stat icon="warn" tint="#FBE5E3" ink="#A02E24" big="12 min" label="Average wait" sub="Peak 10–11 AM" delta="3 min better" dir="up" />
      </div>
      <div className="grid-2 mt">
        <div className="card">
          <SecHead title="Today's appointments" more="All" onMore={() => go('appointments')} />
          <div className="tbl-scroll">
            <table className="tbl">
              <thead><tr><th>Time</th><th>Patient</th><th>Department</th><th>Doctor</th><th>Status</th></tr></thead>
              <tbody>
                {APPOINTMENTS.slice(0, 6).map(a => (
                  <tr key={a.time + a.name}>
                    <td style={{ fontWeight: 700 }}>{a.time}</td><td>{a.name}</td><td>{a.dept}</td><td>{a.doctor}</td>
                    <td><StatusPill s={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <SecHead title="Recent invoices" more="Billing" onMore={() => go('billing')} />
          {INVOICES.slice(0, 5).map(v => (
            <div className="lrow" key={v.no}>
              <div className="tx"><b>{v.name}</b><span>{v.no} · {v.type}</span></div>
              <div style={{ textAlign: 'right' }}>
                <b style={{ fontSize: 13 }}>{v.amount ? `₹${v.amount}` : '—'}</b>
                <div><StatusPill s={v.status} /></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ---------- PHARMACY ---------- */
export function PharmacyDashboard({ go }) {
  const low = INVENTORY.filter(i => i.status !== 'ok');
  return (
    <>
      <Hero name="Vikas Rao" line="Central Pharmacy · 5 prescriptions in queue · Lab desk linked">
        <button className="btn amber" onClick={() => go('prescriptions')}><Icon name="pill" size={16} /> Dispense next</button>
      </Hero>
      <div className="stat-grid">
        <Stat icon="pill" big={RX_QUEUE.length} label="Rx in queue" sub="1 ready · 1 dispensing" />
        <Stat icon="flask" tint="#E9F7F1" ink="#116B46" big="9" label="Lab samples pending" sub="3 urgent (ICU)" />
        <Stat icon="box" tint="#FDF1DA" ink="#8a5a00" big={low.length} label="Stock alerts" sub="1 critical · reorder due" delta="Rabies vaccine critical" dir="down" />
        <Stat icon="rupee" tint="#EFEDFB" ink="#4c3fa0" big="₹42k" label="Issued today" sub="OPD + ward indents" />
      </div>
      <div className="grid-2 mt">
        <div className="card">
          <SecHead title="Prescription queue" more="All" onMore={() => go('prescriptions')} />
          {RX_QUEUE.map(r => (
            <div className="lrow" key={r.rx}>
              <div className="tx"><b>{r.name}</b><span>{r.rx} · {r.items} items · {r.doctor}</span></div>
              <StatusPill s={r.status} />
              <button className="btn primary sm">{r.status === 'ready' ? 'Hand over' : 'Open'}</button>
            </div>
          ))}
        </div>
        <div className="card">
          <SecHead title="Stock alerts" more="Inventory" onMore={() => go('inventory')} />
          {low.map(i => (
            <div className="lrow" key={i.item}>
              <div className="tx"><b>{i.item}</b><span>{i.stock} units · reorder at {i.reorder}</span></div>
              <StatusPill s={i.status} />
            </div>
          ))}
          <div className="note-band" style={{ marginTop: 12 }}>
            <span className="nd" />
            <div><b>Indent window closes 4 PM</b><span>Raise the weekly indent to district store before closing.</span></div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------- ADMIN ---------- */
export function AdminDashboard({ go }) {
  const [facilities, setFacilities] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState('DIST_HOSP_01');
  const [stats, setStats] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInitial() {
      try {
        const facs = await api.getFacilities();
        setFacilities(facs.length ? facs : DEMO_FACILITIES);
      } catch (err) {
        setFacilities(DEMO_FACILITIES);
      }
    }
    loadInitial();
  }, []);

  const refreshData = async () => {
    setLoading(true);
    try {
      const s = await api.getAdminFlowStats(selectedFacility);
      setStats(s);
    } catch (err) {
      setStats({
        totalTokens: 15,
        waiting: 5,
        calling: 1,
        inConsult: 1,
        done: 8,
        atPharmacy: 2,
        dispensed: 6,
        avgWaitTimeMin: 12,
        avgConsultTimeMin: 8
      });
    }

    try {
      const t = await api.getAdminTimeline(selectedFacility);
      setTimeline(t);
    } catch (err) {
      setTimeline([
        { tokenId: 'T-14', tokenNo: 'A-14', patientName: 'Ramesh P.', dept: 'General Medicine', status: 'in-consult', priority: 'normal', vitalsDone: true, issuedAt: new Date().toISOString(), prescriptionStatus: 'pending' },
        { tokenId: 'T-15', tokenNo: 'A-15', patientName: 'Arjun M.', dept: 'Pediatrics', status: 'waiting', priority: 'urgent', vitalsDone: true, issuedAt: new Date().toISOString(), prescriptionStatus: null },
        { tokenId: 'T-16', tokenNo: 'A-16', patientName: 'Mohan L.', dept: 'General Medicine', status: 'waiting', priority: 'normal', vitalsDone: true, issuedAt: new Date().toISOString(), prescriptionStatus: null },
        { tokenId: 'T-18', tokenNo: 'D-07', patientName: 'Fatima B.', dept: 'Orthopedics', status: 'waiting', priority: 'normal', vitalsDone: false, issuedAt: new Date().toISOString(), prescriptionStatus: null },
        { tokenId: 'T-19', tokenNo: 'E-03', patientName: 'Kavita S.', dept: 'ENT', status: 'checked-in', priority: 'normal', vitalsDone: false, issuedAt: new Date().toISOString(), prescriptionStatus: null }
      ]);
    }
    setLoading(false);
  };

  useEffect(() => {
    refreshData();
  }, [selectedFacility]);

  // Flow classification
  const triage = timeline.filter(t => t.status === 'checked-in' || (t.status === 'waiting' && !t.vitalsDone));
  const waiting = timeline.filter(t => t.status === 'waiting' && t.vitalsDone);
  const inConsult = timeline.filter(t => t.status === 'in-consult');
  const pharmacy = timeline.filter(t => t.prescriptionStatus === 'pending' || t.prescriptionStatus === 'dispensing');
  const completed = timeline.filter(t => t.status === 'done' && (t.prescriptionStatus === 'dispensed' || !t.prescriptionStatus));

  return (
    <>
      <Hero name="Dr. S. Kulkarni" line="Medical Superintendent · End-to-End Flow Control">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select value={selectedFacility} onChange={e => setSelectedFacility(e.target.value)} className="f-sel inline-sel dark-sel">
            {facilities.map(f => (
              <option key={f.code} value={f.code}>{f.name}</option>
            ))}
          </select>
          <button className="btn amber" onClick={refreshData} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh Board'}
          </button>
        </div>
      </Hero>

      {stats && (
        <div className="stat-grid">
          <Stat icon="users" big={stats.totalTokens} label="Total Issued Today" sub="Patients registered" />
          <Stat icon="pulse" tint="#FDF1DA" ink="#8a5a00" big={triage.length + waiting.length} label="Waiting in Queue" sub={`${triage.length} triage · ${waiting.length} OPD`} />
          <Stat icon="stetho" tint="#E9F7F1" ink="#116B46" big={inConsult.length} label="In Consultation" sub="Currently serving" />
          <Stat icon="pill" tint="#EFEDFB" ink="#4c3fa0" big={pharmacy.length} label="At Pharmacy" sub="Prescriptions pending" />
        </div>
      )}

      {/* Patient Flow Pipeline Kanban */}
      <div className="card mt">
        <SecHead title="Live Patient Flow Pipeline" sub="Real-time status of all hospital tokens today" />
        
        <div className="flow-pipeline">
          {/* Column 1 */}
          <div className="pipeline-col">
            <div className="col-head triage-head">
              <span>Triage / Vitals</span>
              <span className="col-badge">{triage.length}</span>
            </div>
            <div className="col-cards">
              {triage.length === 0 && <div className="col-empty">No patients in triage</div>}
              {triage.map(t => (
                <div key={t.tokenId} className="flow-card">
                  <div className="card-top">
                    <span className="card-token">{t.tokenNo}</span>
                    {t.priority === 'urgent' && <Pill tone="bad">Urgent</Pill>}
                  </div>
                  <div className="card-name">{t.patientName}</div>
                  <div className="card-dept">{t.dept}</div>
                  <div className="card-status"><Pill tone="warn">Vitals Pending</Pill></div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2 */}
          <div className="pipeline-col">
            <div className="col-head waiting-head">
              <span>OPD Waiting</span>
              <span className="col-badge">{waiting.length}</span>
            </div>
            <div className="col-cards">
              {waiting.length === 0 && <div className="col-empty">No patients waiting</div>}
              {waiting.map(t => (
                <div key={t.tokenId} className="flow-card">
                  <div className="card-top">
                    <span className="card-token">{t.tokenNo}</span>
                    {t.priority === 'urgent' && <Pill tone="bad">Urgent</Pill>}
                  </div>
                  <div className="card-name">{t.patientName}</div>
                  <div className="card-dept">{t.dept}</div>
                  <div className="card-status"><Pill tone="info">Waiting</Pill></div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 3 */}
          <div className="pipeline-col">
            <div className="col-head consult-head">
              <span>In Consult</span>
              <span className="col-badge">{inConsult.length}</span>
            </div>
            <div className="col-cards">
              {inConsult.length === 0 && <div className="col-empty">No patients in consult</div>}
              {inConsult.map(t => (
                <div key={t.tokenId} className="flow-card active-card">
                  <div className="card-top">
                    <span className="card-token">{t.tokenNo}</span>
                    {t.priority === 'urgent' && <Pill tone="bad">Urgent</Pill>}
                  </div>
                  <div className="card-name">{t.patientName}</div>
                  <div className="card-dept">{t.dept}</div>
                  <div className="card-status"><StatusPill s="in-consult" /></div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 4 */}
          <div className="pipeline-col">
            <div className="col-head pharmacy-head">
              <span>Pharmacy Queue</span>
              <span className="col-badge">{pharmacy.length}</span>
            </div>
            <div className="col-cards">
              {pharmacy.length === 0 && <div className="col-empty">No prescriptions pending</div>}
              {pharmacy.map(t => (
                <div key={t.tokenId} className="flow-card">
                  <div className="card-top">
                    <span className="card-token">{t.tokenNo}</span>
                  </div>
                  <div className="card-name">{t.patientName}</div>
                  <div className="card-dept">{t.dept}</div>
                  <div className="card-status">
                    <Pill tone={t.prescriptionStatus === 'dispensing' ? 'warn' : 'info'}>
                      {t.prescriptionStatus === 'dispensing' ? 'Dispensing' : 'Rx Pending'}
                    </Pill>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 5 */}
          <div className="pipeline-col">
            <div className="col-head completed-head">
              <span>Discharged / Done</span>
              <span className="col-badge">{completed.length}</span>
            </div>
            <div className="col-cards">
              {completed.length === 0 && <div className="col-empty">No completions yet</div>}
              {completed.map(t => (
                <div key={t.tokenId} className="flow-card done-card">
                  <div className="card-top">
                    <span className="card-token">{t.tokenNo}</span>
                  </div>
                  <div className="card-name">{t.patientName}</div>
                  <div className="card-dept">{t.dept}</div>
                  <div className="card-status"><Pill tone="ok">Consult & Rx Done</Pill></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2 mt">
        <div className="card">
          <SecHead title="Hospital Capacity & Load" sub="OPD and IPD weekly trends" />
          <Bars data={WEEK_VISITS} keys={['opd', 'ipd']} labels={['OPD visits', 'IPD admissions']} height={190} />
        </div>
        <div className="card">
          <SecHead title="Live Audit Timeline" sub="Chronological actions today" />
          <div className="timeline-timeline" style={{ maxHeight: 220, overflowY: 'auto' }}>
            {timeline.slice(0, 10).map((t, idx) => (
              <div key={t.tokenId || idx} className="lrow" style={{ padding: '8px 0' }}>
                <span style={{ fontSize: 12, color: '#777' }}>
                  {t.issuedAt ? new Date(t.issuedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                </span>
                <div className="tx">
                  <b>Token {t.tokenNo} ({t.patientName})</b>
                  <span>Department: {t.dept}</span>
                </div>
                <div>
                  <Pill tone={t.status === 'done' ? 'ok' : t.status === 'in-consult' ? 'info' : 'warn'}>
                    {t.status}
                  </Pill>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
