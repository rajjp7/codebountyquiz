import React, { useRef, useState } from 'react';
import { api } from '../api';
import { Field } from './Challenges';

export default function Auth({ onSession }) {
  const [role, setRole] = useState('contestant');
  const [form, setForm] = useState({ student_name: '', college: '', lab: 'Lab 1', track: 'track1', password: '' });
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  const busy = useRef(false);
  const change = (key, value) => setForm(f => ({ ...f, [key]: value }));
  async function submit(event) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true; setPending(true); setError('');
    try {
      const data = await api(role === 'admin' ? '/api/admin/login' : '/api/round2/start', { body: role === 'admin' ? { password: form.password } : { student_name: form.student_name.trim(), college: form.college.trim(), track: form.track, lab: form.lab } });
      onSession({ role, token: data.token, attempt_id: data.attempt_id });
    } catch (err) { setError(err.message); }
    finally { busy.current = false; setPending(false); }
  }
  return <main className="auth-page"><div className="auth-card"><div className="auth-role-tabs">{['contestant', 'admin'].map(option => <button key={option} className={`auth-role-tab ${role === option ? 'active' : ''}`} disabled={pending} onClick={() => { setRole(option); setError(''); }}>{option === 'admin' ? 'Administrator' : 'Contestant Access'}</button>)}</div>
    <form onSubmit={submit}><fieldset disabled={pending}><h1>{role === 'admin' ? 'Administrator sign in' : 'Enter the challenge'}</h1>{role === 'admin' ? <Field label="Admin password" type="password" autoComplete="current-password" required value={form.password} onChange={value => change('password', value)} /> : <>
      <p>Choose your track carefully. Your choice is locked when the 30-minute round starts.</p>
      <Field label="Contestant / Team Name" autoComplete="name" required maxLength={120} value={form.student_name} onChange={value => change('student_name', value)} />
      <Field label="College / Institute" autoComplete="organization" required maxLength={160} value={form.college} onChange={value => change('college', value)} />
      <label className="form-group"><span className="form-label">Lab Assigned</span><select className="form-control" value={form.lab} onChange={e => change('lab', e.target.value)}>{['Lab 1', 'Lab 2', 'Lab 3', 'Lab 4'].map(lab => <option key={lab}>{lab}</option>)}</select></label>
      {['track1', 'track2'].map(track => <label key={track} className={`track-select-card ${form.track === track ? 'active' : ''}`}><input type="radio" name="track" value={track} checked={form.track === track} onChange={() => change('track', track)} /><strong>{track === 'track1' ? 'Track 1: First Years' : 'Track 2: All Other Years'}</strong><p>{track === 'track1' ? 'Hashi • Pig Fortress • 25 Officers' : 'Hashi Hard • Deepfake • Zero to Crore'}</p></label>)}
    </>}{error && <p role="alert" className="feedback error">{error}</p>}<button className="btn-primary" type="submit">{pending ? 'Connecting…' : role === 'admin' ? 'Sign In as Admin' : 'Confirm Track & Start Round'}</button></fieldset></form>
  </div></main>;
}
