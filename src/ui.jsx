import { useState } from 'react';
import Icon from './icons.jsx';

export function Stat({ icon, tint = 'var(--sky)', ink = 'var(--navy)', big, label, sub, delta, dir }) {
  return (
    <div className="stat">
      <div className="ic" style={{ background: tint, color: ink }}><Icon name={icon} /></div>
      <div className="big">{big}</div>
      <div className="lh">{label}</div>
      {sub && <div className="le">{sub}</div>}
      {delta && <div className={`delta ${dir || 'flat'}`}>{dir === 'up' ? '▲' : dir === 'down' ? '▼' : '•'} {delta}</div>}
    </div>
  );
}

export function SecHead({ title, sub, more, onMore }) {
  return (
    <div className="sec-head">
      <div><b>{title}</b>{sub && <span> · {sub}</span>}</div>
      {more && <button className="more" onClick={onMore}>{more} →</button>}
    </div>
  );
}

export function Pill({ tone = 'neu', children }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export function Avatar({ name, size = 'md' }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('');
  return <div className={`av ${size}`}>{initials}</div>;
}

/* Grouped/single-series bar chart. Thin bars, 4px rounded ends, 2px gaps,
   per-bar hover tooltip, recessive grid. Series colors are validated. */
export function Bars({ data, keys, labels, colors = ['var(--s1)', 'var(--s2)'], height = 168, format = v => v }) {
  const [tip, setTip] = useState(null);
  const W = 560, H = height, padL = 34, padB = 22, padT = 10;
  const max = Math.max(...data.flatMap(d => keys.map(k => d[k]))) * 1.15;
  const iw = (W - padL) / data.length;
  const bw = Math.min(14, (iw - 10) / keys.length);
  const y = v => padT + (H - padB - padT) * (1 - v / max);
  const ticks = [0, 0.5, 1].map(f => Math.round(max * f / 10) * 10);

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }} role="img" aria-label={labels.join(' vs ')}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={padL - 6} y={y(t) + 3.5} fontSize="9.5" fill="var(--muted)" textAnchor="end">{t}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = padL + iw * i + iw / 2;
          const groupW = keys.length * bw + (keys.length - 1) * 2;
          return (
            <g key={d.d}>
              {keys.map((k, ki) => {
                const bx = cx - groupW / 2 + ki * (bw + 2);
                const by = y(d[k]);
                const bh = H - padB - by;
                return (
                  <g key={k}>
                    <rect x={bx} y={by} width={bw} height={Math.max(bh, 2)} rx="4"
                      fill={colors[ki]} opacity={tip && tip.i === i ? 1 : tip ? 0.55 : 1} />
                    <rect x={bx - 3} y={padT} width={bw + 6} height={H - padB - padT} fill="transparent"
                      onMouseEnter={e => setTip({ i, x: ((bx + bw / 2) / W) * 100, y: (by / H) * 100, d })}
                      onMouseLeave={() => setTip(null)} />
                  </g>
                );
              })}
              <text x={cx} y={H - 7} fontSize="10" fill={d.d === 'Today' ? 'var(--navy)' : 'var(--muted)'}
                fontWeight={d.d === 'Today' ? 800 : 500} textAnchor="middle">{d.d}</text>
            </g>
          );
        })}
      </svg>
      {tip && (
        <div className="chart-tip" style={{ left: `${tip.x}%`, top: `${tip.y}%` }}>
          {keys.map((k, ki) => (
            <div key={k}><span className="t2">{labels[ki]}: </span>{format(tip.d[k])}</div>
          ))}
        </div>
      )}
      {keys.length > 1 && (
        <div className="legend">
          {keys.map((k, ki) => (
            <span className="li" key={k}><span className="sw" style={{ background: colors[ki] }} />{labels[ki]}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export function Meter({ label, value, total, tone }) {
  const pct = Math.round((value / total) * 100);
  const cls = tone || (pct >= 90 ? 'hot' : pct >= 75 ? 'warm' : '');
  return (
    <div className={`meter ${cls}`}>
      <div className="m-head"><b>{label}</b><span>{value}/{total} · {pct}%</span></div>
      <div className="m-track"><div className="m-fill" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export function VitalTile({ label, value, unit, tone = 'ok' }) {
  return (
    <div className="vital">
      <span className={`vd ${tone}`} />
      <span className="vl">{label}</span>
      <div className="vv">{value}<span className="vu">{unit}</span></div>
    </div>
  );
}

export const statusPill = s => ({
  'waiting': ['warn', 'Waiting'],
  'checked-in': ['neu', 'Checked in'],
  'in-consult': ['info', 'In consult'],
  'in-progress': ['info', 'In progress'],
  'done': ['ok', 'Done'],
  'booked': ['neu', 'Booked'],
  'paid': ['ok', 'Paid'],
  'pending': ['warn', 'Pending'],
  'waived': ['info', 'Scheme'],
  'ready': ['ok', 'Ready'],
  'dispensing': ['info', 'Dispensing'],
  'queued': ['neu', 'Queued'],
  'ok': ['ok', 'In stock'],
  'low': ['warn', 'Low stock'],
  'critical': ['bad', 'Critical'],
  'on-duty': ['ok', 'On duty'],
  'on-call': ['info', 'On call'],
  'off': ['neu', 'Off shift'],
  'stable': ['ok', 'Stable'],
  'watch': ['warn', 'Watch'],
  'urgent': ['bad', 'Urgent'],
  'normal': ['neu', 'Normal'],
}[s] || ['neu', s]);

export function StatusPill({ s }) {
  const [tone, text] = statusPill(s);
  return <Pill tone={tone}>{text}</Pill>;
}
