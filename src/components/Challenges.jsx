import React, { useState } from 'react';
import HashiBoard from './HashiBoard';

export function Field({ label, value, onChange, numeric = false, ...props }) {
  return <label className="form-group"><span className="form-label">{label}</span><input className="form-control" value={value ?? ''} onChange={e => onChange(e.target.value)} inputMode={numeric ? 'numeric' : undefined} {...props} /></label>;
}
function OrderInput({ label, options, value = [], onChange }) {
  return <div className="dossier-card"><h3>{label}</h3><div className="answer-grid">{options.map((_, index) => <label key={index} className="form-group"><span className="form-label">Position {index + 1}</span><select className="form-control" value={value[index] || ''} onChange={e => { const next = [...value]; next[index] = e.target.value; onChange(next); }}><option value="">Choose…</option>{options.map(option => <option key={option} disabled={value.includes(option) && value[index] !== option}>{option}</option>)}</select></label>)}</div></div>;
}
function Rules({ rules }) { return rules?.length ? <ul className="challenge-rules">{rules.map(rule => <li key={rule}>{rule}</li>)}</ul> : null; }
function PigFortress({ config, answer, onChange }) {
  const update = patch => onChange({ ...answer, ...patch });
  return <>
    <p>{config.description}</p><Rules rules={config.rules} />
    <h3>Round 1 — Classify every pig</h3>
    <div className="answer-grid">{config.taunts_round1.map(({ pig, statement }) => <label key={pig} className="dossier-card"><strong>{pig}</strong><p>{statement}</p><select aria-label={`${pig} classification`} className="form-control" value={answer.pigs?.[pig] || ''} onChange={e => update({ pigs: { ...answer.pigs, [pig]: e.target.value } })}><option value="">Choose…</option><option value="HONEST">Honest</option><option value="LIAR">Liar</option></select></label>)}</div>
    <h3>Round 2 — Bird launch clues</h3><div className="dossier-card">{config.taunts_round2.map(({ pig, statement }) => <p key={pig}><strong>{pig}:</strong> {statement}</p>)}</div>
    <OrderInput label="Bird launch order" options={['Red', 'Chuck', 'Matilda', 'Bomb', 'Hal']} value={answer.launch_order} onChange={launch_order => update({ launch_order })} />
    <div className="dossier-card"><h3>Calculate damage and the vault PIN</h3><p>{Object.entries(config.scoring_rules.powers).map(([name, power]) => `${name}: ${power}`).join(' • ')}</p><Rules rules={Object.entries(config.scoring_rules).filter(([key]) => key !== 'powers').map(([, value]) => value)} /></div>
    <div className="answer-grid"><Field label="Total damage" numeric value={answer.total_damage} onChange={total_damage => update({ total_damage })} /><Field label="Vault PIN" numeric value={answer.vault_pin} onChange={vault_pin => update({ vault_pin })} /></div>
  </>;
}
const colors = { Red: '#ef4444', Blue: '#3b82f6', Green: '#10b981', Yellow: '#eab308', Purple: '#a855f7' };
function Officers({ config, answer, onChange, disabled }) {
  const [selected, setSelected] = useState(null);
  const arrangement = Array.isArray(answer.arrangement) ? answer.arrangement : Array(25).fill(null);
  const same = (a, b) => a && b && a.color === b.color && a.piece === b.piece;
  const place = index => {
    if (disabled) return;
    const next = [...arrangement];
    if (!selected) { if (next[index]) { setSelected(next[index]); next[index] = null; } }
    else { const old = next.findIndex(item => same(item, selected)); if (old !== -1) next[old] = null; next[index] = selected; setSelected(null); }
    onChange({ arrangement: next });
  };
  return <><p>{config.description}</p><p>Select an officer, then select a cell. Select a filled cell to pick it up. Every row and column needs all five colors and all five pieces; every color–piece pair must appear once.</p>
    <div className="officer-layout"><div><h3>Available officers</h3><div className="officer-palette">{config.colors.flatMap(color => config.pieces.map(piece => { const officer = { color, piece }; const used = arrangement.some(item => same(item, officer)); return <button type="button" key={`${color}-${piece}`} disabled={disabled || used} aria-label={`${color} ${piece}`} aria-pressed={!!same(selected, officer)} style={{ color: colors[color] }} onClick={() => setSelected(same(selected, officer) ? null : officer)}>{piece}<small>{color}</small></button>; }))}</div><p role="status">{selected ? `Selected: ${selected.color} ${selected.piece}` : 'Select an officer to place'}</p></div>
    <div><h3>5 × 5 arrangement</h3><div className="officer-board">{Array.from({ length: 25 }, (_, index) => <button type="button" key={index} disabled={disabled} aria-label={`Row ${Math.floor(index / 5) + 1} column ${index % 5 + 1}: ${arrangement[index] ? `${arrangement[index].color} ${arrangement[index].piece}` : 'empty'}`} style={{ color: colors[arrangement[index]?.color] }} onClick={() => place(index)}>{arrangement[index]?.piece || '·'}<small>{arrangement[index]?.color || 'Empty'}</small></button>)}</div></div></div>
    <button type="button" disabled={disabled} onClick={() => { onChange({ arrangement: Array(25).fill(null) }); setSelected(null); }}>Clear officers</button>
  </>;
}
function Deepfake({ config, answer, onChange }) {
  const update = patch => onChange({ ...answer, ...patch });
  return <><p>{config.case_text}</p><Rules rules={config.rules} /><div className="answer-grid">{config.videos.map(video => <article className="dossier-card" key={video.id}><h3>Video {video.id}</h3><p>1. {video.claim1}</p><p>2. {video.claim2}</p></article>)}</div><h3>Evidence</h3><Rules rules={config.evidence} /><div className="dossier-card"><strong>AI fact-check</strong><p>{config.ai_fact_check.statement}</p><p>{config.ai_fact_check.note}</p></div>
    <label className="form-group"><span className="form-label">Which video is the deepfake?</span><select className="form-control" value={answer.deepfake || ''} onChange={e => update({ deepfake: e.target.value })}><option value="">Choose…</option>{['A', 'B', 'C', 'D', 'E'].map(video => <option key={video}>{video}</option>)}</select></label>
    <OrderInput label="Upload order (earliest to latest)" options={['A', 'B', 'C', 'D', 'E']} value={answer.upload_order} onChange={upload_order => update({ upload_order })} /></>;
}
function Cryptarithm({ config, answer, onChange }) {
  const update = patch => onChange({ ...answer, ...patch });
  const encode = word => [...word].map(letter => /^\d$/.test(String(answer.mapping?.[letter] ?? '')) ? answer.mapping[letter] : '·').join('');
  return <><p>{config.description}</p><div className="equations mono">{config.equations.map(eq => <div key={eq}><strong>{eq}</strong><div>{eq.split(' ').map(token => /^[A-Z]+$/.test(token) ? encode(token) : token).join(' ')}</div></div>)}</div><Rules rules={config.instructions} />
    <div className="mapping-grid">{config.letters.map(letter => <Field key={letter} label={`Digit for ${letter}`} numeric maxLength={1} value={answer.mapping?.[letter]} onChange={value => { if (/^\d?$/.test(value)) update({ mapping: { ...answer.mapping, [letter]: value } }); }} />)}</div>
    <div className="answer-grid"><Field label="SAREE value" numeric value={answer.saree_value} onChange={saree_value => update({ saree_value })} /><Field label="SAREE ÷ 6" numeric value={answer.quotient_value} onChange={quotient_value => update({ quotient_value })} /><Field label="Decoded word" maxLength={5} value={answer.final_word} onChange={final_word => update({ final_word: final_word.toUpperCase() })} /></div>
    <h3>Hints</h3>{config.hints.map(hint => <details className="dossier-card" key={hint.id}><summary>{hint.title}</summary><p>{hint.text}</p></details>)}</>;
}
export default function Challenge({ config, puzzle, answer, onChange, disabled }) {
  return <section><div className="tr2-hero-header"><h2>{config.title}</h2><p>{config.subtitle}</p></div>
    {config.type === 'hashi' ? <><p>{config.description}</p><Rules rules={['Connect neighboring islands horizontally or vertically.', 'Every island must have exactly its required number of bridges.', 'Use one or two bridges per pair. No crossings or bridges through islands.', 'All islands must belong to one connected network.']} /><HashiBoard puzzle={puzzle} answer={answer} onChange={onChange} disabled={disabled} /></> :
      <fieldset disabled={disabled} className="challenge-fields">{config.type === 'pig_fortress' ? <PigFortress config={config} answer={answer} onChange={onChange} /> : config.type === 'officers' ? <Officers config={config} answer={answer} onChange={onChange} disabled={disabled} /> : config.type === 'deepfake' ? <Deepfake config={config} answer={answer} onChange={onChange} /> : <Cryptarithm config={config} answer={answer} onChange={onChange} />}</fieldset>}
  </section>;
}
