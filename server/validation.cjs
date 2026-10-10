// Server-only validators. Never accept client completion flags or partial solutions.
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const cleanText = value => typeof value === 'string' ? value.trim() : '';

function strictInteger(value) {
  if (typeof value === 'number') return Number.isSafeInteger(value) ? value : NaN;
  return typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
}

function validateHashiSolution(puzzle, bridges) {
  // puzzle: { islands: [{ id, r, c, number }] }
  // bridges: array of { u, v, count }
  if (!puzzle || !Array.isArray(puzzle.islands) || !puzzle.islands.length || !Array.isArray(bridges)) return { valid: false, score: 0, reason: 'Invalid puzzle or bridge data' };
  const islands = puzzle.islands;
  const islandMap = new Map();
  islands.forEach(isl => islandMap.set(isl.id, isl));

  // Build degree table
  const degrees = new Map();
  islands.forEach(isl => degrees.set(isl.id, 0));

  const cleanBridges = [];

  const pairs = new Set();
  for (const b of bridges) {
    if (!b || !Number.isInteger(b.u) || !Number.isInteger(b.v) || b.u === b.v || !Number.isInteger(b.count) || b.count < 1 || b.count > 2) return { valid: false, score: 0, reason: 'Every bridge needs distinct integer endpoints and a count of 1 or 2' };
    const key = [b.u, b.v].sort((a, b) => a - b).join(':');
    if (pairs.has(key)) return { valid: false, score: 0, reason: 'Duplicate bridge pair' };
    pairs.add(key);
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
        reason: `Island ${isl.id} at (Row ${isl.r + 1}, Col ${isl.c + 1}) [value ${isl.number}] currently has ${curDeg} bridges, but needs ${isl.number}`
      };
    }
  }

  // Connectivity check (Single connected component)
  if (islands.length > 0) {
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
      const neighbors = adj.get(cur) || [];
      for (const nxt of neighbors) {
        if (!visited.has(nxt)) {
          visited.add(nxt);
          queue.push(nxt);
        }
      }
    }

    if (visited.size !== islands.length) {
      return {
        valid: false,
        reason: `All islands must be in a single connected network (Found isolated groups)`
      };
    }
  }

  return { valid: true };
}


function validatePigFortressSolution(answer) {
  if (!isRecord(answer)) return { valid: false, reason: 'No answer provided for Pig Fortress problem', score: 0 };

  const pigs = answer.pigs || {};
  const isMinionCorrect = cleanText(pigs.Minion).toUpperCase() === 'HONEST';
  const isCorporalCorrect = cleanText(pigs.Corporal).toUpperCase() === 'LIAR';
  const isForemanCorrect = cleanText(pigs.Foreman).toUpperCase() === 'LIAR';
  const isKingCorrect = cleanText(pigs.King).toUpperCase() === 'HONEST';
  const isHelmetCorrect = cleanText(pigs.Helmet).toUpperCase() === 'HONEST';
  const pigsAllCorrect = isMinionCorrect && isCorporalCorrect && isForemanCorrect && isKingCorrect && isHelmetCorrect;

  let orderClean = [];
  if (Array.isArray(answer.launch_order)) {
    orderClean = answer.launch_order.map(x => cleanText(x).toLowerCase());
  } else if (typeof answer.launch_order === 'string') {
    orderClean = answer.launch_order.toLowerCase().split(/(?:\s*(?:,|->|→)\s*|\s+)/).filter(Boolean);
  }
  const expectedOrder = ['red', 'chuck', 'matilda', 'bomb', 'hal'];
  const isOrderCorrect = orderClean.length === 5 && orderClean.every((b, i) => b === expectedOrder[i]);

  const pin = strictInteger(answer.vault_pin);
  const damage = strictInteger(answer.total_damage);
  const isPinCorrect = pin === 1788;
  const isDamageCorrect = damage === 298;

  let score = 0;
  if (pigsAllCorrect) score += 300;
  if (isOrderCorrect) score += 400;
  if (isPinCorrect) score += 500;
  if (isDamageCorrect) score += 100;

  const valid = isPinCorrect && isDamageCorrect && isOrderCorrect && pigsAllCorrect;

  return {
    valid,
    pigsAllCorrect,
    isOrderCorrect,
    isPinCorrect,
    isDamageCorrect,
    score: valid ? score : 0,
    vault_pin: pin,
    total_damage: damage,
    reason: valid
      ? 'Outstanding logic deduction! Pigs identified (3 Honest, 2 Liars), Launch Order: Red → Chuck → Matilda → Bomb → Hal, Total Damage: 298, Vault PIN: 1788.'
      : 'All pig classifications, the launch order, total damage, and PIN must be correct.'
  };
}


function validateOfficersSolution(answer) {
  if (!isRecord(answer)) return { valid: false, reason: 'No answer provided for 25 Officers puzzle', score: 0 };

  // Require the actual 5x5 arrangement; passcodes are not proof of a solution.
  const arrangement = answer.arrangement;
  if (Array.isArray(arrangement) && arrangement.length === 25) {
    const size = 5;

    // Check all cells filled
    for (let i = 0; i < 25; i++) {
      if (!arrangement[i] || typeof arrangement[i].color !== 'string' || !['red', 'blue', 'green', 'yellow', 'purple'].includes(arrangement[i].color.toLowerCase()) || !['♔', '♕', '♖', '♗', '♘'].includes(arrangement[i].piece)) {
        return { valid: false, reason: `Cell ${i + 1} is empty or incomplete`, score: 0 };
      }
    }

    // Check rows
    for (let r = 0; r < size; r++) {
      const rowColors = new Set();
      const rowPieces = new Set();
      for (let c = 0; c < size; c++) {
        const item = arrangement[r * size + c];
        rowColors.add(item.color.toLowerCase());
        rowPieces.add(item.piece);
      }
      if (rowColors.size !== size) {
        return { valid: false, reason: `Row ${r + 1} has duplicate colors`, score: 0 };
      }
      if (rowPieces.size !== size) {
        return { valid: false, reason: `Row ${r + 1} has duplicate chess pieces`, score: 0 };
      }
    }

    // Check columns
    for (let c = 0; c < size; c++) {
      const colColors = new Set();
      const colPieces = new Set();
      for (let r = 0; r < size; r++) {
        const item = arrangement[r * size + c];
        colColors.add(item.color.toLowerCase());
        colPieces.add(item.piece);
      }
      if (colColors.size !== size) {
        return { valid: false, reason: `Column ${c + 1} has duplicate colors`, score: 0 };
      }
      if (colPieces.size !== size) {
        return { valid: false, reason: `Column ${c + 1} has duplicate chess pieces`, score: 0 };
      }
    }

    // Check all 25 pairs are unique
    const uniquePairs = new Set();
    for (let i = 0; i < 25; i++) {
      const item = arrangement[i];
      uniquePairs.add(`${item.color.toLowerCase()}_${item.piece}`);
    }
    if (uniquePairs.size !== 25) {
      return { valid: false, reason: `Grid contains duplicate (color, piece) combinations`, score: 0 };
    }

    return {
      valid: true,
      score: 1000,
      verified_by: 'graeco_latin_square',
      reason: 'Perfect 5x5 Graeco-Latin Square! All rows, columns, and color-piece pairs verified.'
    };
  }

  return { valid: false, reason: 'A complete valid 25-officer arrangement is required', score: 0 };
}


function validateDeepfakeSolution(answer) {
  if (!isRecord(answer)) return { valid: false, reason: 'No answer provided for Deepfake puzzle', score: 0 };
  const deepfakeClean = cleanText(answer.deepfake).toUpperCase();
  const isDeepfakeCorrect = deepfakeClean === 'C';

  let orderClean = [];
  if (Array.isArray(answer.upload_order)) {
    orderClean = answer.upload_order.map(x => cleanText(x).toUpperCase());
  } else if (typeof answer.upload_order === 'string') {
    orderClean = answer.upload_order.trim().toUpperCase().split(/(?:\s*(?:,|->|→)\s*|\s+)/).filter(Boolean);
  }
  const isOrderCorrect = orderClean.length === 5 && orderClean.every((video, index) => video === 'BACED'[index]);

  let score = 0;
  if (isDeepfakeCorrect) score += 500;
  if (isOrderCorrect) score += 500;
  if (isDeepfakeCorrect && isOrderCorrect) score += 200; // bonus for full deduction

  const valid = isDeepfakeCorrect && isOrderCorrect;
  return {
    valid,
    isDeepfakeCorrect,
    isOrderCorrect,
    score: valid ? score : 0,
    deepfake: deepfakeClean,
    upload_order: orderClean.join(' -> '),
    reason: valid
      ? 'Perfect deduction! Video C is the deepfake and upload order is B -> A -> C -> E -> D.'
      : (!isDeepfakeCorrect && !isOrderCorrect
        ? 'Both deepfake video and upload order are incorrect.'
        : (!isDeepfakeCorrect ? 'Deepfake video selection is incorrect.' : 'Upload order is incorrect.'))
  };
}


function validateZeroToCroreSolution(answer) {
  if (!isRecord(answer)) return { valid: false, reason: 'No answer provided for Zero to Crore puzzle', score: 0 };

  const finalWordClean = cleanText(answer.final_word).toUpperCase();
  const sareeVal = strictInteger(answer.saree_value);
  const quotVal = strictInteger(answer.quotient_value);

  let mappingValid = false;
  if (answer.mapping && typeof answer.mapping === 'object' && !Array.isArray(answer.mapping)) {
    const letters = ['R', 'A', 'J', 'Z', 'E', 'O', 'C', 'G', 'N', 'S'];
    const m = Object.fromEntries(letters.map(letter => [letter, strictInteger(answer.mapping[letter])]));
    const digits = Object.values(m);
    const digitsValid = Object.keys(answer.mapping).length === 10 && digits.every(n => Number.isInteger(n) && n >= 0 && n <= 9) && new Set(digits).size === 10 && ['R', 'Z', 'C', 'G', 'S'].every(letter => m[letter] !== 0);
    const raja = Number(m.R) * 1000 + Number(m.A) * 100 + Number(m.J) * 10 + Number(m.A);
    const zero = Number(m.Z) * 1000 + Number(m.E) * 100 + Number(m.R) * 10 + Number(m.O);
    const crore = Number(m.C) * 10000 + Number(m.R) * 1000 + Number(m.O) * 100 + Number(m.R) * 10 + Number(m.E);
    const ganga = Number(m.G) * 10000 + Number(m.A) * 1000 + Number(m.N) * 100 + Number(m.G) * 10 + Number(m.A);
    const saree = Number(m.S) * 10000 + Number(m.A) * 1000 + Number(m.R) * 100 + Number(m.E) * 10 + Number(m.E);
    if (digitsValid && raja + zero === crore && ganga + zero === saree) {
      mappingValid = true;
    }
  }

  const isSareeCorrect = sareeVal === 75288;
  const isQuotCorrect = quotVal === 12548;
  const isWordCorrect = finalWordClean === 'CRANE';

  let score = 0;
  if (mappingValid) score += 500;
  if (isSareeCorrect) score += 300;
  if (isQuotCorrect) score += 200;
  if (isWordCorrect) score += 500;

  const valid = mappingValid && isSareeCorrect && isQuotCorrect && isWordCorrect;
  return {
    valid,
    mappingValid,
    isSareeCorrect,
    isQuotCorrect,
    isWordCorrect,
    score: valid ? score : 0,
    final_word: finalWordClean,
    saree_value: sareeVal,
    reason: valid
      ? 'Flawless cryptarithm deciphering! Decoded word is CRANE (SAREE = 75288, Quotient = 12548).'
      : 'The complete unique-digit mapping, both equations, SAREE, quotient, and decoded word must all be correct.'
  };
}

module.exports = { validateHashiSolution, validatePigFortressSolution, validateOfficersSolution, validateDeepfakeSolution, validateZeroToCroreSolution };
