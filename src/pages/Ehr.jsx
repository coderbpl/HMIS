import { useMemo, useState } from 'react';
import Icon from '../icons.jsx';
import { Pill } from '../ui.jsx';
import {
  EHR_CATS, EHR_TESTS, EHR_VISITS, EHR_IMAGING, EHR_RX,
  testStatus, latestOf, fmtVal, fmtDate, relTime, labsOnDate, latestAbnormal, totalReports,
} from '../ehrData.js';

const statusPill = s =>
  s === 'high' ? <Pill tone="bad">High · अधिक</Pill>
    : s === 'low' ? <Pill tone="warn">Low · कम</Pill>
      : <Pill tone="ok">Normal · सामान्य</Pill>;

const deltaBadge = (cur, prev) => {
  if (prev === undefined) return null;
  const d = Math.round((cur - prev) * 10) / 10;
  if (d === 0) return <span className="ehr-delta flat">—</span>;
  return <span className={`ehr-delta ${d > 0 ? 'up' : 'down'}`}>{d > 0 ? '▲' : '▼'}{Math.abs(d)}</span>;
};

/** Trend: green normal band + line + a dot per report (red when out of range). */
function Trend({ t }) {
  const W = 560, H = 150, padL = 44, padR = 14, padT = 12, padB = 26;
  const vals = t.v.map(r => r[1]);
  const min = Math.min(t.lo, ...vals), max = Math.max(t.hi, ...vals);
  const span = (max - min) || 1;
  const y = v => padT + (H - padT - padB) * (1 - (v - min) / span);
  const x = i => padL + (W - padL - padR) * (t.v.length === 1 ? 0.5 : i / (t.v.length - 1));
  const pts = t.v.map((r, i) => [x(i), y(r[1]), r]);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }} role="img"
        aria-label={`${t.en} trend, normal range ${t.lo}–${t.hi} ${t.u}`}>
        <rect x={padL} y={y(t.hi)} width={W - padL - padR} height={Math.max(y(t.lo) - y(t.hi), 2)}
          fill="#E3F3EC" stroke="#BFE5D4" strokeWidth="1" rx="3" />
        {[t.lo, t.hi].map(v => (
          <text key={v} x={padL - 6} y={y(v) + 3.5} fontSize="9.5" fill="var(--muted)" textAnchor="end">{fmtVal(v)}</text>
        ))}
        <polyline points={pts.map(p => `${p[0]},${p[1]}`).join(' ')} fill="none"
          stroke="var(--s1)" strokeWidth="2" strokeLinejoin="round" />
        {pts.map(([px, py, r], i) => (
          <circle key={i} cx={px} cy={py} r="4.5"
            fill={testStatus(t, r[1]) === 'ok' ? 'var(--s1)' : 'var(--red)'} stroke="#fff" strokeWidth="2">
            <title>{`${fmtDate(r[0])}: ${fmtVal(r[1])} ${t.u} · ${r[2]}`}</title>
          </circle>
        ))}
        {t.v.map((r, i) => (t.v.length <= 4 || i === 0 || i === t.v.length - 1 || i === Math.floor((t.v.length - 1) / 2)) && (
          <text key={r[0]} x={x(i)} y={H - 8} fontSize="9.5" fill="var(--muted)" textAnchor="middle">
            {new Date(r[0]).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}
          </text>
        ))}
      </svg>
      <div className="ehr-legend">
        <span><i className="sw band" /> green band = normal range</span>
        <span><i className="sw dot" /> dot = each report</span>
      </div>
    </div>
  );
}

/** Test detail: latest value, delta, trend, every historical report. */
function TestDetail({ t, onBack }) {
  const rev = [...t.v].reverse();
  const [dLatest, vLatest, facLatest] = t.v[t.v.length - 1];
  const prev = t.v[t.v.length - 2]?.[1];
  const abnormal = t.v.filter(r => testStatus(t, r[1]) !== 'ok').length;
  return (
    <div className="card">
      <button className="more" onClick={onBack} style={{ marginBottom: 10 }}>
        ‹ Back to {EHR_CATS[t.cat].en} · {EHR_CATS[t.cat].hin}
      </button>
      <div className="ehr-dhead">
        <div>
          <b style={{ fontSize: 16 }}>{t.name}</b>
          <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{t.en} · {t.hin} · normal {fmtVal(t.lo)}–{fmtVal(t.hi)} {t.u}</div>
        </div>
        {statusPill(testStatus(t, vLatest))}
      </div>
      <div className="ehr-big">
        <span className="v">{fmtVal(vLatest)}</span>
        <span className="u">{t.u}</span>
        {deltaBadge(vLatest, prev)}
        {prev !== undefined && <span className="since">vs previous</span>}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 12 }}>
        Latest: {fmtDate(dLatest)} · {relTime(dLatest)} · {facLatest}
      </div>
      <Trend t={t} />
      <div className="sec-head" style={{ marginTop: 16 }}>
        <b>All reports · {t.v.length}</b>
        {abnormal > 0 && <Pill tone="bad">{abnormal} abnormal</Pill>}
      </div>
      {rev.map((r, i) => {
        const prior = rev[i + 1]?.[1];
        return (
          <div className="ehr-row" key={r[0]}>
            <div className="tx">
              <b>{fmtDate(r[0])}</b>
              <span>{relTime(r[0])} · {r[2]}</span>
            </div>
            <div className="val">{fmtVal(r[1])} <em>{t.u}</em></div>
            {deltaBadge(r[1], prior)}
            {statusPill(testStatus(t, r[1]))}
          </div>
        );
      })}
    </div>
  );
}

export default function Ehr({ patient: p }) {
  const [view, setView] = useState('cat');   // 'cat' | 'date'
  const [sel, setSel] = useState(null);      // selected test key
  const [q, setQ] = useState('');

  const abnormal = useMemo(latestAbnormal, []);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    return EHR_TESTS.filter(t =>
      t.en.toLowerCase().includes(s) || t.name.toLowerCase().includes(s) ||
      t.hin.includes(q.trim()) || EHR_CATS[t.cat].en.toLowerCase().includes(s) ||
      (s === 'sugar' && t.cat === 'diab') || (s === 'शुगर' && t.cat === 'diab'));
  }, [q]);
  const selTest = EHR_TESTS.find(t => t.k === sel);

  const chronic = p.conditions?.length ? p.conditions.join(' · ') : 'None recorded';
  const allergyLine = [...(p.allergies || []), ...(p.foodAllergies || [])].join(', ') || 'None recorded';

  return (
    <div className="ehr">
      {/* header — identity lives in the consult top-bar; this shows the clinical summary only */}
      <div className="ehr-head">
        <div className="row">
          <div className="ehr-title">
            <Pill tone="info">e-HR · हेल्थ रिकॉर्ड</Pill>
            <span className="ehr-count">{EHR_VISITS.length} visits · {totalReports()} lab reports · cross-facility</span>
          </div>
        </div>
        <div className="ehr-chronic">
          <span><b>Chronic:</b> {chronic}</span>
          <span><b>Allergy:</b> <em style={{ fontStyle: 'normal', color: allergyLine === 'None recorded' ? 'inherit' : 'var(--red)' }}>{allergyLine}</em></span>
          <span><b>Blood group:</b> {p.bloodGroup || '—'}</span>
        </div>
        {abnormal.length > 0 && (
          <div className="ehr-attn">
            <b>⚠ Needs attention · {abnormal.length} abnormal (latest reports)</b>
            <div className="chips">
              {abnormal.slice(0, 6).map(({ t, r }) => (
                <button key={t.k} className="attn-chip" onClick={() => { setSel(t.k); setView('cat'); }}>
                  <b>{t.en} {fmtVal(r[1])}</b>
                  <span>{testStatus(t, r[1]) === 'high' ? 'High' : 'Low'} · {new Date(r[0]).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* controls */}
      <div className="ehr-controls">
        <div className="seg">
          <button className={view === 'cat' ? 'on' : ''} onClick={() => { setView('cat'); }}>By category <span className="hin">· श्रेणी-वार</span></button>
          <button className={view === 'date' ? 'on' : ''} onClick={() => { setView('date'); setSel(null); }}>By date <span className="hin">· तिथि-वार</span></button>
        </div>
        <div className="ehr-search">
          <Icon name="search" size={15} />
          <input placeholder='Search tests… e.g. sugar, HbA1c, BP' value={q} onChange={e => setQ(e.target.value)} aria-label="Search tests" />
        </div>
      </div>

      {/* search results override */}
      {results.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <b style={{ fontSize: 13 }}>Search results</b>
          {results.map(t => {
            const [d, v] = latestOf(t);
            return (
              <button key={t.k} className="ehr-row click" onClick={() => { setSel(t.k); setView('cat'); setQ(''); }}>
                <div className="tx"><b>{t.en} · {t.hin}</b><span>{EHR_CATS[t.cat].en} · last {relTime(d)}</span></div>
                <div className="val">{fmtVal(v)} <em>{t.u}</em></div>
                {statusPill(testStatus(t, v))}
              </button>
            );
          })}
        </div>
      )}

      {/* category view */}
      {view === 'cat' && !selTest && (
        <div className="ehr-cats">
          {Object.entries(EHR_CATS).map(([ck, cat]) => {
            const tests = EHR_TESTS.filter(t => t.cat === ck);
            if (!tests.length) return null;
            return (
              <div className="card pad-s" key={ck}>
                <div className="ehr-cat-h" style={{ color: cat.c }}>
                  <span className="dot" style={{ background: cat.c }} />
                  <b>{cat.en}</b><span className="hin" style={{ color: 'var(--muted)' }}>· {cat.hin}</span>
                </div>
                {tests.map(t => {
                  const [d, v] = latestOf(t);
                  const st = testStatus(t, v);
                  return (
                    <button key={t.k} className="ehr-row click" onClick={() => setSel(t.k)}>
                      <span className={`vd ${st === 'ok' ? 'ok' : st === 'low' ? 'warn' : 'bad'}`} style={{ position: 'static', flex: '0 0 auto' }} />
                      <div className="tx"><b>{t.en}</b><span>{relTime(d)}</span></div>
                      <div className="val">{fmtVal(v)} <em>{t.u}</em></div>
                      <span className="go">›</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {view === 'cat' && selTest && <TestDetail t={selTest} onBack={() => setSel(null)} />}

      {/* date view */}
      {view === 'date' && (
        <div className="tl" style={{ marginTop: 4 }}>
          {EHR_VISITS.map(vis => {
            const labs = labsOnDate(vis.d);
            const bad = labs.filter(l => l.status !== 'ok').length;
            const img = EHR_IMAGING.filter(i => i.d === vis.d);
            const rx = EHR_RX.find(r => r.d === vis.d);
            return (
              <div className="tl-item" key={vis.d}>
                <b>{fmtDate(vis.d)} <span style={{ color: 'var(--muted)', fontWeight: 500 }}>· {relTime(vis.d)}</span></b>
                <div className="card pad-s" style={{ marginTop: 8 }}>
                  <div className="ehr-visit-h">
                    <Pill tone={vis.t === 'ipd' ? 'warn' : 'info'}>{vis.t.toUpperCase()}</Pill>
                    <div className="tx"><b>{vis.title}</b><span>{vis.sub} · {vis.fac}</span></div>
                  </div>
                  {labs.length > 0 && (
                    <div className="ehr-labline">
                      <div className="lab-head">
                        <b>Lab · {[...new Set(labs.map(l => EHR_CATS[l.t.cat].en))].join(', ')}</b>
                        <Pill tone={bad ? 'bad' : 'ok'}>{bad}/{labs.length} ↑↓</Pill>
                      </div>
                      <div className="vals">
                        {labs.map(l => (
                          <button key={l.t.k} className={`lab-chip ${l.status !== 'ok' ? 'bad' : ''}`}
                            onClick={() => { setSel(l.t.k); setView('cat'); }}>
                            {l.t.en} <b>{fmtVal(l.val)}</b>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {img.map(i => (
                    <div className="ehr-labline" key={i.title}>
                      <div className="lab-head">
                        <b>{i.kind} · {i.title}</b>
                        <Pill tone={i.ok ? 'ok' : 'warn'}>{i.ok ? 'Normal' : 'Finding'}</Pill>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>{i.result} · {i.fac}</div>
                    </div>
                  ))}
                  {rx && (
                    <div className="ehr-labline">
                      <div className="lab-head"><b>Prescription · {rx.items.length} medicines</b></div>
                      <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>{rx.items.join(' | ')}</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
