import { useEffect, useState } from 'react';
import Icon from '../icons.jsx';
import { SecHead, Pill, StatusPill, VitalTile } from '../ui.jsx';
import { api } from '../api.js';
import Ehr from './Ehr.jsx';

const fmtV = v => (v === undefined || v === null || v === '') ? '—' : v;

/**
 * Read-only completed-consultation record. Shown to doctor & nurse once a
 * consultation is done — no editing, current prescription status visible.
 */
export default function ConsultView({ patient, tokenId, tokenNo, onClose }) {
  const [rec, setRec] = useState(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('record'); // 'record' | 'ehr'

  useEffect(() => {
    let alive = true;
    if (!tokenId || !api.online) { setErr('offline'); return; }
    api.getConsultByToken(tokenId)
      .then(r => { if (alive) setRec(r); })
      .catch(e => { if (alive) setErr(e.message || 'not found'); });
    return () => { alive = false; };
  }, [tokenId]);

  const p = rec?.patient || patient;
  const c = rec?.consult;
  const rx = rec?.prescription;
  const dxList = c?.dx ? c.dx.split(';').map(s => s.trim()).filter(Boolean) : [];

  return (
    <div className="ws">
      <aside className="ws-rail">
        <div className="rail-head">Record</div>
        <button className={`ws-tab ${tab === 'record' ? 'on' : ''}`} onClick={() => setTab('record')} title="Consultation">
          <Icon name="doc" /><span className="lab">Consultation<span className="sub hin">परामर्श</span></span>
        </button>
        <button className={`ws-tab ${tab === 'ehr' ? 'on' : ''}`} onClick={() => setTab('ehr')} title="e-HR">
          <Icon name="history" /><span className="lab">e-HR Record<span className="sub hin">हेल्थ रिकॉर्ड</span></span>
        </button>
      </aside>

      <div className="ws-main">
        <div className="pt-head">
          <button className="icon-btn" onClick={onClose} title="Back"><Icon name="back" /></button>
          <div className="who">
            <b>{p?.name} · {p?.age} {p?.sex}</b>
            <span>{p?.id}{p?.abha ? ` · ABHA ${p.abha}` : ''}</span>
          </div>
          <div className="meta">
            {tokenNo && <Pill tone="info">Token {tokenNo}</Pill>}
            {p?.dept && <Pill tone="info">{p.dept}</Pill>}
            <StatusPill s="done" />
          </div>
        </div>

        <div className="ws-body">
          <div className="ro-banner">
            <span className="dot" />
            Completed consultation — view only{c?.completedAt ? ` · ${new Date(c.completedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}{c?.doctorName ? ` · ${c.doctorName}` : ''}
          </div>

          {err && !rec && <div className="card empty">Could not load this record ({err}).</div>}

          {tab === 'record' && rec && (
            <div className="grid-2eq">
              <div className="stack">
                <div className="card">
                  <SecHead title="Presenting complaint" />
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{rec.token?.complaint || p?.complaint || '—'}</p>
                </div>
                <div className="card">
                  <SecHead title="निदान · Diagnosis" sub={`${dxList.length || 0} recorded`} />
                  {dxList.length ? dxList.map(d => <div className="rx-added" key={d}><b>{d}</b></div>)
                    : <div className="empty" style={{ padding: '8px 0' }}>No diagnosis recorded.</div>}
                </div>
                <div className="card">
                  <SecHead title="Vitals at triage" />
                  <div className="vitals-grid">
                    <VitalTile label="BP" value={fmtV(p?.bp)} unit="mmHg" />
                    <VitalTile label="Pulse" value={fmtV(p?.pulse)} unit="bpm" />
                    <VitalTile label="Temp" value={fmtV(p?.temp)} unit="°F" />
                    <VitalTile label="SpO₂" value={p?.spo2 ? `${p.spo2}%` : '—'} unit="RA" />
                  </div>
                </div>
              </div>
              <div className="stack">
                <div className="card">
                  <SecHead title="Prescription" sub={rx ? `pharmacy: ${rx.status}` : 'none'} more={rx ? undefined : undefined} />
                  {rx?.items?.length ? (
                    <>
                      <div style={{ marginBottom: 10 }}><StatusPill s={rx.status} /></div>
                      {rx.items.map((it, i) => (
                        <div className="rx-added" key={i}>
                          <b>{it.name || it.med}</b>
                          <span className="meta">{it.dose}{it.duration ? ` · ${it.duration} days` : ''}{it.qty ? ` · qty ${it.qty}` : ''}</span>
                        </div>
                      ))}
                    </>
                  ) : <div className="empty" style={{ padding: '8px 0' }}>No medicines prescribed.</div>}
                </div>
                <div className="card">
                  <SecHead title="Investigations & disposition" />
                  <div className="kv"><span className="k">Lab orders</span><span className="v">{c?.labs?.length ? c.labs.join(', ') : 'None'}</span></div>
                  <div className="kv"><span className="k">Disposition</span><span className="v" style={{ textTransform: 'capitalize' }}>{c?.dispo || '—'}</span></div>
                  <div className="kv"><span className="k">Blood group</span><span className="v">{p?.bloodGroup || '—'}</span></div>
                  <div className="kv"><span className="k">Allergies</span><span className="v" style={{ color: (p?.allergies?.length || p?.foodAllergies?.length) ? 'var(--red)' : 'inherit' }}>{[...(p?.allergies || []), ...(p?.foodAllergies || [])].join(', ') || 'None recorded'}</span></div>
                </div>
                {c?.notes && (
                  <div className="card">
                    <SecHead title="Notes" />
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--ink-2)' }}>{c.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'ehr' && p && <Ehr patient={p} />}
        </div>

        <div className="ws-foot">
          <span className="hint">Read-only record · token {tokenNo || '—'} · status done</span>
          <button className="btn primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
