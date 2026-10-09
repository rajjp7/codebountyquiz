const fs = require('fs');

function validateHashi(puzzle, bridges) {
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
    if (!uIsl || !vIsl) return { valid: false, reason: 'Invalid island' };

    const isHorizontal = uIsl.r === vIsl.r;
    const isVertical = uIsl.c === vIsl.c;
    if (!isHorizontal && !isVertical) return { valid: false, reason: 'Not orthogonal' };

    for (const other of islands) {
      if (other.id === u || other.id === v) continue;
      if (isHorizontal && other.r === uIsl.r) {
        if (other.c > Math.min(uIsl.c, vIsl.c) && other.c < Math.max(uIsl.c, vIsl.c)) {
          return { valid: false, reason: 'Crosses island' };
        }
      }
      if (isVertical && other.c === uIsl.c) {
        if (other.r > Math.min(uIsl.r, vIsl.r) && other.r < Math.max(uIsl.r, vIsl.r)) {
          return { valid: false, reason: 'Crosses island' };
        }
      }
    }
    cleanBridges.push({ u, v, count: b.count, uIsl, vIsl, isHorizontal });
    degrees.set(u, degrees.get(u) + b.count);
    degrees.set(v, degrees.get(v) + b.count);
  }

  for (let i = 0; i < cleanBridges.length; i++) {
    for (let j = i + 1; j < cleanBridges.length; j++) {
      const b1 = cleanBridges[i];
      const b2 = cleanBridges[j];
      if (b1.isHorizontal && !b2.isHorizontal) {
        const minC1 = Math.min(b1.uIsl.c, b1.vIsl.c), maxC1 = Math.max(b1.uIsl.c, b1.vIsl.c);
        const minR2 = Math.min(b2.uIsl.r, b2.vIsl.r), maxR2 = Math.max(b2.uIsl.r, b2.vIsl.r);
        if (minC1 < b2.uIsl.c && b2.uIsl.c < maxC1 && minR2 < b1.uIsl.r && b1.uIsl.r < maxR2) {
          return { valid: false, reason: 'Bridges cross' };
        }
      } else if (!b1.isHorizontal && b2.isHorizontal) {
        const minR1 = Math.min(b1.uIsl.r, b1.vIsl.r), maxR1 = Math.max(b1.uIsl.r, b1.vIsl.r);
        const minC2 = Math.min(b2.uIsl.c, b2.vIsl.c), maxC2 = Math.max(b2.uIsl.c, b2.vIsl.c);
        if (minR1 < b2.uIsl.r && b2.uIsl.r < maxR1 && minC2 < b1.uIsl.c && b1.uIsl.c < maxC2) {
          return { valid: false, reason: 'Bridges cross' };
        }
      }
    }
  }

  for (const isl of islands) {
    if (degrees.get(isl.id) !== isl.number) {
      return { valid: false, reason: `Degree mismatch at ${isl.id}: ${degrees.get(isl.id)} vs ${isl.number}` };
    }
  }

  const visited = new Set();
  const adj = new Map();
  islands.forEach(isl => adj.set(isl.id, []));
  for (const b of cleanBridges) {
    adj.get(b.u).push(b.v);
    adj.get(b.v).push(b.u);
  }
  const queue = [islands[0].id];
  visited.add(islands[0].id);
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
    return { valid: false, reason: 'Not single connected network' };
  }

  return { valid: true };
}

const isl = [
  { id: 0, r: 0, c: 0, number: 4 },
  { id: 1, r: 0, c: 2, number: 2 },
  { id: 2, r: 0, c: 4, number: 2 },
  { id: 3, r: 0, c: 6, number: 1 },
  { id: 4, r: 0, c: 9, number: 2 },
  { id: 5, r: 2, c: 1, number: 4 },
  { id: 6, r: 2, c: 4, number: 4 },
  { id: 7, r: 2, c: 9, number: 5 },
  { id: 8, r: 3, c: 2, number: 2 },
  { id: 9, r: 3, c: 5, number: 6 },
  { id: 10, r: 3, c: 8, number: 4 },
  { id: 11, r: 4, c: 1, number: 3 },
  { id: 12, r: 4, c: 4, number: 1 },
  { id: 13, r: 5, c: 6, number: 2 },
  { id: 14, r: 5, c: 8, number: 4 },
  { id: 15, r: 6, c: 0, number: 4 },
  { id: 16, r: 6, c: 2, number: 3 },
  { id: 17, r: 6, c: 5, number: 6 },
  { id: 18, r: 6, c: 9, number: 5 },
  { id: 19, r: 8, c: 1, number: 1 },
  { id: 20, r: 8, c: 4, number: 3 },
  { id: 21, r: 8, c: 9, number: 3 },
  { id: 22, r: 9, c: 0, number: 2 },
  { id: 23, r: 9, c: 8, number: 1 }
];

const sol = [
  { u: 0, v: 1, count: 2 },
  { u: 0, v: 15, count: 2 },
  { u: 2, v: 3, count: 1 },
  { u: 2, v: 6, count: 1 },
  { u: 4, v: 7, count: 2 },
  { u: 5, v: 6, count: 2 },
  { u: 5, v: 11, count: 2 },
  { u: 6, v: 7, count: 1 },
  { u: 7, v: 18, count: 2 },
  { u: 8, v: 9, count: 2 },
  { u: 9, v: 10, count: 2 },
  { u: 9, v: 17, count: 2 },
  { u: 10, v: 14, count: 2 },
  { u: 11, v: 12, count: 1 },
  { u: 13, v: 14, count: 2 },
  { u: 15, v: 16, count: 1 },
  { u: 15, v: 22, count: 1 },
  { u: 16, v: 17, count: 2 },
  { u: 17, v: 18, count: 2 },
  { u: 18, v: 21, count: 1 },
  { u: 19, v: 20, count: 1 },
  { u: 20, v: 21, count: 2 },
  { u: 22, v: 23, count: 1 }
];

const res = validateHashi({ islands: isl }, sol);
console.log('Validation result for Track 1 Q1:', res);
