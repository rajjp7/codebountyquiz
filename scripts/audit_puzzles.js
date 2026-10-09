const fs = require('fs');
const path = require('path');

const puzzlesPath = path.join(__dirname, '..', 'data', 'puzzles.json');
const puzzles = JSON.parse(fs.readFileSync(puzzlesPath, 'utf8'));

let allClean = true;

for (const p of puzzles) {
  console.log(`\nAuditing [${p.id}] "${p.name}" (${p.width}x${p.height}, ${p.islands.length} islands)...`);
  const islandMap = new Map(p.islands.map(i => [i.id, i]));
  
  // Calculate LOS neighbors
  const los = new Map(p.islands.map(i => [i.id, []]));
  for (const u of p.islands) {
    let rRight = null, rDown = null, rLeft = null, rUp = null;
    for (const v of p.islands) {
      if (v.id === u.id) continue;
      if (v.r === u.r) {
        if (v.c > u.c && (!rRight || v.c < rRight.c)) rRight = v;
        if (v.c < u.c && (!rLeft || v.c > rLeft.c)) rLeft = v;
      }
      if (v.c === u.c) {
        if (v.r > u.r && (!rDown || v.r < rDown.r)) rDown = v;
        if (v.r < u.r && (!rUp || v.r > rUp.r)) rUp = v;
      }
    }
    const neighs = [rRight, rDown, rLeft, rUp].filter(Boolean);
    los.set(u.id, neighs.map(n => n.id));
    if (u.number > neighs.length * 2) {
      console.error(`  ❌ IMPOSSIBLE ISLAND: Island #${u.id} at (${u.r},${u.c}) has number ${u.number} but only ${neighs.length} LOS neighbors (max bridge capacity = ${neighs.length * 2})! LOS neighbors:`, neighs.map(n => n.id));
      allClean = false;
    }
  }

  // Check solution edges
  for (const e of p.solutionEdges) {
    const neighs = los.get(e.u) || [];
    if (!neighs.includes(e.v)) {
      console.error(`  ❌ ILLEGAL BRIDGE: Edge between #${e.u} and #${e.v} is NOT a direct LOS neighbor (likely passes through another island or is diagonal)!`);
      allClean = false;
    }
  }

  // Check island degrees match solution
  const degs = new Map(p.islands.map(i => [i.id, 0]));
  for (const e of p.solutionEdges) {
    degs.set(e.u, (degs.get(e.u) || 0) + e.count);
    degs.set(e.v, (degs.get(e.v) || 0) + e.count);
  }
  for (const u of p.islands) {
    if (degs.get(u.id) !== u.number) {
      console.error(`  ❌ DEGREE MISMATCH: Island #${u.id} target is ${u.number}, but solution has ${degs.get(u.id)}!`);
      allClean = false;
    }
  }
}

if (allClean) {
  console.log('\n✅ ALL PUZZLES PASSED AUDIT WITH 0 DEFECTS!');
} else {
  console.log('\n❌ AUDIT FAILED: Flaws detected in current puzzles.');
}
