import { useEffect, useMemo, useState } from 'react';
import Icon from '../icons.jsx';
import { SecHead, StatusPill, Pill } from '../ui.jsx';
import { BigChips } from '../components/touch.jsx';
import { api } from '../api.js';
import { HOSPITAL } from '../data.js';

const FALLBACK_POLL_MS = 15000;
const todayStr = () => new Date().toISOString().slice(0, 10);
const nextDays = (n) => Array.from({ length: n }, (_, i) => {
  const d = new Date(Date.now() + (i + 1) * 86400000);
  return { value: d.toISOString().slice(0, 10), label: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) };
});

/**
 * Patient-facing portal — no login.
 * Get a token: tap symptoms (department follows automatically), today or an
 * advance slot; self-service tokens activate on arrival check-in.
 * Track: live position via SSE board pushes.
 */
export default function PatientPortal({ onExit }) {
  const [mode, setMode] = useState('get'); // 'get' | 'track'
  const [depts, setDepts] = useState(['General Medicine']);
  const [symptomList, setSymptomList] = useState([]);
  const [dept, setDept] = useState('General Medicine');
  const [board, setBoard] = useState(null);
  const [offline, setOffline] = useState(false);

  // token generation
  const [hasAbha, setHasAbha] = useState(true);
  const [g, setG] = useState({ abha: '', mobile: '', name: '', age: '', sex: 'F' });
  const [symptoms, setSymptoms] = useState([]);      // selected symptom labels
  const [deptOverride, setDeptOverride] = useState('');
  const [when, setWhen] = useState('today');          // 'today' | 'advance'
  const [advDate, setAdvDate] = useState(nextDays(1)[0].value);
  const [slots, setSlots] = useState([]);
  const [slot, setSlot] = useState(null);
  const [genErr, setGenErr] = useState('');
  const [genBusy, setGenBusy] = useState(false);
  const [issued, setIssued] = useState(null);

  // tracking
  const [mobile, setMobile] = useState('');
  const [tokenNo, setTokenNo] = useState('');
  const [mine, setMine] = useState(null);
  const [trackErr, setTrackErr] = useState('');
  const [checkBusy, setCheckBusy] = useState(false);

  const setg = k => e => setG(x => ({ ...x, [k]: e.target.value }));
  const symptomLabel = s => `${s.en} · ${s.hin}`;
  const autoDept = useMemo(() => {
    const first = symptomList.find(s => symptoms.includes(symptomLabel(s)));
    return first?.dept || null;
  }, [symptoms, symptomList]);
  const effectiveDept = deptOverride || autoDept || 'General Medicine';

  useEffect(() => {
    api.departments().then(d => setDepts(d.map(x => x.name))).catch(() => {});
    api.symptoms().then(setSymptomList).catch(() => {});
  }, []);

  // slot availability for advance bookings
  useEffect(() => {
    if (when !== 'advance') return;
    setSlot(null);
    api.slots(effectiveDept, advDate).then(setSlots).catch(() => setSlots([]));
  }, [when, advDate, effectiveDept]);

  // Live board: SSE push, with slow polling as a safety net.
  useEffect(() => {
    let alive = true;
    const apply = b => { if (alive) { setBoard(b); setOffline(false); } };
    const unsub = api.subscribeQueue(dept, apply, () => { if (alive) setOffline(true); });
    const poll = setInterval(() => {
      api.publicQueue(dept).then(apply).catch(() => { if (alive) setOffline(true); });
    }, FALLBACK_POLL_MS);
    return () => { alive = false; unsub(); clearInterval(poll); };
  }, [dept]);

  // Derive "my token" updates from board pushes — no extra API calls.
  // Booked tokens are not on the public board, so their absence means nothing.
  useEffect(() => {
    if (!mine || !board || board.dept !== mine.dept) return;
    if (mine.status === 'booked' || (mine.date && mine.date > todayStr())) return;
    const row = board.rows.find(r => r.tokenNo === mine.tokenNo);
    const waiting = board.rows.filter(r => r.status === 'waiting');
    setMine(m => ({
      ...m,
      status: row ? row.status : 'done',
      nowServing: board.nowServing,
      position: row?.status === 'waiting' ? waiting.findIndex(r => r.tokenNo === m.tokenNo) + 1 : 0,
      estWaitMin: row?.status === 'waiting' ? (waiting.findIndex(r => r.tokenNo === m.tokenNo) + 1) * 8 : 0,
    }));
  }, [board]);

  const generate = async (e) => {
    e.preventDefault();
    setGenErr(''); setIssued(null);
    if (!/^[6-9]\d{9}$/.test(g.mobile)) { setGenErr('Enter your 10-digit mobile number.'); return; }
    if (hasAbha && !g.abha.trim()) { setGenErr('Enter your ABHA number, or switch to "No ABHA".'); return; }
    if (!symptoms.length) { setGenErr('Tap at least one symptom so we can send you to the right department.'); return; }
    if (when === 'advance' && !slot) { setGenErr('Pick a time slot for your visit.'); return; }
    setGenBusy(true);
    try {
      const codes = symptomList.filter(s => symptoms.includes(symptomLabel(s))).map(s => s.code);
      const body = {
        mobile: g.mobile,
        symptoms: codes,
        ...(deptOverride ? { dept: deptOverride } : {}),
        ...(hasAbha
          ? { abha: g.abha.trim() }
          : { name: g.name.trim() || undefined, age: g.age === '' ? undefined : Number(g.age), sex: g.sex }),
        ...(when === 'advance' ? { date: advDate, slot } : {}),
      };
      const res = await api.selfToken(body);
      setIssued(res);
      setMobile(g.mobile); setTokenNo(res.token.tokenNo);
      if (res.token.dept !== dept) setDept(res.token.dept);
      const info = await api.trackToken(g.mobile, res.token.tokenNo).catch(() => null);
      if (info) { setMine(info); setMode('track'); }
    } catch (err) {
      setGenErr(err.offline ? 'Cannot reach the hospital server — please use the registration counter.' : err.message);
    } finally { setGenBusy(false); }
  };

  const track = async (e) => {
    e.preventDefault();
    setTrackErr('');
    try {
      const info = await api.trackToken(mobile, tokenNo);
      setMine(info);
      if (info.dept !== dept) setDept(info.dept);
    } catch (err) {
      setMine(null);
      setTrackErr(err.offline ? 'Cannot reach the hospital server right now.' : err.message);
    }
  };

  const doCheckIn = async () => {
    setCheckBusy(true); setTrackErr('');
    try {
      await api.checkIn(mobile, tokenNo);
      const info = await api.trackToken(mobile, tokenNo).catch(() => null);
      if (info) setMine(info);
    } catch (err) {
      setTrackErr(err.message);
    } finally { setCheckBusy(false); }
  };

  const fmtDate = d => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="portal">
      <div className="portal-bar">
        <div className="brand-mark"><Icon name="cross" /></div>
        <div><b style={{ fontSize: 14 }}>{HOSPITAL.name}</b><div style={{ fontSize: 10.5, color: '#BBD0F4' }}>{HOSPITAL.sub} · Patient view <span className="hin">· रोगी</span></div></div>
        <span className="sp" />
        <button className="btn ghost sm" style={{ background: 'rgba(255,255,255,.14)', border: 0, color: '#fff' }} onClick={onExit}>
          <Icon name="out" size={14} /> Staff sign-in
        </button>
      </div>

      <div className="portal-main">
        {offline && <div className="offline-band">⚠ Live updates unavailable — showing the last known queue. Ask the counter for help.</div>}

        <div className="grid-2eq">
          <div className="stack">
            <div className="seg" style={{ alignSelf: 'flex-start' }}>
              <button className={mode === 'get' ? 'on' : ''} onClick={() => setMode('get')} style={{ minHeight: 44 }}>Get a token <span className="hin">· टोकन लें</span></button>
              <button className={mode === 'track' ? 'on' : ''} onClick={() => setMode('track')} style={{ minHeight: 44 }}>Track my token <span className="hin">· स्थिति</span></button>
            </div>

            {mode === 'get' && (
              <form className="card" onSubmit={generate}>
                <SecHead title="Get an OPD token" sub="tap what's troubling you — we pick the right department" />

                <span className="tlabel">What is the problem? <em className="hin">· क्या तकलीफ़ है? (up to 3)</em></span>
                <BigChips multi options={symptomList.map(symptomLabel)} value={symptoms}
                  onChange={v => setSymptoms(v.slice(0, 3))} cols={2} />

                {autoDept && (
                  <div className="note-band" style={{ margin: '12px 0' }}>
                    <span className="nd" style={{ background: 'var(--blue)' }} />
                    <div>
                      <b>Department: {effectiveDept}</b>
                      <span>
                        Auto-selected from your symptom.{' '}
                        <select className="f-sel" style={{ display: 'inline-block', width: 'auto', minHeight: 34, padding: '4px 8px', fontSize: 12 }}
                          value={deptOverride || autoDept} onChange={e => setDeptOverride(e.target.value)} aria-label="Change department">
                          {depts.map(d => <option key={d}>{d}</option>)}
                        </select>
                      </span>
                    </div>
                  </div>
                )}

                <span className="tlabel" style={{ marginTop: 4 }}>When are you coming? <em className="hin">· कब आएँगे?</em></span>
                <div className="seg" style={{ marginBottom: 12 }}>
                  <button type="button" className={when === 'today' ? 'on' : ''} onClick={() => setWhen('today')} style={{ minHeight: 44 }}>Today — join the queue</button>
                  <button type="button" className={when === 'advance' ? 'on' : ''} onClick={() => setWhen('advance')} style={{ minHeight: 44 }}>Book a day & slot</button>
                </div>

                {when === 'advance' && (
                  <>
                    <div className="f-group">
                      <label className="f-label" htmlFor="g-date">Date</label>
                      <select id="g-date" className="f-sel" value={advDate} onChange={e => setAdvDate(e.target.value)} style={{ minHeight: 48 }}>
                        {nextDays(6).map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>
                    </div>
                    <span className="tlabel">Slot <em>(green = available)</em></span>
                    <div className="tchips" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 12 }}>
                      {slots.map(s => (
                        <button key={s.time} type="button" disabled={s.free === 0 || s.past}
                          className={`tchip ${slot === s.time ? 'on' : ''}`}
                          style={s.free === 0 || s.past ? { opacity: .4, cursor: 'not-allowed' } : undefined}
                          onClick={() => setSlot(s.time)}>
                          {s.time}<span style={{ display: 'block', fontSize: 10, fontWeight: 600 }}>{s.free === 0 ? 'Full' : `${s.free} left`}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <div style={{ margin: '10px 0 12px' }}>
                  <BigChips options={['I have an ABHA number', "I don't have ABHA"]}
                    value={hasAbha ? 'I have an ABHA number' : "I don't have ABHA"}
                    onChange={v => setHasAbha(v !== "I don't have ABHA")} cols={2} />
                </div>

                {hasAbha ? (
                  <div className="f-group">
                    <label className="f-label" htmlFor="g-abha">ABHA number <em className="hin">· आभा नंबर</em></label>
                    <input id="g-abha" className="f-inp" placeholder="91-XXXX-XXXX-XXXX" value={g.abha}
                      onChange={setg('abha')} style={{ fontSize: 16, minHeight: 50 }} />
                  </div>
                ) : (
                  <>
                    <div className="f-group">
                      <label className="f-label" htmlFor="g-name">Full name <em>(first visit only)</em></label>
                      <input id="g-name" className="f-inp" placeholder="As per ID document" value={g.name}
                        onChange={setg('name')} style={{ fontSize: 16, minHeight: 50 }} />
                    </div>
                    <div className="f-row">
                      <div className="f-group">
                        <label className="f-label" htmlFor="g-age">Age</label>
                        <input id="g-age" className="f-inp" inputMode="numeric" placeholder="Years" value={g.age}
                          onChange={e => setG(x => ({ ...x, age: e.target.value.replace(/\D/g, '').slice(0, 3) }))} style={{ fontSize: 16, minHeight: 50 }} />
                      </div>
                      <div className="f-group">
                        <label className="f-label" htmlFor="g-sex">Sex</label>
                        <select id="g-sex" className="f-sel" value={g.sex} onChange={setg('sex')} style={{ minHeight: 50 }}>
                          <option value="F">Female</option><option value="M">Male</option><option value="O">Other</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}

                <div className="f-group">
                  <label className="f-label" htmlFor="g-mob">Mobile number <em className="hin">· मोबाइल</em></label>
                  <input id="g-mob" className="f-inp" inputMode="numeric" placeholder="10 digits" value={g.mobile}
                    onChange={e => setG(x => ({ ...x, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))} style={{ fontSize: 16, minHeight: 50 }} />
                </div>

                {genErr && <div className="offline-band" style={{ background: '#FBE5E3', borderColor: '#F2B8B3', color: '#A02E24' }}>{genErr}</div>}
                <button className="btn primary block" style={{ minHeight: 52, fontSize: 15 }} disabled={genBusy}>
                  <Icon name="plus" size={16} /> {genBusy ? 'Requesting…' : when === 'today' ? 'Get my token' : 'Book my slot'}
                </button>

                {issued && (
                  <div className="note-band" style={{ marginTop: 14, background: '#E3F3EC', borderColor: '#BFE5D4' }}>
                    <span className="nd" style={{ background: 'var(--green)' }} />
                    <div>
                      <b>{issued.existing ? `You already hold token ${issued.token.tokenNo}` : `Token ${issued.token.tokenNo} — ${issued.token.dept}`}</b>
                      <span>Namaste {issued.patientFirstName} — tracking it for you now.</span>
                    </div>
                  </div>
                )}
              </form>
            )}

            {mode === 'track' && (
              <div className="card">
                <SecHead title="Track my token" sub="as printed on your slip / SMS" />
                {!mine ? (
                  <form onSubmit={track}>
                    <div className="f-group">
                      <label className="f-label" htmlFor="pt-mob">Registered mobile number <em className="hin">· मोबाइल नंबर</em></label>
                      <input id="pt-mob" className="f-inp" inputMode="numeric" placeholder="10-digit mobile" value={mobile}
                        onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} style={{ fontSize: 16, minHeight: 50 }} />
                    </div>
                    <div className="f-group">
                      <label className="f-label" htmlFor="pt-tok">Token number <em className="hin">· टोकन नंबर</em></label>
                      <input id="pt-tok" className="f-inp" placeholder="e.g. A-17" value={tokenNo}
                        onChange={e => setTokenNo(e.target.value.toUpperCase().slice(0, 6))} style={{ fontSize: 16, minHeight: 50 }} />
                    </div>
                    {trackErr && <div className="offline-band" style={{ background: '#FBE5E3', borderColor: '#F2B8B3', color: '#A02E24' }}>{trackErr}</div>}
                    <button className="btn primary block" style={{ minHeight: 52, fontSize: 15 }}>
                      <Icon name="search" size={16} /> Find my token
                    </button>
                  </form>
                ) : (
                  <div className="mytok">
                    <Pill tone="info">Namaste, {mine.patientFirstName} <span className="hin">· नमस्ते</span></Pill>
                    <div className="tok-big">{mine.tokenNo}</div>
                    <StatusPill s={mine.status} />

                    {mine.status === 'booked' && mine.date > todayStr() && (
                      <div className="note-band" style={{ marginTop: 16, textAlign: 'left' }}>
                        <span className="nd" style={{ background: 'var(--blue)' }} />
                        <div><b>Booked: {fmtDate(mine.date)}{mine.slot ? ` · ${mine.slot}` : ''}</b><span>{mine.dept}. Check in at the hospital on that day to join the queue.</span></div>
                      </div>
                    )}

                    {mine.canCheckIn && (
                      <>
                        <div className="note-band" style={{ marginTop: 16, textAlign: 'left' }}>
                          <span className="nd" />
                          <div><b>Reached the hospital?</b><span>Tap check-in to join the live queue{mine.slot ? ` (slot ${mine.slot})` : ''}. Unclaimed tokens lapse after 60 minutes.</span></div>
                        </div>
                        <button className="btn primary block" style={{ minHeight: 52, fontSize: 15, marginTop: 12 }} onClick={doCheckIn} disabled={checkBusy}>
                          <Icon name="check" size={16} /> {checkBusy ? 'Checking in…' : "I've arrived — check in"}
                        </button>
                      </>
                    )}

                    {mine.status !== 'booked' && (
                      <div className="pos">
                        <div><div className="n">{mine.status === 'waiting' ? mine.position : '—'}</div><div className="l">Ahead of you</div></div>
                        <div><div className="n">{mine.nowServing || '—'}</div><div className="l">Now serving</div></div>
                        <div><div className="n">{mine.status === 'waiting' ? `~${mine.estWaitMin}m` : '—'}</div><div className="l">Est. wait</div></div>
                      </div>
                    )}

                    {trackErr && <div className="offline-band" style={{ marginTop: 12, background: '#FBE5E3', borderColor: '#F2B8B3', color: '#A02E24' }}>{trackErr}</div>}
                    {!mine.vitalsDone && ['waiting', 'checked-in'].includes(mine.status) && (
                      <div className="note-band" style={{ marginTop: 16, textAlign: 'left' }}>
                        <span className="nd" />
                        <div><b>Vitals pending</b><span>Please visit the nursing desk before your consult.</span></div>
                      </div>
                    )}
                    {mine.status === 'in-consult' && (
                      <div className="note-band" style={{ marginTop: 16, textAlign: 'left', background: '#E3F3EC', borderColor: '#BFE5D4' }}>
                        <span className="nd" style={{ background: 'var(--green)' }} />
                        <div><b>It's your turn!</b><span>Please proceed to the consultation room.</span></div>
                      </div>
                    )}
                    {mine.status === 'done' && (
                      <div className="note-band" style={{ marginTop: 16, textAlign: 'left' }}>
                        <span className="nd" style={{ background: 'var(--green)' }} />
                        <div><b>Consultation complete</b><span>Collect medicines at the pharmacy against this token.</span></div>
                      </div>
                    )}
                    <button className="btn ghost sm" style={{ marginTop: 16 }} onClick={() => { setMine(null); setTrackErr(''); }}>Track a different token</button>
                  </div>
                )}
              </div>
            )}

            <div className="card">
              <SecHead title="How it works" />
              <div className="lrow"><Pill tone="info">1</Pill><div className="tx"><b>Tap your symptoms, get a token</b><span>For today, or book a day and slot in advance.</span></div></div>
              <div className="lrow"><Pill tone="info">2</Pill><div className="tx"><b>Check in when you arrive</b><span>Your token joins the live queue only after check-in.</span></div></div>
              <div className="lrow"><Pill tone="info">3</Pill><div className="tx"><b>Watch this screen</b><span>Nurse records vitals, then the doctor calls your token.</span></div></div>
            </div>
          </div>

          {/* live board */}
          <div className="stack">
            <div className="serving">
              <div className="cap">Now serving <span className="hin">· अभी</span></div>
              <div className="tok-big">{board?.nowServing || '—'}</div>
              <div className="sub">{dept} · live updates</div>
            </div>
            <div className="card">
              <div className="sec-head" style={{ alignItems: 'center' }}>
                <b>Queue board</b>
                <select className="f-sel" style={{ width: 'auto', minHeight: 44 }} value={dept} onChange={e => setDept(e.target.value)} aria-label="Department">
                  {depts.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              {!board?.rows?.length && <div className="empty">No tokens in this queue right now.</div>}
              {board?.rows?.map(r => (
                <div key={r.tokenNo} className={`pq-row ${r.status === 'in-consult' ? 'serving-row' : ''}`}>
                  <span className="no">{r.tokenNo}</span>
                  <span className="nm">{r.patient}</span>
                  {r.priority === 'urgent' && <Pill tone="bad">Urgent</Pill>}
                  <StatusPill s={r.status} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
