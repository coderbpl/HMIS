import Icon from '../icons.jsx';

/* Touch-first controls for clinical use: every target ≥ 48px, tap-not-type
   wherever a value comes from a known set. */

/** Big tappable chip grid — single or multi select. */
export function BigChips({ options, value, onChange, multi = false, cols }) {
  const selected = multi ? value : [value];
  const toggle = opt => {
    if (multi) onChange(selected.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]);
    else onChange(opt === value ? null : opt);
  };
  return (
    <div className="tchips" style={cols ? { gridTemplateColumns: `repeat(${cols}, 1fr)` } : undefined}>
      {options.map(opt => (
        <button key={opt} type="button"
          className={`tchip ${selected.includes(opt) ? 'on' : ''}`}
          onClick={() => toggle(opt)} aria-pressed={selected.includes(opt)}>
          {opt}
        </button>
      ))}
    </div>
  );
}

/** Dose pattern pad — Morning-Afternoon-Night patterns as one tap. */
const DOSE_PATTERNS = ['1-0-1', '1-1-1', '1-0-0', '0-0-1', '0-1-0', '1-1-0', '0-1-1', 'SOS'];
export function DosePad({ value, onChange }) {
  return (
    <div>
      <span className="tlabel">Dose <em>(Morning–Afternoon–Night)</em></span>
      <div className="tchips" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {DOSE_PATTERNS.map(d => (
          <button key={d} type="button" className={`tchip ${value === d ? 'on' : ''}`}
            onClick={() => onChange(d)} aria-pressed={value === d}>{d}</button>
        ))}
      </div>
    </div>
  );
}

/** Large-target numeric stepper. */
export function Stepper({ label, value, onChange, min = 1, max = 90, step = 1, unit }) {
  return (
    <div className="stepper-wrap">
      <span className="tlabel">{label}</span>
      <div className="stepper">
        <button type="button" aria-label={`decrease ${label}`}
          onClick={() => onChange(Math.max(min, value - step))}>−</button>
        <span className="s-val">{value}{unit && <em> {unit}</em>}</span>
        <button type="button" aria-label={`increase ${label}`}
          onClick={() => onChange(Math.min(max, value + step))}>+</button>
      </div>
    </div>
  );
}

/** Common-formulary quick picks — tap a medicine to stage it. */
export function QuickMeds({ meds, onPick, active }) {
  return (
    <div className="qmeds">
      {meds.map(m => {
        const name = typeof m === 'string' ? m : m.name;
        const id = typeof m === 'string' ? m : m.id;
        const isActive = active === name || active === id;
        return (
          <button key={id} type="button" className={`qmed ${isActive ? 'on' : ''}`} onClick={() => onPick(m)}>
            <Icon name="pill" size={15} />
            <span>{name}</span>
          </button>
        );
      })}
    </div>
  );
}
