import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { api, readStored, removeStored, store } from './api';
import { initialState, roundReducer } from './state';
import Auth from './components/Auth';
import Challenge from './components/Challenges';
import Powerups from './components/Powerups';
import Admin from './components/Admin';

const AUTH_KEY = 'hashi_react_session_v2';
const draftKey = id => `hashi_react_drafts_v2:${id}`;
const hasValue = value => value !== undefined && value !== null && String(value).trim() !== '';
function isAnswerComplete(config, answer) {
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return false;
  if (config.type === 'alphametic') {
    return config.letters.every(letter => hasValue(answer.mapping?.[letter])) &&
      hasValue(answer.saree_value) &&
      hasValue(answer.quotient_value) &&
      hasValue(answer.final_word);
  }
  return true;
}
function Contestant({ session, onExit }) {
  const [state, dispatch] = useReducer(roundReducer, initialState);
  const [config, setConfig] = useState(null), [powerups, setPowerups] = useState([]);
  const [tab, setTab] = useState('challenges'), [loadError, setLoadError] = useState('');
  const [now, setNow] = useState(Date.now()), [offset, setOffset] = useState(0), [reload, setReload] = useState(0);
  const busy = useRef(false), mounted = useRef(true);
  const { attempt, drafts, stage, pending, message } = state;
  const sync = useCallback(data => {
    if (!mounted.current || !data?.attempt) return;
    dispatch({ type: 'SYNC', attempt: data.attempt });
    if (data.server_time) setOffset(data.server_time - Date.now());
  }, []);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    let interval;
    async function load() {
      setLoadError('');
      try {
        const data = await api(`/api/round2/attempt/${session.attempt_id}`, { token: session.token, signal: controller.signal });
        const [info, pool] = await Promise.all([api(`/api/${data.attempt.track}/info`, { signal: controller.signal }), api('/api/powerups', { signal: controller.signal })]);
        if (controller.signal.aborted) return;
        setConfig(info); setPowerups(pool.powerups); setOffset(data.server_time - Date.now());
        dispatch({ type: 'RESTORE', attempt: data.attempt, drafts: readStored(draftKey(session.attempt_id), {}) });
        interval = setInterval(() => { if (!busy.current) api(`/api/round2/attempt/${session.attempt_id}`, { token: session.token, signal: controller.signal }).then(sync).catch(err => { if (err.name !== 'AbortError') setLoadError(err.message); }); }, 10000);
      } catch (err) { if (err.name !== 'AbortError') setLoadError(err.message); }
    }
    load();
    return () => { mounted.current = false; controller.abort(); clearInterval(interval); };
  }, [session.attempt_id, session.token, reload, sync]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(timer); }, []);
  useEffect(() => { if (attempt) store(draftKey(attempt.id), drafts); }, [drafts, attempt?.id]);
  const remaining = attempt ? Math.max(0, Math.ceil((Date.parse(attempt.start_time) + attempt.time_limit_seconds * 1000 - now - offset) / 1000)) : 0;
  useEffect(() => {
    if (attempt && remaining === 0 && attempt.status === 'IN_PROGRESS') {
      api(`/api/round2/attempt/${session.attempt_id}`, { token: session.token }).then(sync).catch(err => setLoadError(err.message));
    }
  }, [remaining === 0, attempt?.status, session.attempt_id, session.token, sync]);
  async function action(path, body, kind) {
    if (busy.current) return;
    busy.current = true; dispatch({ type: 'PENDING' });
    try {
      const data = await api(path, { token: session.token, body: { attempt_id: attempt.id, ...body } });
      if (!mounted.current) return;
      sync(data); setLoadError('');
      dispatch({ type: 'MESSAGE', message: { success: kind === 'verify' ? data.valid === true : true, text: kind === 'verify' ? (data.valid === true ? 'Accepted — every condition passed. This answer is now locked.' : `Not accepted. ${data.reason || 'Check every part of your solution.'}`) : kind === 'powerups' ? 'Power-up choices permanently locked.' : data.allPassed ? 'Round completed — all three challenges accepted.' : 'Round finished. Only previously accepted challenges count.' } });
    } catch (err) {
      if (!mounted.current) return;
      sync(err.data);
      dispatch({ type: 'MESSAGE', message: { success: false, text: err.message } });
      // A lost response may follow a committed write. Reload authority without inventing success.
      try { sync(await api(`/api/round2/attempt/${session.attempt_id}`, { token: session.token })); } catch { /* Keep the error and allow retry. */ }
    } finally { busy.current = false; }
  }
  const ended = attempt?.status !== 'IN_PROGRESS';
  const locked = pending || ended || remaining === 0;
  const answer = attempt?.answers?.[`stage${stage}`] || drafts[`stage${stage}`] || {};
  const currentConfig = config?.stages?.[stage - 1];
  const answerComplete = currentConfig ? isAnswerComplete(currentConfig, answer) : false;
  return <>
    <header className="navbar"><strong className="brand-name">HASHI</strong><nav className="nav-tabs">{['challenges', 'powerups'].map(name => <button key={name} className={`tab-btn ${tab === name ? 'active' : ''}`} disabled={pending} onClick={() => setTab(name)}>{name === 'challenges' ? 'Challenges' : `Power-Ups ${attempt?.pool_size || 0}/5`}</button>)}</nav><div className="nav-actions"><span>{attempt?.student_name} · {attempt?.track === 'track1' ? 'FY Track' : 'Track 2'}</span>{attempt && <span className="mono timer" aria-label="Time remaining">{ended ? attempt.status : `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`}</span>}<button disabled={pending} onClick={onExit}>Exit</button></div></header>
    <main className="main-wrapper react-main">
      {loadError && <div className="feedback error" role="alert">{loadError} <button disabled={pending} onClick={() => setReload(n => n + 1)}>Reconnect</button></div>}
      {!attempt || !config ? <p role="status">{loadError ? 'Reconnect to restore your session.' : 'Loading your challenge…'}</p> : <>
        {(ended || remaining === 0) && <div className={`feedback ${attempt.status === 'COMPLETED' ? 'success' : ''}`} role="status"><strong>{attempt.status === 'COMPLETED' ? 'All three challenges accepted.' : remaining === 0 ? 'Time is up. Answers are locked.' : 'Round finished. Answers are locked.'}</strong> {attempt.questions_solved}/3 accepted · Score {attempt.score}. <button onClick={() => setTab('powerups')}>View power-ups</button></div>}
        {message && <div className={`feedback ${message.success ? 'success' : 'error'}`} role={message.success ? 'status' : 'alert'}>{message.text}</div>}
        {tab === 'powerups' ? <Powerups attempt={attempt} powerups={powerups} pending={pending} onConfirm={selected_powerups => action('/api/round2/select-powerups', { selected_powerups }, 'powerups')} /> : <>
          <div className="tr1-stepper">{[1, 2, 3, 4].map(n => <button key={n} className={`tr1-step-btn ${stage === n ? 'active' : ''}`} disabled={pending || (n < 4 && attempt.stages[`stage${n}`].status === 'LOCKED')} onClick={() => dispatch({ type: 'STAGE', stage: n })}>{n === 4 ? 'Review' : `${n}. ${attempt.stages[`stage${n}`].valid ? '✓ Accepted' : attempt.stages[`stage${n}`].status === 'LOCKED' ? 'Locked' : 'Challenge'}`}</button>)}</div>
          {stage === 4 ? <section><h2>Round review</h2><p>{attempt.questions_solved}/3 challenges accepted. Unverified drafts do not count toward your score or power-ups.</p>{config.stages.map((challenge, index) => <div key={challenge.id} className="dossier-card"><strong>{challenge.title}</strong><p>{attempt.stages[challenge.id].valid === true ? 'Accepted — all conditions passed' : 'Not accepted'}</p><button onClick={() => dispatch({ type: 'STAGE', stage: index + 1 })} disabled={attempt.stages[challenge.id].status === 'LOCKED'}>View challenge</button></div>)}{!ended && <button className="btn-primary" disabled={locked} onClick={() => { if (window.confirm('Finish the round now? Unaccepted answers will not count, and all answers will be locked.')) action('/api/round2/submit', {}, 'finish'); }}>Finish round and lock answers</button>}</section> : <>
            <Challenge key={`${attempt.id}-${stage}`} config={config.stages[stage - 1]} puzzle={config.puzzle || config.puzzle10x10} answer={answer} disabled={locked || attempt.stages[`stage${stage}`].valid === true} onChange={value => dispatch({ type: 'EDIT', stage, answer: value })} />
            <div className="stage-actions-row"><span>{attempt.stages[`stage${stage}`].valid === true ? '✓ Accepted and locked' : answerComplete ? 'Every part must be correct to unlock the next stage.' : 'Fill every field before verifying your solution.'}</span>{attempt.stages[`stage${stage}`].valid === true ? <button className="btn-primary" disabled={pending} onClick={() => dispatch({ type: 'STAGE', stage: stage + 1 })}>Continue →</button> : <button className="btn-primary" disabled={locked || !answerComplete} onClick={() => action('/api/round2/validate-stage', { stage, track: attempt.track, data: answer }, 'verify')}>{pending ? 'Verifying…' : 'Verify complete solution'}</button>}</div>
          </>}
        </>}
      </>}
    </main>
  </>;
}
export default function App() {
  const [session, setSession] = useState(() => { const saved = readStored(AUTH_KEY); return saved?.token && ['admin', 'contestant'].includes(saved.role) ? saved : null; });
  const enter = value => { store(AUTH_KEY, value); setSession(value); };
  const exit = () => { if (session?.role === 'admin') api('/api/admin/logout', { token: session.token, body: {} }).catch(() => {}); removeStored(AUTH_KEY); setSession(null); };
  if (!session) return <Auth onSession={enter} />;
  return session.role === 'admin' ? <Admin session={session} onExit={exit} /> : <Contestant key={session.attempt_id} session={session} onExit={exit} />;
}
