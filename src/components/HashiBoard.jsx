import React, { useRef, useState } from 'react';

const pairKey = (u, v) => [u, v].sort((a, b) => a - b).join(':');
export function legalPair(islands, u, v) {
  const a = islands.find(i => i.id === u), b = islands.find(i => i.id === v);
  if (!a || !b || u === v || (a.r !== b.r && a.c !== b.c)) return false;
  return !islands.some(i => i.id !== u && i.id !== v && (
    (a.r === b.r && i.r === a.r && i.c > Math.min(a.c, b.c) && i.c < Math.max(a.c, b.c)) ||
    (a.c === b.c && i.c === a.c && i.r > Math.min(a.r, b.r) && i.r < Math.max(a.r, b.r))
  ));
}
function crosses(islands, bridge, other) {
  const [a, b, c, d] = [bridge.u, bridge.v, other.u, other.v].map(id => islands.find(i => i.id === id));
  if (!a || !b || !c || !d || [bridge.u, bridge.v].some(id => id === other.u || id === other.v)) return false;
  if ((a.r === b.r) === (c.r === d.r)) return false;
  const [h1, h2, v1, v2] = a.r === b.r ? [a, b, c, d] : [c, d, a, b];
  return v1.c > Math.min(h1.c, h2.c) && v1.c < Math.max(h1.c, h2.c) && h1.r > Math.min(v1.r, v2.r) && h1.r < Math.max(v1.r, v2.r);
}
export default function HashiBoard({ puzzle, answer, onChange, disabled }) {
  const bridges = Array.isArray(answer.bridges) ? answer.bridges : [];
  const [selected, setSelected] = useState(null);
  const [guides, setGuides] = useState(true);
  const [notice, setNotice] = useState('');
  const [past, setPast] = useState([]), [future, setFuture] = useState([]);
  const drag = useRef(null);
  const { islands } = puzzle;
  const degree = id => bridges.reduce((sum, b) => sum + (b.u === id || b.v === id ? b.count : 0), 0);
  const commit = next => {
    if (disabled) return;
    setPast(p => [...p, bridges]); setFuture([]); onChange({ bridges: next }); setNotice('');
  };
  function connect(u, v, remove = false) {
    if (disabled) return;
    if (!legalPair(islands, u, v)) { setNotice('Connect neighboring islands horizontally or vertically, without passing through another island.'); return; }
    const key = pairKey(u, v), existing = bridges.find(b => pairKey(b.u, b.v) === key);
    const count = remove ? Math.max(0, (existing?.count || 0) - 1) : ((existing?.count || 0) + 1) % 3;
    const next = bridges.filter(b => pairKey(b.u, b.v) !== key);
    if (count && next.some(b => crosses(islands, { u, v }, b))) { setNotice('Bridges cannot cross.'); return; }
    if (count) next.push({ u: Math.min(u, v), v: Math.max(u, v), count });
    commit(next); setSelected(null);
  }
  function choose(id) {
    if (disabled) return;
    if (selected === null) setSelected(id);
    else if (selected === id) setSelected(null);
    else connect(selected, id);
  }
  const x = i => 32 + i.c * 48, y = i => 32 + i.r * 48;
  return <div className="board-container-card">
    <div className="board-toolbar">
      <div className="toolbar-segmented">
        <button type="button" disabled={disabled || !past.length} onClick={() => { setFuture(f => [bridges, ...f]); onChange({ bridges: past.at(-1) }); setPast(p => p.slice(0, -1)); setSelected(null); }}>Undo</button>
        <button type="button" disabled={disabled || !future.length} onClick={() => { setPast(p => [...p, bridges]); onChange({ bridges: future[0] }); setFuture(f => f.slice(1)); setSelected(null); }}>Redo</button>
        <button type="button" disabled={disabled || !bridges.length} onClick={() => { commit([]); setSelected(null); }}>Clear</button>
        <button type="button" aria-pressed={guides} onClick={() => setGuides(g => !g)}>Guides</button>
      </div>
      <span className="mono">{islands.filter(i => degree(i.id) === i.number).length}/{islands.length} islands satisfied</span>
    </div>
    <svg className="react-hashi" viewBox={`0 0 ${64 + (puzzle.width - 1) * 48} ${64 + (puzzle.height - 1) * 48}`} aria-label="Hashi bridge board" onPointerUp={() => { drag.current = null; }}>
      {guides && islands.flatMap(a => islands.filter(b => b.id > a.id && legalPair(islands, a.id, b.id)).map(b => <line key={`guide-${a.id}-${b.id}`} x1={x(a)} y1={y(a)} x2={x(b)} y2={y(b)} stroke="var(--border-subtle)" strokeDasharray="3 5" />))}
      {bridges.map(bridge => {
        const a = islands.find(i => i.id === bridge.u), b = islands.find(i => i.id === bridge.v);
        if (!a || !b) return null;
        return <g key={pairKey(bridge.u, bridge.v)} onContextMenu={e => { e.preventDefault(); connect(bridge.u, bridge.v, true); }}>
          <line x1={x(a)} y1={y(a)} x2={x(b)} y2={y(b)} stroke="transparent" strokeWidth="20" />
          {(bridge.count === 2 ? [-3, 3] : [0]).map(offset => <line key={offset} x1={x(a) + (a.c === b.c ? offset : 0)} y1={y(a) + (a.r === b.r ? offset : 0)} x2={x(b) + (a.c === b.c ? offset : 0)} y2={y(b) + (a.r === b.r ? offset : 0)} stroke="var(--text-primary)" strokeWidth="3" pointerEvents="none" />)}
        </g>;
      })}
      {islands.map(i => <g key={i.id} role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled} aria-pressed={selected === i.id} aria-label={`Island ${i.id}, row ${i.r + 1}, column ${i.c + 1}, needs ${i.number}, has ${degree(i.id)}`}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(i.id); } }}
        onPointerDown={e => { if (e.button === 0 && !disabled) { drag.current = i.id; e.currentTarget.releasePointerCapture?.(e.pointerId); } }}
        onPointerUp={e => { e.stopPropagation(); if (e.button !== 0 || disabled) return; const from = drag.current; drag.current = null; if (from !== null && from !== i.id) connect(from, i.id); else choose(i.id); }}
        onContextMenu={e => { e.preventDefault(); if (selected !== null) connect(selected, i.id, true); }}>
        <circle cx={x(i)} cy={y(i)} r="18" fill="var(--bg-surface)" stroke={selected === i.id ? '#facc15' : degree(i.id) > i.number ? '#f87171' : degree(i.id) === i.number ? '#34d399' : 'var(--text-secondary)'} strokeWidth={selected === i.id ? 3 : 2} />
        <text x={x(i)} y={y(i) + 5} textAnchor="middle" fill="var(--text-primary)" fontSize="16" fontWeight="600" pointerEvents="none">{i.number}</text>
      </g>)}
    </svg>
    <p className="board-footer-bar">Click, tap, or drag between islands. Repeat to cycle 1 → 2 → 0 bridges. Right-click a bridge to remove one. Keyboard: Enter selects an island.</p>
    {notice && <p role="status" className="feedback">{notice}</p>}
  </div>;
}
