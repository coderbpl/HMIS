import Icon from './icons.jsx';
import { Avatar } from './ui.jsx';
import { HOSPITAL } from './data.js';

export default function Shell({ role, nav, page, setPage, title, subtitle, onLogout, fixed, offline, children }) {
  return (
    <div className="app">
      <aside className="sidenav">
        <div className="brand">
          <div className="brand-mark"><Icon name="cross" /></div>
          <div className="brand-name"><b className="hin">{HOSPITAL.name}</b><span className="hin">{HOSPITAL.sub}</span></div>
        </div>
        <nav className="nav-list">
          {nav.map(n => (
            <button key={n.key} className={`nav-item ${page === n.key ? 'on' : ''}`} onClick={() => setPage(n.key)} title={n.label}>
              <Icon name={n.icon} />
              <span className="lab">{n.label}<span className="sub hin">{n.hin}</span></span>
            </button>
          ))}
        </nav>
        <div className="nav-foot">
          <button className="nav-user" onClick={onLogout} title="Sign out">
            <Avatar name={role.persona} size="sm" />
            <span className="txt">
              <span className="nm">{role.persona}</span>
              <span className="rl">{role.detail} · Sign out</span>
            </span>
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="tt"><b>{title}</b><span>{subtitle}</span></div>
          <div className="top-search">
            <Icon name="search" />
            <input placeholder="Search patient, UHID, ABHA number…" />
          </div>
          {offline && <span className="role-badge" style={{ background: '#FDF1DA', color: '#8a5a00' }} title="API unreachable — showing demo data">Offline demo</span>}
          <span className="role-badge">{role.name}</span>
          <button className="icon-btn" title="Notifications"><Icon name="bell" /><span className="dot" /></button>
          <button className="icon-btn" onClick={onLogout} title="Sign out"><Icon name="out" /></button>
        </header>

        <div className={`content ${fixed ? 'fixed' : ''}`}>{children}</div>

        <nav className="bottomnav">
          {nav.slice(0, 5).map(n => (
            <button key={n.key} className={page === n.key ? 'on' : ''} onClick={() => setPage(n.key)}>
              <Icon name={n.icon} />{n.short || n.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
