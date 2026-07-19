import { useState } from 'react';
import Icon from '../icons.jsx';
import { SecHead, Pill, StatusPill, VitalTile, Meter } from '../ui.jsx';
import { WARDS, bedStats } from '../data.js';

/* ---------- BED BOARD ---------- */
export function BedBoard({ openChart, role }) {
  const [ward, setWard] = useState('All');
  const beds = bedStats();
  const shown = WARDS.filter(w => ward === 'All' || w.name === ward);
  return (
    <>
      <div className="sec-head" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <b style={{ fontSize: 16 }}>Bed board</b>
          <span> · {beds.occ}/{beds.total} occupied ({beds.pct}%)</span>
        </div>
        <div className="seg">
          {['All', ...WARDS.map(w => w.name)].map(w => (
            <button key={w} className={ward === w ? 'on' : ''} onClick={() => setWard(w)}>{w}</button>
          ))}
        </div>
      </div>

      {shown.map(w => (
        <div key={w.code} className="mt">
          <SecHead title={w.name} sub={`${w.beds.filter(b => b.patient).length}/${w.beds.length} occupied`} />
          <div className="bed-grid">
            {w.beds.map(b => b.patient ? (
              <button key={b.no} className={`bed ${b.state === 'critical' ? 'critical' : b.state === 'watch' ? 'watch' : ''}`} onClick={() => openChart({ ...b, ward: w.name })}>
                <span className="stripe" />
                <div className="bno">{b.no} <StatusPill s={b.state} /></div>
                <div className="bnm">{b.patient}</div>
                <div className="bdx">{b.dx}</div>
                <div className="bft">
                  <span className="los">Day {b.los}</span>
                  <span style={{ color: 'var(--blue)', fontWeight: 800, fontSize: 11 }}>Open chart →</span>
                </div>
              </button>
            ) : (
              <div key={b.no} className="bed free">
                <div className="bno">{b.no}</div>
                <div className="bfree">● Available</div>
                {role === 'doctor' || role === 'reception' ? <div className="bft"><span style={{ fontSize: 10.5, color: 'var(--muted)' }}>Assign on admission</span></div> : null}
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

/* ---------- IPD PATIENT CHART (left tabs, same-page switching) ---------- */
const IPD_TABS = [
  { key: 'overview', label: 'Overview', hin: 'सारांश', icon: 'doc' },
  { key: 'vitals', label: 'Vitals Trend', hin: 'वाइटल्स', icon: 'pulse' },
  { key: 'mar', label: 'Medications', hin: 'दवाएं', icon: 'pill' },
  { key: 'notes', label: 'Progress Notes', hin: 'नोट्स', icon: 'clip' },
  { key: 'orders', label: 'Orders & Labs', hin: 'जांच', icon: 'flask' },
  { key: 'discharge', label: 'Discharge', hin: 'डिस्चार्ज', icon: 'out' },
];

const MAR = [
  { med: 'Inj. Ceftriaxone 1g IV', freq: 'BD', slots: ['06:00 ✓', '18:00 —'] },
  { med: 'Tab. Paracetamol 650', freq: 'SOS', slots: ['10:20 ✓ (fever)'] },
  { med: 'IV NS @ 75 ml/hr', freq: 'Continuous', slots: ['Running'] },
  { med: 'Inj. Pantoprazole 40', freq: 'OD', slots: ['06:00 ✓'] },
];

export function IpdChart({ bed, onClose }) {
  const [tab, setTab] = useState('overview');
  const panel = {
    overview: (
      <div className="grid-2eq">
        <div className="card">
          <SecHead title="Admission details" />
          <div className="kv"><span className="k">Ward · Bed</span><span className="v">{bed.ward} · {bed.no}</span></div>
          <div className="kv"><span className="k">Diagnosis</span><span className="v">{bed.dx}</span></div>
          <div className="kv"><span className="k">Day of stay</span><span className="v">Day {bed.los}</span></div>
          <div className="kv"><span className="k">Consultant</span><span className="v">Dr. Ravi Verma</span></div>
          <div className="kv"><span className="k">Diet</span><span className="v">Soft diabetic diet</span></div>
          <div className="kv"><span className="k">Status</span><span className="v"><StatusPill s={bed.state} /></span></div>
        </div>
        <div className="card">
          <SecHead title="Today's plan" sub="rounds 09:30" />
          <div className="lrow"><Pill tone="info">08:00</Pill><div className="tx"><b>Repeat CBC & CRP</b><span>Sample collected, report awaited</span></div></div>
          <div className="lrow"><Pill tone="info">11:00</Pill><div className="tx"><b>IV antibiotic dose 2</b><span>Ceftriaxone 1g — due</span></div></div>
          <div className="lrow"><Pill tone="warn">14:00</Pill><div className="tx"><b>Physician review</b><span>Assess for step-down to oral</span></div></div>
        </div>
      </div>
    ),
    vitals: (
      <div className="card">
        <SecHead title="Latest vitals" sub="q4h monitoring · nurse charted 10:00" />
        <div className="vitals-grid">
          <VitalTile label="Blood pressure" value="124/80" unit="mmHg" />
          <VitalTile label="Pulse" value="88" unit="bpm" />
          <VitalTile label="Temperature" value="99.8" unit="°F" tone="warn" />
          <VitalTile label="SpO₂" value="96%" unit="2L O₂" tone="warn" />
        </div>
        <SecHead title="Temperature trend" sub="last 6 readings" />
        <svg viewBox="0 0 560 120" style={{ width: '100%', display: 'block' }} role="img" aria-label="Temperature trend">
          {[100, 60, 20].map(gy => <line key={gy} x1="30" x2="560" y1={gy} y2={gy} stroke="var(--line)" />)}
          {['98', '100', '102'].map((t, i) => <text key={t} x="24" y={104 - i * 40} fontSize="9.5" fill="var(--muted)" textAnchor="end">{t}°</text>)}
          <polyline points="60,30 150,44 240,52 330,68 420,74 510,66" fill="none" stroke="var(--s1)" strokeWidth="2" strokeLinejoin="round" />
          {[[60, 30], [150, 44], [240, 52], [330, 68], [420, 74], [510, 66]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="4" fill="var(--s1)" stroke="#fff" strokeWidth="2" />
          ))}
          {['D1', 'D1', 'D2', 'D2', 'D3', 'Now'].map((l, i) => (
            <text key={i} x={60 + i * 90} y="116" fontSize="9.5" fill="var(--muted)" textAnchor="middle">{l}</text>
          ))}
        </svg>
      </div>
    ),
    mar: (
      <div className="card">
        <SecHead title="Medication administration record" sub="today" />
        <div className="tbl-scroll">
          <table className="tbl">
            <thead><tr><th>Medicine</th><th>Frequency</th><th>Today's slots</th></tr></thead>
            <tbody>
              {MAR.map(m => (
                <tr key={m.med}><td style={{ fontWeight: 700 }}>{m.med}</td><td>{m.freq}</td><td>{m.slots.join(' · ')}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="btn ghost sm" style={{ marginTop: 12 }}><Icon name="plus" size={14} /> Add order</button>
      </div>
    ),
    notes: (
      <div className="grid-2eq">
        <div className="card">
          <SecHead title="Progress notes" />
          <div className="tl">
            <div className="tl-item"><b>Day {bed.los} · Morning rounds</b><span>Today 09:30 · Dr. Ravi Verma</span><p>Afebrile overnight spike settled with PCM. Chest clearer on right base. Continue IV antibiotics, reassess for oral switch tomorrow.</p></div>
            <div className="tl-item"><b>Nursing note</b><span>Today 06:00 · Sr. Meena Joshi</span><p>Slept well. Tolerating oral feeds. IV site healthy, no phlebitis.</p></div>
            <div className="tl-item"><b>Admission note</b><span>{bed.los} days ago · ER</span><p>Admitted with {bed.dx?.toLowerCase()}. Baseline workup sent, first antibiotic dose given in ER.</p></div>
          </div>
        </div>
        <div className="card">
          <SecHead title="Add note" />
          <textarea className="f-area" style={{ minHeight: 130 }} placeholder="SOAP note…" />
          <button className="btn primary block" style={{ marginTop: 12 }}>Sign & save note</button>
        </div>
      </div>
    ),
    orders: (
      <div className="card">
        <SecHead title="Active orders" />
        <div className="lrow"><Pill tone="ok">Lab</Pill><div className="tx"><b>CBC, CRP — repeat</b><span>Sample collected 08:10 · report awaited</span></div><StatusPill s="in-progress" /></div>
        <div className="lrow"><Pill tone="info">Imaging</Pill><div className="tx"><b>Chest X-ray PA</b><span>Done Day 1 · consolidation right base</span></div><StatusPill s="done" /></div>
        <div className="lrow"><Pill tone="warn">Diet</Pill><div className="tx"><b>Soft diabetic diet</b><span>1800 kcal · dietician informed</span></div><StatusPill s="in-progress" /></div>
        <button className="btn ghost sm" style={{ marginTop: 10 }}><Icon name="plus" size={14} /> New order</button>
      </div>
    ),
    discharge: (
      <div className="card">
        <SecHead title="Discharge planning" sub="checklist before initiating" />
        {[
          ['Clinically stable 24 hrs', true],
          ['Switched to oral medication', false],
          ['Pending reports reviewed', false],
          ['Pharmacy clearance & take-home meds', false],
          ['Billing / scheme paperwork', false],
        ].map(([t, ok]) => (
          <div className="lrow" key={t}>
            <Pill tone={ok ? 'ok' : 'neu'}>{ok ? '✓' : '·'}</Pill>
            <div className="tx"><b style={ok ? null : { color: 'var(--muted)' }}>{t}</b></div>
          </div>
        ))}
        <div className="f-row" style={{ marginTop: 14 }}>
          <button className="btn ghost">Draft discharge summary</button>
          <button className="btn primary" disabled style={{ opacity: .55, cursor: 'not-allowed' }}>Initiate discharge</button>
        </div>
      </div>
    ),
  }[tab];

  return (
    <div className="ws">
      <aside className="ws-rail">
        <div className="rail-head">Inpatient chart</div>
        {IPD_TABS.map(t => (
          <button key={t.key} className={`ws-tab ${tab === t.key ? 'on' : ''}`} onClick={() => setTab(t.key)} title={t.label}>
            <Icon name={t.icon} />
            <span className="lab">{t.label}<span className="sub hin">{t.hin}</span></span>
          </button>
        ))}
      </aside>
      <div className="ws-main">
        <div className="pt-head">
          <button className="icon-btn" onClick={onClose} title="Back to bed board"><Icon name="back" /></button>
          <div className="who">
            <b>{bed.patient}</b>
            <span>{bed.ward} · {bed.no} · Day {bed.los}</span>
          </div>
          <div className="meta">
            <Pill tone="info">{bed.dx}</Pill>
            <StatusPill s={bed.state} />
          </div>
          <div className="acts"><button className="btn ghost sm"><Icon name="history" size={14} /> Full EMR</button></div>
        </div>
        <div className="ws-body">{panel}</div>
        <div className="ws-foot">
          <span className="hint">All entries are signed with your login · audit trail enabled</span>
          <button className="btn ghost" onClick={onClose}>Close chart</button>
          <button className="btn primary"><Icon name="check" size={15} /> Save updates</button>
        </div>
      </div>
    </div>
  );
}
