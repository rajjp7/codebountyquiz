import React, { useEffect, useState } from 'react';
export default function Powerups({ attempt, powerups, pending, onConfirm }) {
  const [selected, setSelected] = useState(attempt.powerups_selected || []);
  useEffect(() => { if (attempt.powerups_confirmed) setSelected(attempt.powerups_selected); }, [attempt.powerups_confirmed, attempt.powerups_selected]);
  const locked = attempt.powerups_confirmed;
  const ended = attempt.status !== 'IN_PROGRESS';
  const pool = attempt.unlocked_powerups || [];
  const required = Math.min(2, pool.length);
  return <section><h2>Round 3 Power-Ups</h2><p>{attempt.questions_solved}/3 challenges accepted • {pool.length}/5 power-ups earned</p><p>Q1 unlocks Time Cracker and Topic Finder. Q2 unlocks Penalty Sweeper and Jumper Points. Q3 unlocks Sweet Sabotage.</p>
    {!ended && <p className="feedback">Finish the round before confirming your choices. You can review your earned pool now.</p>}
    {ended && !required && <p className="feedback">No power-ups earned. Only fully accepted challenges unlock rewards.</p>}
    <div className="answer-grid">{powerups.map(powerup => { const earned = pool.includes(powerup.id); return <label key={powerup.id} className={`dossier-card powerup-option ${earned ? '' : 'unearned'}`}><input type="checkbox" checked={selected.includes(powerup.id)} disabled={pending || locked || !ended || !earned || (!selected.includes(powerup.id) && selected.length >= required)} onChange={() => setSelected(list => list.includes(powerup.id) ? list.filter(id => id !== powerup.id) : [...list, powerup.id])} /><strong>{powerup.name}</strong><p>{powerup.description || powerup.effect}</p><span>{earned ? 'Unlocked' : 'Locked'}</span></label>; })}</div>
    {locked ? <p className="feedback success">Your two choices are confirmed and permanently locked for Round 3.</p> : <button className="btn-primary" disabled={pending || !ended || required === 0 || selected.length !== required} onClick={() => { if (window.confirm('Permanently lock these power-up choices for Round 3?')) onConfirm(selected); }}>Confirm {selected.length}/{required} power-ups</button>}
  </section>;
}
