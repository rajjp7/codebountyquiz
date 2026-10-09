const fs = require('fs');
const path = require('path');

/**
 * Robust Hashiwokakero (Bridges) Puzzle Generator
 * 
 * Rules guaranteed:
 * 1. Islands are placed with proper spacing (distance >= 2 in rows/cols).
 * 2. Bridges strictly connect direct orthogonal line-of-sight neighbors.
 * 3. Intermediate cells along any bridge are strictly reserved; no island or intersecting bridge can ever cross.
 * 4. Island target number strictly equals the sum of connected solution bridges.
 * 5. Island target number CANNOT exceed 2 * (number of visible line-of-sight neighbors).
 * 6. Puzzle solution forms a single connected component (Eulerian/Spanning graph).
 * 7. All numbers are between 1 and 8.
 */

function generateValidHashi(width, height, targetIslands, maxTries = 3000) {
  const dirs = [
    { dr: -1, dc: 0, type: -3 }, // Up (Vertical)
    { dr: 1, dc: 0, type: -3 },  // Down (Vertical)
    { dr: 0, dc: -1, type: -2 }, // Left (Horizontal)
    { dr: 0, dc: 1, type: -2 }   // Right (Horizontal)
  ];

  for (let trial = 0; trial < maxTries; trial++) {
    // Grid: -1 = Empty, -2 = Bridge Horizontal, -3 = Bridge Vertical, >= 0 = Island ID
    const grid = Array.from({ length: height }, () => Array(width).fill(-1));
    const islands = [];
    const edges = []; // { u, v, count }

    // Start with 1 island near the center
    const startR = 1 + Math.floor(Math.random() * (height - 2));
    const startC = 1 + Math.floor(Math.random() * (width - 2));
    grid[startR][startC] = 0;
    islands.push({ id: 0, r: startR, c: startC, number: 0 });

    let growthAttempts = 0;
    while (islands.length < targetIslands && growthAttempts < 600) {
      growthAttempts++;
      const uIdx = Math.floor(Math.random() * islands.length);
      const u = islands[uIdx];
      const dir = dirs[Math.floor(Math.random() * dirs.length)];
      
      // Step distance between 2 and max 4 cells
      const maxDist = Math.min(4, Math.max(2, Math.floor(Math.max(width, height) / 2.5)));
      const dist = 2 + Math.floor(Math.random() * (maxDist - 1));
      const nr = u.r + dir.dr * dist;
      const nc = u.c + dir.dc * dist;

      if (nr < 0 || nr >= height || nc < 0 || nc >= width) continue;

      // Ensure intermediate cells are 100% empty
      let corridorClear = true;
      let cr = u.r + dir.dr;
      let cc = u.c + dir.dc;
      while (cr !== nr || cc !== nc) {
        if (grid[cr][cc] !== -1) {
          corridorClear = false;
          break;
        }
        cr += dir.dr;
        cc += dir.dc;
      }
      if (!corridorClear) continue;

      let vIdx;
      if (grid[nr][nc] === -1) {
        // Place new island. Ensure spacing from existing islands (no 8-neighbor touching)
        let tooClose = false;
        for (const isl of islands) {
          if (Math.abs(isl.r - nr) <= 1 && Math.abs(isl.c - nc) <= 1) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) continue;

        vIdx = islands.length;
        grid[nr][nc] = vIdx;
        islands.push({ id: vIdx, r: nr, c: nc, number: 0 });
      } else if (grid[nr][nc] >= 0) {
        // Connect to existing island
        vIdx = grid[nr][nc];
        if (vIdx === uIdx) continue;
        const alreadyConnected = edges.some(e => 
          (e.u === uIdx && e.v === vIdx) || (e.u === vIdx && e.v === uIdx)
        );
        if (alreadyConnected) continue;
      } else {
        // Target cell is already occupied by another bridge line
        continue;
      }

      // Mark the corridor cells as occupied by this bridge line
      cr = u.r + dir.dr;
      cc = u.c + dir.dc;
      while (cr !== nr || cc !== nc) {
        grid[cr][cc] = dir.type;
        cr += dir.dr;
        cc += dir.dc;
      }

      // 1 or 2 bridges
      const count = Math.random() < 0.35 ? 2 : 1;
      edges.push({ u: uIdx, v: vIdx, count });
    }

    // Attempt to add a few non-crossing cross-edges between existing islands to make graph rich
    if (islands.length >= targetIslands - 2) {
      for (let i = 0; i < islands.length; i++) {
        for (let j = i + 1; j < islands.length; j++) {
          if (Math.random() > 0.25) continue;
          const u = islands[i];
          const v = islands[j];
          if (u.r !== v.r && u.c !== v.c) continue; // Must be orthogonal

          const alreadyConnected = edges.some(e => 
            (e.u === u.id && e.v === v.id) || (e.u === v.id && e.v === u.id)
          );
          if (alreadyConnected) continue;

          const dr = Math.sign(v.r - u.r);
          const dc = Math.sign(v.c - u.c);
          let clear = true;
          let cr = u.r + dr;
          let cc = u.c + dc;
          while (cr !== v.r || cc !== v.c) {
            if (grid[cr][cc] !== -1) {
              clear = false;
              break;
            }
            cr += dr;
            cc += dc;
          }

          if (clear) {
            // Reserve corridor
            cr = u.r + dr;
            cc = u.c + dc;
            while (cr !== v.r || cc !== v.c) {
              grid[cr][cc] = dr !== 0 ? -3 : -2;
              cr += dr;
              cc += dc;
            }
            const count = Math.random() < 0.3 ? 2 : 1;
            edges.push({ u: u.id, v: v.id, count });
          }
        }
      }
    }

    if (islands.length < targetIslands - 2) continue;

    // --- STRICT VERIFICATION PASS ---
    // 1. Calculate actual Line of Sight (LOS) neighbors in the final board layout
    const los = new Map();
    for (const u of islands) {
      let rRight = null, rDown = null, rLeft = null, rUp = null;
      for (const v of islands) {
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
      los.set(u.id, [rRight, rDown, rLeft, rUp].filter(Boolean));
    }

    // 2. Verify all edges connect only immediate LOS neighbors
    let allEdgesValidLOS = true;
    for (const e of edges) {
      const uNeighs = los.get(e.u) || [];
      if (!uNeighs.some(n => n.id === e.v)) {
        allEdgesValidLOS = false;
        break;
      }
    }
    if (!allEdgesValidLOS) continue;

    // 3. Compute island degrees
    const degrees = new Map();
    islands.forEach(isl => degrees.set(isl.id, 0));
    for (const e of edges) {
      degrees.set(e.u, degrees.get(e.u) + e.count);
      degrees.set(e.v, degrees.get(e.v) + e.count);
    }

    // 4. Check island capacities and degree bounds
    let capacitiesValid = true;
    for (const isl of islands) {
      isl.number = degrees.get(isl.id);
      const visibleNeighCount = los.get(isl.id).length;
      const maxPossibleCapacity = visibleNeighCount * 2;
      
      // Target number must be > 0, <= 8, and NEVER exceed maxPossibleCapacity
      if (isl.number < 1 || isl.number > 8 || isl.number > maxPossibleCapacity) {
        capacitiesValid = false;
        break;
      }
    }
    if (!capacitiesValid) continue;

    // 5. Connectivity verification (BFS - single connected component)
    const adj = new Map();
    islands.forEach(isl => adj.set(isl.id, []));
    for (const e of edges) {
      adj.get(e.u).push(e.v);
      adj.get(e.v).push(e.u);
    }

    const visited = new Set();
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

    if (visited.size !== islands.length) continue;

    // 6. Normalization: Sort islands top-to-bottom, left-to-right with clean IDs 0..N-1
    islands.sort((a, b) => a.r === b.r ? a.c - b.c : a.r - b.r);
    const oldToNew = new Map();
    islands.forEach((isl, newId) => {
      oldToNew.set(isl.id, newId);
      isl.id = newId;
    });

    const normalizedEdges = edges.map(e => ({
      u: Math.min(oldToNew.get(e.u), oldToNew.get(e.v)),
      v: Math.max(oldToNew.get(e.u), oldToNew.get(e.v)),
      count: e.count
    }));

    // Deduplicate any accidental duplicate edges if any
    const edgeMap = new Map();
    for (const e of normalizedEdges) {
      const key = `${e.u}-${e.v}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, e);
      } else {
        edgeMap.get(key).count = Math.min(2, edgeMap.get(key).count + e.count);
      }
    }

    const finalEdges = Array.from(edgeMap.values());

    return {
      width,
      height,
      islands,
      solutionEdges: finalEdges
    };
  }

  return null;
}

// Generate puzzle presets
const presets = [
  { id: 'puzzle-7x7-easy', name: '7x7 Classic Warmup', width: 7, height: 7, islandsCount: 8, difficulty: 'Easy' },
  { id: 'puzzle-7x7-medium', name: '7x7 Speed Challenge', width: 7, height: 7, islandsCount: 10, difficulty: 'Medium' },
  { id: 'puzzle-9x9-standard', name: '9x9 Standard Tournament', width: 9, height: 9, islandsCount: 14, difficulty: 'Normal' },
  { id: 'puzzle-10x10-pro', name: '10x10 Championship', width: 10, height: 10, islandsCount: 18, difficulty: 'Hard' },
  { id: 'puzzle-12x12-grand', name: '12x12 Grand Master', width: 12, height: 12, islandsCount: 24, difficulty: 'Master' }
];

const results = [];
for (const p of presets) {
  console.log(`Generating [${p.id}] ${p.name}...`);
  const generated = generateValidHashi(p.width, p.height, p.islandsCount);
  if (generated) {
    results.push({
      id: p.id,
      name: p.name,
      difficulty: p.difficulty,
      width: generated.width,
      height: generated.height,
      islands: generated.islands,
      solutionEdges: generated.solutionEdges
    });
    console.log(`✓ Successfully generated ${p.name} with ${generated.islands.length} islands & ${generated.solutionEdges.length} solution edges.`);
  } else {
    console.error(`❌ Failed to generate ${p.name}`);
  }
}

if (results.length === presets.length) {
  const outputPath = path.join(__dirname, '..', 'data', 'puzzles.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n🎉 Successfully saved all ${results.length} verified puzzles to ${outputPath}`);
} else {
  console.error(`\n⚠️ Generation incomplete: only ${results.length}/${presets.length} generated.`);
}
