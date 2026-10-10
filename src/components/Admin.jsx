import React, { useEffect, useState } from 'react';
import { api } from '../api';
import Challenge, { Field } from './Challenges';

export default function Admin({ session, onExit }) {
  const [tab, setTab] = useState('admin'), [track, setTrack] = useState('all'), [lab, setLab] = useState('all'), [search, setSearch] = useState(''), [status, setStatus] = useState('all'), [batch, setBatch] = useState('all'), [sort, setSort] = useState('score');
  const [records, setRecords] = useState([]), [summary, setSummary] = useState(null), [room, setRoom] = useState(null), [puzzles, setPuzzles] = useState([]), [config, setConfig] = useState(null);
  const [previewTrack, setPreviewTrack] = useState('track1'), [stage, setStage] = useState(1), [drafts, setDrafts] = useState({});
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [pending, setPending] = useState(false), [refresh, setRefresh] = useState(0);
  const filters = new URLSearchParams({ track, lab, batch, status, search, sort, order: sort === 'score' ? 'desc' : 'asc' }).toString();
  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    const load = async () => {
      if (running) return;
      running = true;
      try {
        const route = tab === 'admin' ? '/api/admin/powerups' : tab === 'leaderboard' ? '/api/leaderboard' : '/api/dataset';
        const data = await api(`${route}?${filters}`, { token: session.token, signal: controller.signal });
        if (!controller.signal.aborted) { setRecords(data.records || data.leaderboard || []); setSummary(data.summary || data.stats || { total: data.total_participants, completed: data.completed_count }); setError(''); }
      } catch (err) { if (err.name !== 'AbortError') setError(err.message); }
      finally { running = false; }
    };
    if (['admin', 'leaderboard', 'dataset'].includes(tab)) load();
    const interval = setInterval(() => { if (['admin', 'leaderboard', 'dataset'].includes(tab)) load(); }, 10000);
    return () => { controller.abort(); clearInterval(interval); };
  }, [tab, filters, session.token, refresh]);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([api('/api/room', { signal: controller.signal }), api('/api/puzzles', { signal: controller.signal })]).then(([settings, available]) => { setRoom(settings); setPuzzles(available); }).catch(err => { if (err.name !== 'AbortError') setError(err.message); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController(); setConfig(null); setStage(1); setDrafts({});
    api(`/api/${previewTrack}/info`, { signal: controller.signal }).then(setConfig).catch(err => { if (err.name !== 'AbortError') setError(err.message); });
    return () => controller.abort();
  }, [previewTrack]);
  async function download(type) {
    setError(''); setPending(true);
    try {
      const path = type === 'excel' ? '/api/admin/export/excel' : `/api/dataset/export/${type}`;
      const response = await fetch(`${path}?${filters}`, { headers: { Authorization: `Bearer ${session.token}` } });
      if (!response.ok) throw new Error('Export failed. Sign in again if your admin session expired.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = `hashi-${tab}.${type === 'excel' ? 'xls' : type}`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setError(err.message); } finally { setPending(false); }
  }
  async function mutate(path, body, method) {
    setPending(true); setError(''); setNotice('');
    try { await api(path, { token: session.token, body, method }); setNotice('Saved successfully.'); setRefresh(n => n + 1); }
    catch (err) { setError(err.message); } finally { setPending(false); }
  }
  const visible = records.filter(record => (lab === 'all' || record.lab === lab) && (!search || `${record.student_name} ${record.student_id} ${record.college}`.toLowerCase().includes(search.toLowerCase())) && (status === 'all' || record.status === status));
  return <><header className="navbar"><strong className="brand-name">HASHI</strong><nav className="nav-tabs">{['admin', 'challenges', 'leaderboard', 'dataset', 'rules'].map(name => <button key={name} className={`tab-btn ${tab === name ? 'active' : ''}`} onClick={() => { setTab(name); setNotice(''); }}>{name[0].toUpperCase() + name.slice(1)}</button>)}</nav><button onClick={onExit}>Logout</button></header>
    <main className="main-wrapper react-main"><h1>Administrator</h1>{error && <p role="alert" className="feedback error">{error}</p>}{notice && <p role="status" className="feedback success">{notice}</p>}
      {tab === 'rules' ? <section><h2>Competition rules</h2><ul className="challenge-rules"><li>Each track contains three sequential challenges in a 30-minute round.</li><li>Every component of a solution must be correct. Partial answers earn no acceptance or points.</li><li>Accepted answers are locked. Only the server can unlock the next challenge.</li><li>Two, four, and five power-ups are earned for one, two, and three accepted challenges.</li><li>Choose exactly two earned power-ups after ending the round. Confirmed choices are permanent.</li><li>A finished or expired round cannot accept more answers.</li></ul></section> : tab === 'challenges' ? <section><h2>Challenge preview</h2><p>This preview does not create competition results or award power-ups.</p><div className="toolbar-segmented"><select aria-label="Preview track" value={previewTrack} onChange={e => setPreviewTrack(e.target.value)}><option value="track1">FY Track</option><option value="track2">Track 2</option></select>{[1, 2, 3].map(n => <button key={n} onClick={() => setStage(n)}>Stage {n}</button>)}</div>{config && <Challenge key={`${previewTrack}-${stage}`} config={config.stages[stage - 1]} puzzle={config.puzzle || config.puzzle10x10} answer={drafts[stage] || {}} disabled={false} onChange={answer => setDrafts(d => ({ ...d, [stage]: answer }))} />}</section> : <>
        <h2>{tab === 'admin' ? 'Power-up overview' : tab === 'leaderboard' ? 'Live leaderboard' : 'Contestant dataset'}</h2>
        <div className="admin-filters"><Field label="Search contestants" value={search} onChange={setSearch} /><label>Track<select className="form-control" value={track} onChange={e => setTrack(e.target.value)}><option value="all">All tracks</option><option value="track1">FY Track</option><option value="track2">Track 2</option></select></label><label>Lab<select className="form-control" value={lab} onChange={e => setLab(e.target.value)}><option value="all">All labs</option>{['Lab 1', 'Lab 2', 'Lab 3', 'Lab 4'].map(value => <option key={value}>{value}</option>)}</select></label><Field label="Batch (all for every batch)" value={batch} onChange={setBatch} /><label>Status<select className="form-control" value={status} onChange={e => setStatus(e.target.value)}>{['all', 'IN_PROGRESS', 'COMPLETED', 'PARTIAL', 'FAILED', 'EXPIRED'].map(value => <option key={value}>{value}</option>)}</select></label><label>Sort dataset<select className="form-control" value={sort} onChange={e => setSort(e.target.value)}><option value="score">Score</option><option value="duration_seconds">Duration</option><option value="student_name">Name</option></select></label></div>
        {summary && <p>{visible.length} matching records · {tab === 'admin' ? `${summary.confirmed_powerups_count || 0} confirmed power-up selections` : tab === 'dataset' ? `${summary.completed_count || 0} completed · ${summary.completion_rate || 0}% completion rate` : `${summary.completed || 0} completed`}</p>}
        <div className="toolbar-segmented"><button onClick={() => setRefresh(n => n + 1)}>Refresh</button>{['csv', 'json', 'excel'].map(type => <button disabled={pending} key={type} onClick={() => download(type)}>Export {type.toUpperCase()}</button>)}</div>
        <div className="table-scroll"><table><thead><tr>{['Rank', 'Contestant', 'College', 'Track / Lab', 'Status', 'Accepted', 'Score', 'Time', 'Power-up pool', 'Chosen power-ups', 'Confirmed'].map(name => <th key={name}>{name}</th>)}</tr></thead><tbody>{visible.map(record => <tr key={record.id}><td>{record.rank || '—'}</td><td>{record.student_name}<small>{record.student_id}</small></td><td>{record.college || '—'}</td><td>{record.track || 'track1'}<small>{record.lab}</small></td><td>{record.status}</td><td>{record.questions_solved ?? 0}/3</td><td>{record.score || 0}</td><td>{record.formatted_time}</td><td>{(record.unlocked_powerups || []).join(', ') || 'None'}</td><td>{(record.powerups_selected || [record.powerup_1, record.powerup_2].filter(Boolean)).join(', ') || 'None'}</td><td>{record.powerups_confirmed ? 'Yes' : 'No'}</td></tr>)}</tbody></table>{!visible.length && <p>No matching records.</p>}</div>
        {tab === 'admin' && room && <form className="dossier-card" onSubmit={e => { e.preventDefault(); mutate('/api/room', { quiz_title: room.quiz_title, active_puzzle_id: room.active_puzzle_id, time_limit_seconds: Number(room.time_limit_seconds) }); }}><h3>Room settings</h3><p>Round 2 uses its fixed track puzzles and 30-minute limit.</p><fieldset disabled={pending}><Field label="Quiz title" value={room.quiz_title} onChange={quiz_title => setRoom(r => ({ ...r, quiz_title }))} /><label>Default puzzle<select className="form-control" value={room.active_puzzle_id} onChange={e => setRoom(r => ({ ...r, active_puzzle_id: e.target.value }))}>{puzzles.map(puzzle => <option key={puzzle.id} value={puzzle.id}>{puzzle.name}</option>)}</select></label><Field label="Legacy room time limit (seconds)" numeric value={room.time_limit_seconds} onChange={time_limit_seconds => setRoom(r => ({ ...r, time_limit_seconds }))} /><button className="btn-primary" type="submit">Save room settings</button></fieldset></form>}
        {tab === 'dataset' && <div className="dossier-card"><h3>Dataset management</h3><button disabled={pending} onClick={() => { if (window.confirm('Generate demo cohort records in the dataset?')) mutate('/api/dataset/seed', {}); }}>Seed demo cohorts</button><button disabled={pending} onClick={() => { if (window.confirm(`Permanently delete ${batch === 'all' ? 'all' : batch} dataset records? This cannot be undone.`)) mutate(`/api/dataset${batch === 'all' ? '' : `?batch=${encodeURIComponent(batch)}`}`, undefined, 'DELETE'); }}>Clear dataset</button></div>}
      </>}
    </main></>;
}
