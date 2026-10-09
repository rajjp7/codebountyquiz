const fs = require('fs');
const path = require('path');

// Import the validator logic directly from server.js
const serverContent = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

// Test each puzzle against its own solutionEdges using server.js validateHashiSolution logic
const puzzles = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'puzzles.json'), 'utf8'));

// We can evaluate validateHashiSolution by running a check
function validate(puzzle, bridges) {
  const islands = puzzle.islands;
  const islandMap = new Map();
  islands.forEach(isl => islandMap.set(isl.id, isl));

  const degrees = new Map();
  islands.forEach(isl => degrees.set(isl.id, 0));

  const cleanBridges = [];

  for (const b of bridges) {
    if (!b || b.count <= 0) continue;
    const u = Math.min(b.u, b.v);
    const v = Math.max(b.u, b.v);
    const uIsl = islandMap.get(u);
    const vIsl = islandMap.get(v);

    if (!uIsl || !vIsl) {
      return { valid: false, reason: `Invalid island ID reference: ${u} or ${v}` };
    }

    // Must be orthogonal
    const isHorizontal = uIsl.r === vIsl.r;
    const isVertical = uIsl.c === vIsl.c;
    if (!isHorizontal && !isVertical) {
      return { valid: false, reason: `Bridge between ${u} and ${v} is not orthogonal` };
    }

    // Must have no intervening island
    for (const other of islands) {
      if (other.id === u || other.id === v) continue;
      if (isHorizontal && other.r === uIsl.r) {
        if (other.c > Math.min(uIsl.c, vIsl.c) && other.c < Math.max(uIsl.c, vIsl.c)) {
          return { valid: false, reason: `Bridge crosses through island ${other.id}` };
        }
      }
      if (isVertical && other.c === uIsl.c) {
        if (other.r > Math.min(uIsl.r, vIsl.r) && other.r < Math.max(uIsl.r, vIsl.r)) {
          return { valid: false, reason: `Bridge crosses through island ${other.id}` };
        }
      }
    }

    // Bridge count max 2
    if (b.count > 2 || b.count < 1) {
      return { valid: false, reason: `Invalid bridge count: ${b.count}` };
    }

    cleanBridges.push({ u, v, count: b.count, uIsl, vIsl, isHorizontal });
    degrees.set(u, degrees.get(u) + b.count);
    degrees.set(v, degrees.get(v) + b.count);
  }

  // Check crossing bridges
  for (let i = 0; i < cleanBridges.length; i++) {
    for (let j = i + 1; j < cleanBridges.length; j++) {
      const b1 = cleanBridges[i];
      const b2 = cleanBridges[j];
      if (b1.isHorizontal && !b2.isHorizontal) {
        const minC1 = Math.min(b1.uIsl.c, b1.vIsl.c), maxC1 = Math.max(b1.uIsl.c, b1.vIsl.c);
        const minR2 = Math.min(b2.uIsl.r, b2.vIsl.r), maxR2 = Math.max(b2.uIsl.r, b2.vIsl.r);
        if (minC1 < b2.uIsl.c && b2.uIsl.c < maxC1 && minR2 < b1.uIsl.r && b1.uIsl.r < maxR2) {
          return { valid: false, reason: `Bridges cross each other` };
        }
      } else if (!b1.isHorizontal && b2.isHorizontal) {
        const minR1 = Math.min(b1.uIsl.r, b1.vIsl.r), maxR1 = Math.max(b1.uIsl.r, b1.vIsl.r);
        const minC2 = Math.min(b2.uIsl.c, b2.vIsl.c), maxC2 = Math.max(b2.uIsl.c, b2.vIsl.c);
        if (minR1 < b2.uIsl.r && b2.uIsl.r < maxR1 && minC2 < b1.uIsl.c && b1.uIsl.c < maxC2) {
          return { valid: false, reason: `Bridges cross each other` };
        }
      }
    }
  }

  // Degree check
  for (const isl of islands) {
    const curDeg = degrees.get(isl.id);
    if (curDeg !== isl.number) {
      return {
        valid: false,
        reason: `Island ${isl.id} has ${curDeg} bridges, but needs ${isl.number}`
      };
    }
  }

  // Connectivity check
  const visited = new Set();
  const adj = new Map();
  islands.forEach(isl => adj.set(isl.id, []));

  for (const b of cleanBridges) {
    adj.get(b.u).push(b.v);
    adj.get(b.v).push(b.u);
  }

  const start = islands[0].id;
  const queue = [start];
  visited.add(start);

  while (queue.length > 0) {
    const cur = queue.shift();
    for (const nxt of adj.get(cur)) {
      if (!visited.has(nxt)) {
        visited.add(nxt);
        queue.push(nxt);
      }
    }
  }

  if (visited.size !== islands.length) {
    return { valid: false, reason: `Graph is disconnected. Visited ${visited.size} of ${islands.length}` };
  }

  return { valid: true };
}

console.log('Testing all puzzles with server validation function:');
for (const p of puzzles) {
  const res = validate(p, p.solutionEdges);
  console.log(`[${p.id}] ${p.name}: ${res.valid ? '✅ VALID' : '❌ INVALID: ' + res.reason}`);
}
