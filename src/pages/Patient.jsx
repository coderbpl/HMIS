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

  // OTP — mobile ownership proof before a token is issued
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [demoCode, setDemoCode] = useState(null);
  const [otpBusy, setOtpBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendOtp = async () => {
    setGenErr('');
    if (!/^[6-9]\d{9}$/.test(g.mobile)) { setGenErr('Enter your 10-digit mobile number first.'); return; }
    setOtpBusy(true);
    try {
      const r = await api.requestOtp(g.mobile);
      setOtpSent(true); setOtp(''); setDemoCode(r.demoCode || null); setCooldown(60);
    } catch (err) {
      setGenErr(err.offline ? 'Cannot reach the hospital server.' : err.message);
    } finally { setOtpBusy(false); }
  };

  // tracking
  const [mobile, setMobile] = useState('');
  const [tokenNo, setTokenNo] = useState('');
  const [mine, setMine] = useState(null);
  const [trackErr, setTrackErr] = useState('');
  const [checkBusy, setCheckBusy] = useState(false);

  // recovery ("I closed the browser / lost my token number") — mobile + OTP
  const [rec, setRec] = useState({ on: false, sent: false, otp: '', demo: null, busy: false, list: null, cooldown: 0 });
  useEffect(() => {
    if (rec.cooldown <= 0) return;
    const t = setTimeout(() => setRec(r => ({ ...r, cooldown: r.cooldown - 1 })), 1000);
    return () => clearTimeout(t);
  }, [rec.cooldown]);

  // Device memory: the last token survives the tab closing. On reopen we
  // re-track it silently — no typing, no OTP (mobile+token pair is the proof).
  const LS_KEY = 'hmis.myToken';
  const remember = (mob, tok) => { try { localStorage.setItem(LS_KEY, JSON.stringify({ mobile: mob, tokenNo: tok })); } catch { /* private mode */ } };
  useEffect(() => {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { /* ignore */ }
    if (!saved?.mobile || !saved?.tokenNo) return;
    setMobile(saved.mobile); setTokenNo(saved.tokenNo);
    api.trackToken(saved.mobile, saved.tokenNo).then(info => {
      setMine(info); setMode('track'); setDept(info.dept);
    }).catch(() => { try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ } });
  }, []);

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
    if (!otpSent) { setGenErr('Tap "Send OTP" and enter the code from the SMS.'); return; }
    if (!/^\d{6}$/.test(otp)) { setGenErr('Enter the 6-digit OTP sent to your mobile.'); return; }
    setGenBusy(true);
    try {
      const codes = symptomList.filter(s => symptoms.includes(symptomLabel(s))).map(s => s.code);
      const body = {
        mobile: g.mobile,
        otp,
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
      remember(g.mobile, res.token.tokenNo);
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
      remember(mobile, tokenNo);
      if (info.dept !== dept) setDept(info.dept);
    } catch (err) {
      setMine(null);
      setTrackErr(err.offline ? 'Cannot reach the hospital server right now.' : err.message);
    }
  };

  const recSendOtp = async () => {
    setTrackErr('');
    if (!/^[6-9]\d{9}$/.test(mobile)) { setTrackErr('Enter your 10-digit mobile number first.'); return; }
    setRec(r => ({ ...r, busy: true }));
    try {
      const r = await api.requestOtp(mobile);
      setRec(x => ({ ...x, sent: true, otp: '', demo: r.demoCode || null, cooldown: 60, list: null, busy: false }));
    } catch (err) {
      setTrackErr(err.offline ? 'Cannot reach the hospital server.' : err.message);
      setRec(x => ({ ...x, busy: false }));
    }
  };

  const recFind = async () => {
    setTrackErr('');
    if (!/^\d{6}$/.test(rec.otp)) { setTrackErr('Enter the 6-digit OTP from the SMS.'); return; }
    setRec(r => ({ ...r, busy: true }));
    try {
      const { tokens } = await api.myTokens(mobile, rec.otp);
      setRec(r => ({ ...r, list: tokens, busy: false }));
      if (!tokens.length) setTrackErr('No active tokens for this mobile — today or upcoming.');
    } catch (err) {
      setTrackErr(err.message);
      setRec(r => ({ ...r, busy: false }));
    }
  };

  const recPick = async (t) => {
    setTrackErr('');
    setTokenNo(t.tokenNo);
    remember(mobile, t.tokenNo);
    try {
      const info = await api.trackToken(mobile, t.tokenNo);
      setMine(info); setDept(info.dept);
    } catch (err) { setTrackErr(err.message); }
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

  // future booking → today's queue (the old token is cancelled server-side)
  const [preBusy, setPreBusy] = useState(false);
  const [preErr, setPreErr] = useState('');
  const doPrepone = async () => {
    setPreBusy(true); setPreErr('');
    try {
      const t = await api.prepone(mobile, tokenNo);
      setTokenNo(t.tokenNo);
      remember(mobile, t.tokenNo);
      if (t.dept !== dept) setDept(t.dept);
      const info = await api.trackToken(mobile, t.tokenNo).catch(() => null);
      if (info) setMine(info);
    } catch (err) {
      setPreErr(err.offline ? 'Cannot reach the hospital server right now.' : err.message);
    } finally { setPreBusy(false); }
  };

  const fmtDate = d => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="portal">
      <div className="portal-bar">
        <div className="brand-mark"><Icon name="cross" /></div>
        <div><b className="hin" style={{ fontSize: 14 }}>{HOSPITAL.name}</b><div className="hin" style={{ fontSize: 10.5, color: '#BBD0F4' }}>{HOSPITAL.sub} · Patient view · रोगी</div></div>
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
                  <div style={{ display: 'flex', gap: 9 }}>
                    <input id="g-mob" className="f-inp" inputMode="numeric" placeholder="10 digits" value={g.mobile}
                      onChange={e => { setG(x => ({ ...x, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })); setOtpSent(false); setOtp(''); setDemoCode(null); }}
                      style={{ fontSize: 16, minHeight: 50 }} />
                    <button type="button" className="btn ghost" style={{ minHeight: 50, whiteSpace: 'nowrap' }}
                      onClick={sendOtp} disabled={otpBusy || cooldown > 0 || g.mobile.length !== 10}>
                      {otpBusy ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : otpSent ? 'Resend OTP' : 'Send OTP'}
                    </button>
                  </div>
                </div>

                {otpSent && (
                  <div className="f-group">
                    <label className="f-label" htmlFor="g-otp">OTP <em className="hin">· एसएमएस से 6 अंकों का कोड</em></label>
                    <input id="g-otp" className="f-inp" inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" value={otp}
                      onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      style={{ fontSize: 20, minHeight: 52, letterSpacing: 6, fontWeight: 700, textAlign: 'center' }} />
                    {demoCode && (
                      <div className="offline-band" style={{ marginTop: 8 }}>
                        Demo mode (no SMS gateway configured) — your OTP is <b>{demoCode}</b>
                      </div>
                    )}
                  </div>
                )}

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
                        onChange={e => { setMobile(e.target.value.replace(/\D/g, '').slice(0, 10)); setRec(r => ({ ...r, sent: false, otp: '', demo: null, list: null })); }}
                        style={{ fontSize: 16, minHeight: 50 }} />
                    </div>

                    {!rec.on ? (
                      <>
                        <div className="f-group">
                          <label className="f-label" htmlFor="pt-tok">Token number <em className="hin">· टोकन नंबर</em></label>
                          <input id="pt-tok" className="f-inp" placeholder="e.g. A-17" value={tokenNo}
                            onChange={e => setTokenNo(e.target.value.toUpperCase().slice(0, 6))} style={{ fontSize: 16, minHeight: 50 }} />
                        </div>
                        {trackErr && <div className="offline-band" style={{ background: '#FBE5E3', borderColor: '#F2B8B3', color: '#A02E24' }}>{trackErr}</div>}
                        <button className="btn primary block" style={{ minHeight: 52, fontSize: 15 }}>
                          <Icon name="search" size={16} /> Find my token
                        </button>
                        <button type="button" className="btn ghost block" style={{ marginTop: 10, minHeight: 48 }}
                          onClick={() => { setRec(r => ({ ...r, on: true })); setTrackErr(''); }}>
                          Don't remember the token number? <span className="hin">· OTP से खोजें</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="note-band" style={{ marginBottom: 12 }}>
                          <span className="nd" style={{ background: 'var(--blue)' }} />
                          <div><b>Find all your tokens with an OTP</b><span>We text a code to your mobile — no token number needed.</span></div>
                        </div>
                        <button type="button" className="btn primary block" style={{ minHeight: 50, marginBottom: 12 }}
                          onClick={recSendOtp} disabled={rec.busy || rec.cooldown > 0 || mobile.length !== 10}>
                          {rec.busy && !rec.sent ? 'Sending…' : rec.cooldown > 0 ? `Resend in ${rec.cooldown}s` : rec.sent ? 'Resend OTP' : 'Send OTP'}
                        </button>
                        {rec.sent && (
                          <>
                            <div className="f-group">
                              <label className="f-label" htmlFor="rec-otp">OTP <em className="hin">· एसएमएस से कोड</em></label>
                              <input id="rec-otp" className="f-inp" inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" value={rec.otp}
                                onChange={e => setRec(r => ({ ...r, otp: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                                style={{ fontSize: 20, minHeight: 52, letterSpacing: 6, fontWeight: 700, textAlign: 'center' }} />
                              {rec.demo && (
                                <div className="offline-band" style={{ marginTop: 8 }}>
                                  Demo mode (no SMS gateway configured) — your OTP is <b>{rec.demo}</b>
                                </div>
                              )}
                            </div>
                            <button type="button" className="btn primary block" style={{ minHeight: 50 }}
                              onClick={recFind} disabled={rec.busy || rec.otp.length !== 6}>
                              <Icon name="search" size={16} /> {rec.busy ? 'Searching…' : 'Show my tokens'}
                            </button>
                          </>
                        )}
                        {rec.list?.length > 0 && (
                          <div style={{ marginTop: 12 }}>
                            <span className="tlabel">Your tokens <em>· tap one to track it</em></span>
                            {rec.list.map(t => (
                              <button type="button" key={`${t.date}-${t.tokenNo}`} className="tok" style={{ width: '100%', cursor: 'pointer' }} onClick={() => recPick(t)}>
                                <div className="tno">{t.tokenNo}</div>
                                <div className="tx" style={{ textAlign: 'left' }}>
                                  <b>{t.dept}</b>
                                  <span>{t.date === todayStr() ? 'Today' : fmtDate(t.date)}{t.slot ? ` · ${t.slot}` : ''}</span>
                                </div>
                                <StatusPill s={t.status} />
                              </button>
                            ))}
                          </div>
                        )}
                        {trackErr && <div className="offline-band" style={{ marginTop: 10, background: '#FBE5E3', borderColor: '#F2B8B3', color: '#A02E24' }}>{trackErr}</div>}
                        <button type="button" className="btn ghost sm block" style={{ marginTop: 10 }}
                          onClick={() => { setRec(r => ({ ...r, on: false, list: null })); setTrackErr(''); }}>
                          I have my token number
                        </button>
                      </>
                    )}
                  </form>
                ) : (
                  <div className="mytok">
                    <Pill tone="info">Namaste, {mine.patientFirstName} <span className="hin">· नमस्ते</span></Pill>
                    <div className="tok-big">{mine.tokenNo}</div>
                    <StatusPill s={mine.status} />

                    {mine.status === 'booked' && mine.date > todayStr() && (
                      <>
                        <div className="note-band" style={{ marginTop: 16, textAlign: 'left' }}>
                          <span className="nd" style={{ background: 'var(--blue)' }} />
                          <div><b>Booked: {fmtDate(mine.date)}{mine.slot ? ` · ${mine.slot}` : ''}</b><span>{mine.dept}. Check in at the hospital on that day to join the queue.</span></div>
                        </div>
                        <button className="btn ghost block" style={{ minHeight: 50, fontSize: 14, marginTop: 12 }} onClick={doPrepone} disabled={preBusy}>
                          <Icon name="cal" size={15} /> {preBusy ? 'Rebooking…' : 'Came early? Get a token for today instead'}
                        </button>
                        {preErr && <div className="offline-band" style={{ marginTop: 10, background: '#FBE5E3', borderColor: '#F2B8B3', color: '#A02E24' }}>{preErr}</div>}
                      </>
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
