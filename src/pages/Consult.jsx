import { useState, useEffect, useMemo } from 'react';
import Icon from '../icons.jsx';
import { SecHead, Pill, VitalTile, StatusPill } from '../ui.jsx';
import {
  DEMO_FACILITIES, DEMO_MEDICINES, DEMO_TEMPLATES,
  ICD10, LAB_GROUPS, MED_ALLERGENS, FOOD_ALLERGENS, BLOOD_GROUPS,
  FH_RELATIONS, FH_CONDITIONS, PAST_ILLNESS, SOCIAL_HABITS,
} from '../data.js';
import { api } from '../api.js';
import { BigChips, DosePad, Stepper, QuickMeds } from '../components/touch.jsx';

const dosesPerDay = d => d === 'SOS' ? 1 : d.split('-').reduce((s, x) => s + Number(x), 0);

const TABS = [
  { key: 'overview', label: 'Overview', hin: 'सारांश', icon: 'doc' },
  { key: 'vitals', label: 'Vitals', hin: 'वाइटल्स', icon: 'pulse' },
  { key: 'allergy', label: 'Allergy & Blood', hin: 'एलर्जी', icon: 'warn' },
  { key: 'history', label: 'History', hin: 'इतिहास', icon: 'history' },
  { key: 'diagnosis', label: 'Diagnosis', hin: 'निदान', icon: 'stetho' },
  { key: 'prescription', label: 'Prescription', hin: 'पर्ची', icon: 'pill' },
  { key: 'orders', label: 'Lab Orders', hin: 'जांच', icon: 'flask' },
  { key: 'disposition', label: 'Disposition', hin: 'निर्णय', icon: 'out' },
];

const vitalTone = (p) => ({
  bp: p.bp && parseInt(p.bp) >= 140 ? 'warn' : 'ok',
  pulse: p.pulse > 100 ? 'warn' : 'ok',
  temp: p.temp >= 100.4 ? 'bad' : p.temp >= 99 ? 'warn' : 'ok',
  spo2: p.spo2 && p.spo2 < 94 ? 'bad' : p.spo2 && p.spo2 < 96 ? 'warn' : 'ok',
});

const fmtV = v => (v === undefined || v === null || v === '') ? '—' : v;

export default function Consult({ patient, tokenId, tokenNo, onClose }) {
  // Live patient record: re-fetched from the queue on mount so vitals recorded
  // at triage are always visible here, even if the queue row was loaded earlier.
  const [p, setP] = useState(patient);
  useEffect(() => {
    if (!tokenId || !api.online) return;
    api.getQueue().then(rows => {
      const row = rows.find(r => r.id === tokenId);
      if (row?.patient) setP(prev => ({ ...prev, ...row.patient, complaint: row.complaint || row.patient.complaint || prev.complaint }));
    }).catch(() => { /* keep the snapshot we came in with */ });
  }, [tokenId]);

  const [tab, setTab] = useState('overview');
  const [dxList, setDxList] = useState([]);
  const [dxQuery, setDxQuery] = useState('');
  // allergy & blood group — prefilled from the record, editable by the doctor
  const [medAllergies, setMedAllergies] = useState(patient.allergies || []);
  const [foodAllergies, setFoodAllergies] = useState(patient.foodAllergies || []);
  const [customAllergy, setCustomAllergy] = useState('');
  const [bloodGroup, setBloodGroup] = useState(patient.bloodGroup || 'Unknown');
  // structured history
  const [pastIllness, setPastIllness] = useState([]);
  const [social, setSocial] = useState([]);
  const [famHistory, setFamHistory] = useState(patient.familyHistory || []);
  const [famRelation, setFamRelation] = useState(null);
  const [famCondition, setFamCondition] = useState(null);
  const [dx, setDx] = useState('');   // kept for template compatibility
  // send back to triage (vitals missing / stale / implausible)
  const [triageBusy, setTriageBusy] = useState(false);
  const [triageErr, setTriageErr] = useState('');
  const sendBackToTriage = async () => {
    setTriageErr(''); setTriageBusy(true);
    try {
      if (tokenId && api.online) await api.returnToTriage(tokenId);
      onClose();
    } catch (err) {
      setTriageErr(err.offline ? 'API unreachable — could not return the token.' : err.message);
    } finally { setTriageBusy(false); }
  };
  const [rx, setRx] = useState([]);
  const [labs, setLabs] = useState(['ECG', 'CBC']);
  const [dispo, setDispo] = useState('home');
  const [done, setDone] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  // EHR overlay — full patient timeline from the API
  const [ehrOpen, setEhrOpen] = useState(false);
  const [ehrEvents, setEhrEvents] = useState(null);
  const [ehrBusy, setEhrBusy] = useState(false);
  const openEhr = async () => {
    setEhrOpen(true);
    if (ehrEvents) return;
    setEhrBusy(true);
    try { setEhrEvents(await api.patientHistory(p.id)); }
    catch { setEhrEvents([]); }
    finally { setEhrBusy(false); }
  };
  
  // Custom states for inputs to support templates
  const [complaint, setComplaint] = useState(p.complaint || '');
  const [notes, setNotes] = useState('Exertional chest discomfort for 3 days, relieved by rest. No radiation. Associated breathlessness climbing 1 flight.');
  const [exam, setExam] = useState('');
  const [advice, setAdvice] = useState('Avoid exertion until cardiac workup complete. Return immediately if chest pain at rest, sweating, or breathlessness.');
  const [followUp, setFollowUp] = useState('OPD review if symptoms persist.');

  // Facility and medicine states
  const [facilities, setFacilities] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState(api.user?.facilityCode || 'DIST_HOSP_01');
  const [medicines, setMedicines] = useState([]);
  const [quickMeds, setQuickMeds] = useState([]);
  
  // Search medicines
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Templates
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  // Add med form state
  const [med, setMed] = useState('');
  const [dose, setDose] = useState('1-0-1');
  const [days, setDays] = useState(5);
  
  const tones = vitalTone(p);
  const bmi = p.weight && p.height ? Number((p.weight / ((p.height / 100) ** 2)).toFixed(1)) : null;
  const bmiBand = bmi == null ? '' : bmi < 18.5 ? 'underweight' : bmi < 25 ? 'normal' : bmi < 30 ? 'overweight' : 'obese';
  const dxResults = useMemo(() => {
    const q = dxQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return ICD10.filter(d => d.code.toLowerCase().includes(q) || d.label.toLowerCase().includes(q)).slice(0, 8);
  }, [dxQuery]);
  const dxLabel = d => `${d.code} ${d.label}`;
  const toggleDx = label => setDxList(l => l.includes(label) ? l.filter(x => x !== label) : [...l, label]);

  // Fetch initial facilities and templates
  useEffect(() => {
    async function loadData() {
      try {
        const facs = await api.getFacilities();
        setFacilities(facs.length ? facs : DEMO_FACILITIES);
      } catch (err) {
        setFacilities(DEMO_FACILITIES);
      }

      try {
        const tmps = await api.getTemplates();
        setTemplates(tmps.length ? tmps : DEMO_TEMPLATES);
      } catch (err) {
        setTemplates(DEMO_TEMPLATES);
      }
    }
    loadData();
  }, []);

  // Fetch medicines based on selected facility
  useEffect(() => {
    async function loadMedicines() {
      try {
        const meds = await api.getMedicines(selectedFacility, api.user?.id);
        setMedicines(meds);
        setQuickMeds(meds.filter(m => m.isQuickPick));
      } catch (err) {
        setMedicines(DEMO_MEDICINES);
        setQuickMeds(DEMO_MEDICINES.filter(m => m.isQuickPick));
      }
    }
    loadMedicines();
  }, [selectedFacility]);

  // Search medicines debounce
  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      const delayFn = setTimeout(async () => {
        try {
          const results = await api.searchMedicines(searchQuery, selectedFacility);
          setSearchResults(results);
        } catch (err) {
          setSearchResults(DEMO_MEDICINES.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase())));
        }
      }, 300);
      return () => clearTimeout(delayFn);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, selectedFacility]);

  const markDone = key => setDone(d => ({ ...d, [key]: true }));
  const next = () => {
    markDone(tab);
    const i = TABS.findIndex(t => t.key === tab);
    if (i < TABS.length - 1) setTab(TABS[i + 1].key);
  };
  const toggleLab = t => setLabs(l => l.includes(t) ? l.filter(x => x !== t) : [...l, t]);

  const handlePickMed = (m) => {
    setMed(m.name);
    setDose(m.defaultFrequency || '1-0-1');
    setDays(parseInt(m.defaultDuration) || 5);
    setSearchQuery('');
    setSearchResults([]);
  };

  const addMed = () => {
    if (!med.trim()) return;
    setRx(a => [...a, { med: med.trim(), dose, days }]);
    setMed(''); setDose('1-0-1'); setDays(5);
  };

  const handleSelectTemplate = (id) => {
    setSelectedTemplate(id);
    const t = templates.find(x => x.id === id);
    if (!t) return;
    
    if (t.complaints) setComplaint(t.complaints);
    if (t.examination) setExam(t.examination);
    if (t.diagnosis) { setDx(t.diagnosis); setDxList(l => l.includes(t.diagnosis) ? l : [...l, t.diagnosis]); }
    if (t.prescription) {
      setRx(t.prescription.map(r => ({
        med: r.name || r.med,
        dose: r.dose,
        days: r.duration || r.days || 5
      })));
    }
    if (t.advice) setAdvice(t.advice);
    if (t.followUp) setFollowUp(t.followUp);
    markDone('overview');
    markDone('diagnosis');
    markDone('prescription');
  };

  const handleSaveAsTemplate = async () => {
    if (!newTemplateName.trim()) return;
    try {
      const templateData = {
        name: newTemplateName.trim(),
        category: 'General Medicine',
        complaints: complaint,
        examination: exam,
        diagnosis: dx,
        prescription: rx.map(r => ({
          name: r.med,
          dose: r.dose,
          duration: r.days,
          qty: dosesPerDay(r.dose) * r.days
        })),
        advice: advice,
        followUp: followUp
      };

      let saved;
      if (api.online) {
        saved = await api.saveTemplate(templateData);
      } else {
        saved = { ...templateData, id: `TMP-${Date.now()}`, doctorId: 'U-1', isSystemDefault: false };
      }

      setTemplates(prev => [...prev, saved]);
      setSelectedTemplate(saved.id);
      setShowTemplateModal(false);
      setNewTemplateName('');
    } catch (err) {
      alert('Failed to save template: ' + err.message);
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      if (api.online) {
        await api.deleteTemplate(id);
      }
      setTemplates(prev => prev.filter(t => t.id !== id));
      if (selectedTemplate === id) setSelectedTemplate('');
    } catch (err) {
      alert('Failed to delete template: ' + err.message);
    }
  };

  const complete = async () => {
    setSaveErr(''); setSaving(true);
    try {
      if (tokenId && api.online) {
        await api.saveConsult({
          tokenId,
          dx: dxList.length ? dxList.join('; ').slice(0, 400) : (dx || undefined),
          dispo: dispo || 'home',
          notes: `${notes}\n\nExam: ${exam}`,
          rx: rx.map(r => ({
            name: r.med,
            dose: r.dose,
            duration: r.days,
            qty: dosesPerDay(r.dose) * r.days
          })),
          labs,
          allergies: { med: medAllergies, food: foodAllergies },
          bloodGroup,
          familyHistory: famHistory,
          pastIllness,
          social,
        });
      }
      onClose();
    } catch (err) {
      setSaveErr(err.offline ? 'Saved locally — API unreachable.' : err.message);
      if (err.offline) setTimeout(onClose, 1200);
    } finally { setSaving(false); }
  };

  const panel = {
    overview: (
      <div className="grid-2eq">
        <div className="card">
          <SecHead title="Presenting complaint" sub="recorded at triage" />
          <textarea className="f-area" value={complaint} onChange={e => setComplaint(e.target.value)} style={{ minHeight: 80 }} />
          <SecHead title="Active conditions" />
          {p.conditions && p.conditions.length ? p.conditions.map(c => (
            <div className="kv" key={c}><span className="k">Chronic</span><span className="v">{c}</span></div>
          )) : <div className="empty">No known chronic conditions</div>}
          {p.allergies && p.allergies.length > 0 && (
            <div className="note-band" style={{ marginTop: 14, background: '#FBE5E3', borderColor: '#F2B8B3' }}>
              <span className="nd" style={{ background: 'var(--red)' }} />
              <div><b>Allergies: {p.allergies.join(', ')}</b><span>Verify before prescribing.</span></div>
            </div>
          )}
        </div>
        <div className="card">
          <SecHead title="Snapshot" />
          <div className="kv"><span className="k">UHID</span><span className="v">{p.id}</span></div>
          <div className="kv"><span className="k">ABHA</span><span className="v">{p.abha}</span></div>
          <div className="kv"><span className="k">Department</span><span className="v">{p.dept}</span></div>
          <div className="kv"><span className="k">Last visit</span><span className="v">{p.lastVisit}</span></div>
          <div className="kv"><span className="k">Current meds</span><span className="v">{p.meds && p.meds.length ? p.meds.join(' · ') : 'None'}</span></div>
          <div className="kv"><span className="k">Blood group</span><span className="v">{bloodGroup !== 'Unknown' ? bloodGroup : '— not on record'}</span></div>
          <div className="kv"><span className="k">Weight / BMI</span><span className="v">{fmtV(p.weight)} kg{bmi ? ` · BMI ${bmi} (${bmiBand})` : ''}</span></div>
          {famHistory.length > 0 && (
            <div className="kv"><span className="k">Family history</span><span className="v">{famHistory.map(f => `${f.relation}: ${f.condition}`).join(' · ')}</span></div>
          )}
        </div>
      </div>
    ),
    vitals: (
      <div className="card">
        <SecHead title="Vitals" sub={p.vitalsAt ? `recorded at triage · ${new Date(p.vitalsAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'captured by nursing at triage'} />
        {!p.bp && !p.pulse && (
          <div className="note-band" style={{ marginBottom: 14 }}>
            <span className="nd" />
            <div><b>Vitals not recorded yet</b><span>The nursing desk hasn't charted this patient — send them to triage first.</span></div>
          </div>
        )}
        <div className="vitals-grid">
          <VitalTile label="Blood pressure" value={fmtV(p.bp)} unit="mmHg" tone={tones.bp} />
          <VitalTile label="Pulse" value={fmtV(p.pulse)} unit="bpm" tone={tones.pulse} />
          <VitalTile label="Temperature" value={fmtV(p.temp)} unit="°F" tone={tones.temp} />
          <VitalTile label="SpO₂" value={p.spo2 ? `${p.spo2}%` : '—'} unit="RA" tone={tones.spo2} />
          <VitalTile label="Respiratory rate" value={fmtV(p.rr)} unit="/min" />
          <VitalTile label="Weight" value={fmtV(p.weight)} unit="kg" />
          <VitalTile label="Height" value={fmtV(p.height)} unit="cm" />
          <VitalTile label="BMI" value={bmi ?? '—'} unit={bmi ? bmiBand : 'needs ht + wt'} tone={bmi >= 30 || (bmi && bmi < 18.5) ? 'warn' : 'ok'} />
        </div>
        <div className="note-band" style={{ marginTop: 14, background: '#F0F6EE', borderColor: '#CFE6C5' }}>
          <span className="nd" style={{ background: 'var(--green)' }} />
          <div>
            <b>Reference · adult</b>
            <span>BP 90–120/60–80 · pulse 60–100 · temp 97–99 °F · SpO₂ ≥95% · RR 12–20 · BMI 18.5–24.9</span>
          </div>
        </div>
        {(tones.spo2 !== 'ok' || tones.temp === 'bad') && (
          <div className="note-band" style={{ marginTop: 10 }}>
            <span className="nd" />
            <div><b>Out-of-range values flagged</b><span>Review SpO₂ / temperature before disposition.</span></div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className={`btn ${!p.bp && !p.pulse ? 'primary' : 'ghost'}`} disabled={triageBusy}
            onClick={sendBackToTriage}>
            <Icon name="back" size={14} /> {triageBusy ? 'Sending…' : 'Send back to nurse for vitals'}
          </button>
          <span className="hint" style={{ fontSize: 11.5, color: 'var(--muted)' }}>
            Returns the token to the triage queue — it reappears here once re-charted.
          </span>
        </div>
        {triageErr && <div className="offline-band" style={{ marginTop: 10, background: '#FBE5E3', borderColor: '#F2B8B3', color: '#A02E24' }}>{triageErr}</div>}
      </div>
    ),
    allergy: (
      <div className="grid-2eq">
        <div className="card">
          <SecHead title="Drug allergies" sub="checked against every prescription" />
          <BigChips options={MED_ALLERGENS} value={medAllergies} onChange={setMedAllergies} multi cols={2} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input className="f-inp" placeholder="Other drug allergy…" value={customAllergy}
              onChange={e => setCustomAllergy(e.target.value)} style={{ minHeight: 46 }} />
            <button type="button" className="btn ghost" disabled={!customAllergy.trim()}
              onClick={() => { setMedAllergies(a => [...new Set([...a, customAllergy.trim()])]); setCustomAllergy(''); }}>
              Add
            </button>
          </div>
          <SecHead title="Food allergies" sub="for diet advice & IPD kitchen" />
          <BigChips options={FOOD_ALLERGENS} value={foodAllergies} onChange={setFoodAllergies} multi cols={2} />
        </div>
        <div className="card">
          <SecHead title="Blood group" sub="verified only by lab report" />
          <BigChips options={BLOOD_GROUPS} value={bloodGroup} onChange={v => setBloodGroup(v || 'Unknown')} cols={3} />
          {(medAllergies.length > 0 || foodAllergies.length > 0) && (
            <div className="note-band" style={{ marginTop: 16, background: '#FBE5E3', borderColor: '#F2B8B3' }}>
              <span className="nd" style={{ background: 'var(--red)' }} />
              <div>
                <b>Recorded on this patient permanently</b>
                <span>{[...medAllergies, ...foodAllergies].join(', ')} — every future prescription screen will warn.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    ),
    history: (
      <div className="grid-2eq">
        <div className="card">
          <SecHead title="Visit timeline" sub="EMR · ABHA linked" />
          <div className="tl">
            <div className="tl-item"><b>OPD · General Medicine</b><span>{p.lastVisit}</span><p>Routine review. Medication compliance good. Advised diet control and follow-up in 4 weeks.</p></div>
            <div className="tl-item"><b>Lab · HbA1c 7.9%</b><span>28 May 2026</span><p>Above target. Metformin continued; lifestyle counselling given.</p></div>
            <div className="tl-item"><b>OPD · First registration</b><span>14 Jan 2024</span><p>Registered under NCD screening camp. Baseline workup ordered.</p></div>
          </div>
        </div>
        <div className="card">
          <SecHead title="Clinical notes" sub="this visit" />
          <label className="f-label">History of present illness</label>
          <textarea className="f-area" placeholder="Onset, duration, aggravating factors…" value={notes} onChange={e => setNotes(e.target.value)} />
          <label className="f-label" style={{ marginTop: 12 }}>Examination findings</label>
          <textarea className="f-area" placeholder="General and systemic examination findings..." value={exam} onChange={e => setExam(e.target.value)} />

          <SecHead title="Past illness" sub="tap all that apply" />
          <BigChips options={PAST_ILLNESS} value={pastIllness} onChange={setPastIllness} multi cols={3} />

          <SecHead title="Family history" sub="who has what — e.g. Father · Diabetes" />
          <span className="tlabel">Relation</span>
          <BigChips options={FH_RELATIONS} value={famRelation} onChange={setFamRelation} cols={4} />
          <span className="tlabel" style={{ marginTop: 10 }}>Condition</span>
          <BigChips options={FH_CONDITIONS} value={famCondition} onChange={setFamCondition} cols={3} />
          <button type="button" className="btn primary block" style={{ marginTop: 12, minHeight: 48 }}
            disabled={!famRelation || !famCondition}
            onClick={() => {
              setFamHistory(h => h.some(x => x.relation === famRelation && x.condition === famCondition)
                ? h : [...h, { relation: famRelation, condition: famCondition }]);
              setFamRelation(null); setFamCondition(null);
            }}>
            <Icon name="plus" size={15} /> Add {famRelation && famCondition ? `${famRelation} · ${famCondition}` : 'family history'}
          </button>
          {famHistory.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {famHistory.map((f, i) => (
                <div className="rx-added" key={i}>
                  <b>{f.relation} — {f.condition}</b>
                  <button className="rx-del" onClick={() => setFamHistory(h => h.filter((_, xi) => xi !== i))} aria-label="Remove">×</button>
                </div>
              ))}
            </div>
          )}

          <SecHead title="Social history" />
          <BigChips options={SOCIAL_HABITS} value={social} onChange={setSocial} multi cols={4} />
        </div>
      </div>
    ),
    diagnosis: (
      <div className="card">
        <SecHead title="Provisional diagnosis" sub={`ICD-10 · ${dxList.length} selected — multiple allowed`} />

        {dxList.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            {dxList.map(d => (
              <div className="rx-added" key={d}>
                <b>{d}</b>
                <button className="rx-del" onClick={() => toggleDx(d)} aria-label={`Remove ${d}`}>×</button>
              </div>
            ))}
          </div>
        )}

        <div className="f-group" style={{ position: 'relative' }}>
          <label className="f-label">Search ICD-10 <em>· type 2+ letters, e.g. "diab", "fever", "I10"</em></label>
          <input className="f-inp" style={{ minHeight: 48, fontSize: 15 }} placeholder="Search by code or name…"
            value={dxQuery} onChange={e => setDxQuery(e.target.value)} />
          {dxResults.length > 0 && (
            <div className="search-dropdown-menu">
              {dxResults.map(d => (
                <div key={d.code} className="search-dropdown-item"
                  onClick={() => { toggleDx(dxLabel(d)); setDxQuery(''); }}>
                  <Icon name="stetho" size={14} style={{ marginRight: 8 }} />
                  <span><b>{d.code}</b> {d.label} {dxList.includes(dxLabel(d)) && '✓'}</span>
                </div>
              ))}
            </div>
          )}
          {dxQuery.trim().length >= 2 && dxResults.length === 0 && (
            <div className="empty" style={{ padding: '10px 0' }}>
              No match — <button type="button" className="more" style={{ color: 'var(--blue)', fontWeight: 700 }}
                onClick={() => { toggleDx(dxQuery.trim()); setDxQuery(''); }}>add "{dxQuery.trim()}" as free text</button>
            </div>
          )}
        </div>

        <span className="tlabel">Common in OPD <em>· tap to add / remove</em></span>
        <BigChips
          options={['I20.9 Angina pectoris', 'I10 Essential hypertension', 'E11.9 Type 2 diabetes mellitus', 'J06.9 Acute upper respiratory infection (URTI)', 'A09.9 Gastroenteritis, unspecified', 'R50.9 Fever, unspecified']}
          value={dxList} onChange={setDxList} multi cols={2} />
      </div>
    ),
    prescription: (
      <div className="card">
        <SecHead title="Digital prescription" sub={`${rx.length} medicines · select from available items`} />
        {medAllergies.length > 0 && <div style={{ marginBottom: 12 }}><Pill tone="bad">Drug allergy: {medAllergies.join(', ')}</Pill></div>}
        {med && medAllergies.some(a => med.toLowerCase().includes(a.split(' ')[0].toLowerCase())) && (
          <div className="note-band" style={{ marginBottom: 12, background: '#FBE5E3', borderColor: '#F2B8B3' }}>
            <span className="nd" style={{ background: 'var(--red)' }} />
            <div><b>⚠ Possible allergy conflict</b><span>"{med}" matches a recorded drug allergy — verify before adding.</span></div>
          </div>
        )}

        <div className="rx-composer">
          <span className="tlabel">Quick-Pick Medicines <em>· available at this facility</em></span>
          {quickMeds.length ? (
            <QuickMeds meds={quickMeds} onPick={handlePickMed} active={med} />
          ) : (
            <div className="empty" style={{ padding: '8px 0' }}>No quick picks configured. Use search below.</div>
          )}
          
          <div className="rc-row" style={{ marginTop: 14 }}>
            <div style={{ position: 'relative' }}>
              <span className="tlabel">Search Medicine Catalog</span>
              <input className="f-inp" style={{ minHeight: 50, fontSize: 15 }} placeholder="Type to search medicines..."
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              
              {searchResults.length > 0 && (
                <div className="search-dropdown-menu">
                  {searchResults.map(m => (
                    <div key={m.id} className="search-dropdown-item" onClick={() => handlePickMed(m)}>
                      <Icon name="pill" size={14} style={{ marginRight: 8 }} />
                      <span>{m.name} <small>({m.genericName})</small></span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DosePad value={dose} onChange={setDose} />
            <Stepper label="Duration" value={days} onChange={setDays} min={1} max={90} unit="days" />
          </div>
          
          {med && (
            <div className="note-band" style={{ marginTop: 10, background: '#EAF1FD', borderColor: '#B3C8F2' }}>
              <Icon name="pill" size={16} />
              <div>Staging: <b>{med}</b> — {dose} for {days} days.</div>
            </div>
          )}

          <button type="button" className="btn primary block" style={{ marginTop: 14, minHeight: 52, fontSize: 15 }}
            onClick={addMed} disabled={!med.trim()}>
            <Icon name="plus" size={16} /> Add to prescription {med.trim() && `— ${dosesPerDay(dose) * days} units`}
          </button>
        </div>

        {rx.length === 0 && <div className="empty" style={{ marginTop: 14 }}>Nothing prescribed yet.</div>}
        {rx.map((r, i) => {
          const name = r.med || r.name;
          const qty = r.qty || dosesPerDay(r.dose) * r.days;
          return (
            <div className="rx-added" key={i}>
              <b>{name}</b>
              <span className="meta">{r.dose} · {r.days} days · qty {qty}</span>
              <button className="rx-del" onClick={() => setRx(a => a.filter((_, xi) => xi !== i))} aria-label={`Remove ${name}`}>×</button>
            </div>
          );
        })}
        <div className="note-band" style={{ marginTop: 14 }}>
          <span className="nd" />
          <div><b>Sent to pharmacy on completion</b><span>The patient collects against their token — no paper needed.</span></div>
        </div>
      </div>
    ),
    orders: (
      <div className="card">
        <SecHead title="Investigations" sub={`${labs.length} selected · sent to lab & radiology queues`} />
        {LAB_GROUPS.map(g => (
          <div key={g.group} style={{ marginBottom: 16 }}>
            <span className="tlabel">{g.group} <em>· {g.tests.filter(t => labs.includes(t)).length}/{g.tests.length} selected</em></span>
            <div className="chips">
              {g.tests.map(t => (
                <button key={t} className={`chip ${labs.includes(t) ? 'on' : ''}`} onClick={() => toggleLab(t)}>{t}</button>
              ))}
            </div>
          </div>
        ))}
        {labs.length > 0 && (
          <div className="note-band">
            <span className="nd" />
            <div><b>Ordered: {labs.join(', ')}</b><span>Samples queue at the lab against token {tokenNo}.</span></div>
          </div>
        )}
      </div>
    ),
    disposition: (
      <div className="card">
        <SecHead title="Disposition" sub="decide the patient pathway" />
        <div className="chips" style={{ marginBottom: 18 }}>
          {[
            ['home', 'Send home with Rx'],
            ['review', 'OPD review (7 days)'],
            ['admit', 'Admit to IPD'],
            ['refer', 'Refer higher centre'],
          ].map(([k, label]) => (
            <button key={k} className={`chip ${dispo === k ? 'on' : ''}`} onClick={() => setDispo(k)}>{label}</button>
          ))}
        </div>
        {dispo === 'admit' && (
          <div className="f-row3" style={{ marginBottom: 14 }}>
            <div><label className="f-label">Ward</label><select className="f-sel"><option>General Ward</option><option>ICU</option><option>Maternity</option><option>Pediatric</option></select></div>
            <div><label className="f-label">Bed</label><select className="f-sel"><option>GW-04 (free)</option><option>GW-06 (free)</option><option>ICU-4 (free)</option></select></div>
            <div><label className="f-label">Admitting diagnosis</label><input className="f-inp" defaultValue={dxList[0] || dx || ''} placeholder="From the diagnosis tab" /></div>
          </div>
        )}
        {dispo === 'refer' && (
          <div className="f-row" style={{ marginBottom: 14 }}>
            <div><label className="f-label">Refer to</label><select className="f-sel"><option>AIIMS Bhopal — Cardiology</option><option>Hamidia Hospital</option></select></div>
            <div><label className="f-label">Transport</label><select className="f-sel"><option>108 Ambulance</option><option>Own arrangement</option></select></div>
          </div>
        )}
        <label className="f-label">Advice to patient</label>
        <textarea className="f-area" placeholder="Diet, activity, red-flag symptoms, follow-up…" value={advice} onChange={e => setAdvice(e.target.value)} />
        <label className="f-label" style={{ marginTop: 12 }}>Follow-Up instructions</label>
        <input className="f-inp" value={followUp} onChange={e => setFollowUp(e.target.value)} />
      </div>
    ),
  }[tab];

  return (
    <div className="ws">
      <aside className="ws-rail">
        <div className="rail-head">Consultation</div>
        {TABS.map(t => (
          <button key={t.key} className={`ws-tab ${tab === t.key ? 'on' : ''} ${done[t.key] ? 'done-mark' : ''}`} onClick={() => setTab(t.key)} title={t.label}>
            <Icon name={t.icon} />
            <span className="lab">{t.label}<span className="sub hin">{t.hin}</span></span>
            {t.key === 'prescription' && rx.length > 0 && <span className="badge">{rx.length}</span>}
            {t.key === 'orders' && labs.length > 0 && <span className="badge">{labs.length}</span>}
            {t.key === 'diagnosis' && dxList.length > 0 && <span className="badge">{dxList.length}</span>}
            {t.key === 'allergy' && (medAllergies.length + foodAllergies.length) > 0 && <span className="badge">{medAllergies.length + foodAllergies.length}</span>}
          </button>
        ))}
      </aside>

      <div className="ws-main">
        <div className="pt-head">
          <button className="icon-btn" onClick={onClose} title="Back to queue"><Icon name="back" /></button>
          <div className="who">
            <b>{p.name} · {p.age} {p.sex}</b>
            <span>{p.id} · ABHA {p.abha}</span>
          </div>
          <div className="meta">
            {tokenNo && <Pill tone="info">Token {tokenNo}</Pill>}
            <Pill tone="info">{p.dept}</Pill>
            {p.allergies && p.allergies.map(a => <Pill key={a} tone="bad">⚠ {a}</Pill>)}
            <StatusPill s="in-consult" />
          </div>
          <div className="acts">
            <button className="btn ghost sm" onClick={openEhr}><Icon name="history" size={14} /> EHR</button>
            <button className="btn ghost sm" onClick={() => window.print()}><Icon name="clip" size={14} /> Print slip</button>
          </div>
        </div>

        {ehrOpen && (
          <EhrPanel patient={p} events={ehrEvents} busy={ehrBusy} onClose={() => setEhrOpen(false)} />
        )}

        {/* Dynamic Facility & Template control bar */}
        <div className="consult-bar">
          <div className="bar-item">
            <label className="tlabel">Current Facility</label>
            <select value={selectedFacility} onChange={e => setSelectedFacility(e.target.value)} className="f-sel inline-sel">
              {facilities.map(f => (
                <option key={f.code} value={f.code}>{f.name}</option>
              ))}
            </select>
          </div>
          
          <div className="bar-item">
            <label className="tlabel">Load Clinical Template</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={selectedTemplate} onChange={e => handleSelectTemplate(e.target.value)} className="f-sel inline-sel">
                <option value="">-- Select template --</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} {t.isSystemDefault ? '(System)' : ''}</option>
                ))}
              </select>
              {selectedTemplate && !templates.find(t => t.id === selectedTemplate)?.isSystemDefault && (
                <button type="button" className="btn danger sm" style={{ padding: '0 10px', height: 34 }} onClick={() => handleDeleteTemplate(selectedTemplate)}>
                  Delete
                </button>
              )}
            </div>
          </div>
          
          <button type="button" className="btn ghost sm" onClick={() => setShowTemplateModal(true)}>
            Save as Template
          </button>
        </div>

        <div className="ws-body">{panel}</div>

        <div className="ws-foot">
          <span className="hint">Token {tokenNo || '—'} · {Object.keys(done).length}/{TABS.length} sections reviewed{saveErr && ` · ${saveErr}`}</span>
          <button className="btn ghost" onClick={onClose}>Save draft</button>
          {tab !== 'disposition'
            ? <button className="btn primary" onClick={next}>Save & next section <Icon name="arrow" size={15} /></button>
            : <button className="btn dark" onClick={complete} disabled={saving}><Icon name="check" size={15} /> {saving ? 'Saving…' : 'Complete consultation'}</button>}
        </div>
      </div>

      {/* Save Template Modal */}
      {showTemplateModal && (
        <div className="modal-overlay">
          <div className="modal card" style={{ maxWidth: 450, padding: 20 }}>
            <h3>Save Consultation as Template</h3>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 15 }}>
              This will save the complaints, examination notes, provisional diagnosis, prescriptions, and advice as a reusable clinical template.
            </p>
            <div className="f-group">
              <label className="f-label">Template Name</label>
              <input className="f-inp" placeholder="e.g. Acute Bronchitis" value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} />
            </div>
            
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn ghost" onClick={() => setShowTemplateModal(false)}>Cancel</button>
              <button className="btn primary" onClick={handleSaveAsTemplate} disabled={!newTemplateName.trim()}>Save Template</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- EHR overlay: full patient timeline, filter by category, grouped by date ---------- */
const EHR_TYPES = [
  { key: 'all', label: 'All', icon: 'history' },
  { key: 'visit', label: 'Visits', icon: 'cal' },
  { key: 'vitals', label: 'Vitals', icon: 'pulse' },
  { key: 'consult', label: 'Consults', icon: 'stetho' },
  { key: 'rx', label: 'Prescriptions', icon: 'pill' },
];
const EHR_TONE = { visit: 'neu', vitals: 'warn', consult: 'info', rx: 'ok' };

function EhrPanel({ patient, events, busy, onClose }) {
  const [filter, setFilter] = useState('all');
  const list = (events || []).filter(e => filter === 'all' || e.type === filter);
  const counts = (events || []).reduce((m, e) => ({ ...m, [e.type]: (m[e.type] || 0) + 1 }), {});
  // group by date, newest first (API already sorts newest-first)
  const groups = [];
  list.forEach(e => {
    const g = groups.find(x => x.date === e.date);
    if (g) g.items.push(e); else groups.push({ date: e.date, items: [e] });
  });
  const fmtDate = d => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      if (d === today) return 'Today';
      return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return d; }
  };
  return (
    <div className="ehr-overlay" role="dialog" aria-label={`Health record of ${patient.name}`}>
      <div className="ehr-scrim" onClick={onClose} />
      <div className="ehr-panel">
        <div className="ehr-head">
          <div>
            <b>{patient.name} · EHR</b>
            <span>{patient.id}{patient.abha ? ` · ABHA ${patient.abha}` : ''}{patient.bloodGroup ? ` · ${patient.bloodGroup}` : ''}</span>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close health record"><Icon name="plus" style={{ transform: 'rotate(45deg)' }} /></button>
        </div>

        <div className="ehr-filters">
          {EHR_TYPES.map(t => (
            <button key={t.key} className={`chip ${filter === t.key ? 'on' : ''}`} onClick={() => setFilter(t.key)}>
              {t.label}{t.key !== 'all' && counts[t.key] ? ` · ${counts[t.key]}` : ''}
            </button>
          ))}
        </div>

        <div className="ehr-body">
          {busy && <div className="empty">Loading record…</div>}
          {!busy && groups.length === 0 && <div className="empty">No history yet for this patient.</div>}
          {groups.map(g => (
            <div key={g.date} className="ehr-day">
              <div className="ehr-date">{fmtDate(g.date)}</div>
              {g.items.map((e, i) => (
                <div key={i} className="ehr-ev">
                  <span className={`ehr-ic pill ${EHR_TONE[e.type] || 'neu'}`}>
                    <Icon name={EHR_TYPES.find(t => t.key === e.type)?.icon || 'doc'} size={13} />
                  </span>
                  <div className="ehr-tx">
                    <b>{e.title}</b>
                    {e.detail && <span>{e.detail}</span>}
                    {(e.doctor || e.recordedBy) && <em>by {e.doctor || e.recordedBy}</em>}
                  </div>
                  {e.status && <StatusPill s={e.status} />}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
