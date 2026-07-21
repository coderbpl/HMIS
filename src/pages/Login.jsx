import { useState } from 'react';
import Icon from '../icons.jsx';
import { ROLES, HOSPITAL } from '../data.js';
import { api } from '../api.js';

// Demo usernames per role — the cards prefill the form; authentication itself
// always happens against the API with a real password.
const DEMO_USERS = {
  doctor: 'dr.ravi',
  nurse: 'nurse.meena',
  reception: 'frontdesk.rahul',
  pharmacy: 'pharm.vikas',
  admin: 'admin.sk',
};
const roleFromUsername = u => Object.entries(DEMO_USERS).find(([, v]) => v === u)?.[0] || null;

export default function Login({ onAuthed, onOffline, onPatient }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setOffline(false); setBusy(true);
    try {
      const user = await api.login(username.trim().toLowerCase(), password);
      onAuthed(user);
    } catch (ex) {
      if (ex.offline) { setOffline(true); setErr('Cannot reach the API server.'); }
      else setErr(ex.message);
    } finally { setBusy(false); }
  };

  const prefill = (roleKey) => {
    setUsername(DEMO_USERS[roleKey]);
    setPassword('Demo@1234'); // demo convenience only — remove for production
    setErr(''); setOffline(false);
  };

  const offlineRole = roleFromUsername(username.trim().toLowerCase());

  return (
    <div className="login">
      <div className="login-hero">
        <div className="ring" style={{ width: 340, height: 340, right: -120, top: -120 }} />
        <div className="ring" style={{ width: 220, height: 220, right: -40, bottom: 60 }} />
        <div className="brand" style={{ padding: 0 }}>
          <div className="brand-mark"><Icon name="cross" /></div>
          <div className="brand-name"><b className="hin">{HOSPITAL.name}</b><span className="hin">{HOSPITAL.sub}</span></div>
        </div>
        <h1>One hospital.<br />Every workflow connected.</h1>
        <p>Integrated OPD, IPD, pharmacy, laboratory and billing — designed for desktops at the counter, tablets on rounds and phones on the move.</p>
        <div className="feats">
          <div className="feat"><span className="fi"><Icon name="users" /></span>Self-service tokens with ABHA or mobile</div>
          <div className="feat"><span className="fi"><Icon name="bed" /></span>Live queue pushed to patient screens</div>
          <div className="feat"><span className="fi"><Icon name="scan" /></span>ABHA-linked digital health records</div>
        </div>
      </div>
      <div className="login-main">
        <h2>Staff sign-in</h2>
        <div className="sub">Use your hospital credentials <span className="hin">· अपनी भूमिका चुनें</span></div>

        <form onSubmit={submit} style={{ maxWidth: 420 }}>
          <div className="f-group">
            <label className="f-label" htmlFor="lg-user">Username</label>
            <input id="lg-user" className="f-inp" autoComplete="username" value={username}
              onChange={e => setUsername(e.target.value)} placeholder="e.g. dr.ravi" style={{ minHeight: 48 }} />
          </div>
          <div className="f-group">
            <label className="f-label" htmlFor="lg-pass">Password</label>
            <input id="lg-pass" className="f-inp" type="password" autoComplete="current-password" value={password}
              onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ minHeight: 48 }} />
          </div>
          {err && <div className="offline-band" style={{ background: '#FBE5E3', borderColor: '#F2B8B3', color: '#A02E24' }}>{err}</div>}
          <button className="btn primary block" style={{ minHeight: 50 }} disabled={busy || !username || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          {offline && offlineRole && (
            <button type="button" className="btn ghost block" style={{ marginTop: 10 }} onClick={() => onOffline(offlineRole)}>
              Continue in offline demo as {offlineRole}
            </button>
          )}
        </form>

        <div className="sub" style={{ marginTop: 22, marginBottom: 10 }}>Demo accounts — tap to fill (password <b>Demo@1234</b>):</div>
        <div className="chips">
          {ROLES.map(r => (
            <button key={r.key} type="button" className={`chip ${username === DEMO_USERS[r.key] ? 'on' : ''}`} onClick={() => prefill(r.key)}>
              {r.name} · {DEMO_USERS[r.key]}
            </button>
          ))}
        </div>

        <div style={{ maxWidth: 420, marginTop: 22 }}>
          <button className="role-card" style={{ width: '100%', borderColor: 'var(--sky-2)', background: 'var(--sky)' }} onClick={onPatient}>
            <span className="ri" style={{ background: 'var(--navy)', color: '#fff' }}><Icon name="users" /></span>
            <span>
              <b>I'm a patient <span className="hi hin">· मैं मरीज़ हूँ</span></b>
              <span>Get a token & watch the live queue — no sign-in needed</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
