const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));

// Paths
const DATA_DIR = process.env.CODEBOUNTY_DATA_DIR || path.join(__dirname, 'data');
const PUZZLES_FILE = path.join(DATA_DIR, 'puzzles.json');
const ROOM_FILE = path.join(DATA_DIR, 'room_config.json');
const DATASET_FILE = path.join(DATA_DIR, 'dataset.json');

// Helpers for reading/writing data
function readJSON(file, fallback = []) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const content = fs.readFileSync(file, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
    return fallback;
  }
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing ${file}:`, err);
    return false;
  }
}

// Format duration helper (seconds -> mm:ss.s)
function formatDuration(sec) {
  if (sec === null || sec === undefined) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 10);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
}

// Compute score helper
function computeScore(durationSeconds, mistakesCount, islandsCount) {
  const baseScore = islandsCount * 100;
  const timeBonus = Math.max(0, Math.floor((600 - durationSeconds) * 1.5));
  const mistakePenalty = (mistakesCount || 0) * 30;
  return Math.max(100, baseScore + timeBonus - mistakePenalty);
}

// Hashi Solution Validator
function validateHashiSolution(puzzle, bridges) {
  if (!puzzle || !Array.isArray(bridges)) return { valid: false, reason: 'Invalid bridge submission' };
  // puzzle: { islands: [{ id, r, c, number }] }
  // bridges: array of { u, v, count } or map
  const islands = puzzle.islands;
  const islandMap = new Map();
  islands.forEach(isl => islandMap.set(isl.id, isl));

  // Build degree table
  const degrees = new Map();
  islands.forEach(isl => degrees.set(isl.id, 0));

  const cleanBridges = [];
  const seenPairs = new Set();

  for (const b of bridges) {
    if (!b) return { valid: false, reason: 'Invalid bridge submission' };
    const u = Math.min(b.u, b.v);
    const v = Math.max(b.u, b.v);
    if (u === v || !Number.isInteger(b.count) || b.count < 1 || b.count > 2) {
      return { valid: false, reason: 'Invalid bridge pair or count' };
    }
    const pairKey = `${u}-${v}`;
    if (seenPairs.has(pairKey)) return { valid: false, reason: 'Duplicate bridge pair' };
    seenPairs.add(pairKey);
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

  return { valid: true, score: puzzle.id === 'puzzle-fy-10x10' ? 1000 : 800 };
}

// ----------------------------------------------------
// ROUND 2 POWER-UP SYSTEM SPECIFICATION
// ----------------------------------------------------
const ALL_POWERUPS = [
  {
    id: 'time_cracker',
    name: 'Time Cracker',
    tier: 1,
    unlocked_at_solved: 1,
    icon: '⚡',
    badge: 'Time Reduction',
    description: 'Deducts 20% of your total time taken to solve a question.'
  },
  {
    id: 'topic_finder',
    name: 'Topic Finder',
    tier: 1,
    unlocked_at_solved: 1,
    icon: '🔍',
    badge: 'Concept Clue',
    description: 'Reveals the topic of the question, meaning the concept you need to use.'
  },
  {
    id: 'penalty_sweeper',
    name: 'Penalty Sweeper',
    tier: 2,
    unlocked_at_solved: 2,
    icon: '🧹',
    badge: 'Zero Penalty',
    description: 'Removes all penalties on a question.'
  },
  {
    id: 'jumper_points',
    name: 'Jumper Points',
    tier: 2,
    unlocked_at_solved: 2,
    icon: '🚀',
    badge: '1.5x Multiplier',
    description: 'A multiplier power-up. The points for the question you select are multiplied by 1.5x.'
  },
];

function getUnlockedPowerups(questionsSolved) {
  if (questionsSolved >= 2) {
    return ['time_cracker', 'topic_finder', 'penalty_sweeper', 'jumper_points']; // 4 power-ups
  } else if (questionsSolved >= 1) {
    return ['time_cracker', 'topic_finder']; // 2 power-ups
  }
  return []; // 0 power-ups
}

// ----------------------------------------------------
// TRACK 1: FY TRACK (FIRST YEARS) CONFIG & VALIDATORS
// ----------------------------------------------------
const TRACK1_CONFIG = {
  id: 'track1',
  title: 'Track 1: FY Track (First Years)',
  subtitle: 'Hashi 10×10 + The Pig Fortress Problem + 25 Officer Puzzle',
  time_limit_seconds: 1800, // 30 minutes for the entire round
  stages: [
    {
      id: 'stage1',
      num: 1,
      title: '1. Hashi (10×10 Grid)',
      subtitle: 'Build bridges connecting all islands into one network',
      type: 'hashi',
      reference_url: 'https://www.puzzle-bridges.com/?pl=71571b79b4cfa7eab3b1222a48c160e06ac7546bbd506',
      puzzle_id: 'puzzle-fy-10x10',
      description: 'Connect all 24 islands with orthogonal bridges matching island numbers. Max 2 bridges per pair. No crossings. Single connected network.'
    },
    {
      id: 'stage2',
      num: 2,
      title: '2. The Pig Fortress Problem',
      subtitle: 'A Logic Brain Teaser • Honest/Liar Pigs & Bird Launch Order',
      type: 'pig_fortress',
      description: 'Five pigs (Minion, Corporal, Foreman, King, Helmet) hide in a fortress. You launch 5 birds (Red, Chuck, Matilda, Bomb, Hal) in positions 1 to 5.',
      rules: [
        'Every pig is either Honest (always speaks truth) or a Liar (always lies).',
        'At least one pig is Honest.',
        'Each pig makes two statements: Round 1 (about each other) and Round 2 (about bird launch order).',
        'A Liar statement must be false as a whole (think carefully about "and" and "or").'
      ],
      taunts_round1: [
        { pig: 'Minion', statement: '“Foreman is a liar.”' },
        { pig: 'Corporal', statement: '“All five of us are liars.”' },
        { pig: 'Foreman', statement: '“King and Corporal are the same type.”' },
        { pig: 'King', statement: '“Corporal is a liar.”' },
        { pig: 'Helmet', statement: '“Minion is honest, and Corporal is a liar.”' }
      ],
      taunts_round2: [
        { pig: 'Minion', statement: '“Red flew before Chuck, and Matilda flew before Bomb.”' },
        { pig: 'Corporal', statement: '“Matilda flew before Red.”' },
        { pig: 'Foreman', statement: '“Hal flew before Bomb, or Hal flew first.”' },
        { pig: 'King', statement: '“Exactly one bird flew between Chuck and Bomb.”' },
        { pig: 'Helmet', statement: '“Chuck was not the last bird launched.”' }
      ],
      scoring_rules: {
        powers: { Red: 7, Chuck: 12, Matilda: 9, Bomb: 25, Hal: 14 },
        damage_rule: 'Damage = Launch Position (1 to 5) × Power.',
        bomb_boost_rule: 'The bird launched immediately after Bomb has its base power doubled before damage is calculated. (If Bomb is last, no bird is affected).',
        total_damage_rule: 'Total Damage = Sum of all five birds’ damage.',
        pin_formula: 'Vault PIN = Total Damage × (number of Honest pigs) × (number of Liar pigs).'
      }
    },
    {
      id: 'stage3',
      num: 3,
      title: '3. The 25 Officer Puzzle',
      subtitle: 'Euler’s 25 Officers • Graeco-Latin Square Challenge',
      type: 'officers',
      reference_url: 'https://49-officers-puzzlecodebounty.vercel.app/',
      description: 'Arrange 25 officers (5 regiments/colors × 5 ranks/chess pieces) in a 5×5 grid so each row and column contains 5 distinct colors and 5 distinct pieces, with no duplicate pairs.',
      grid_size: 5,
      colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple'],
      pieces: ['♔', '♕', '♖', '♗', '♘'],
      passcode: 'tuhaikon@codestars'
    }
  ]
};

function validatePigFortressSolution(answer) {
  if (!answer) return { valid: false, reason: 'No answer provided for Pig Fortress problem', score: 0 };

  const pigs = answer.pigs || {};
  const isMinionCorrect = String(pigs.Minion || '').trim().toUpperCase() === 'HONEST';
  const isCorporalCorrect = String(pigs.Corporal || '').trim().toUpperCase() === 'LIAR';
  const isForemanCorrect = String(pigs.Foreman || '').trim().toUpperCase() === 'LIAR';
  const isKingCorrect = String(pigs.King || '').trim().toUpperCase() === 'HONEST';
  const isHelmetCorrect = String(pigs.Helmet || '').trim().toUpperCase() === 'HONEST';
  const pigsAllCorrect = isMinionCorrect && isCorporalCorrect && isForemanCorrect && isKingCorrect && isHelmetCorrect;

  let orderClean = [];
  if (Array.isArray(answer.launch_order)) {
    orderClean = answer.launch_order.map(x => String(x).trim().toLowerCase());
  } else if (typeof answer.launch_order === 'string') {
    orderClean = answer.launch_order.toLowerCase().split(/[,\s->]+/).filter(Boolean);
  }
  const expectedOrder = ['red', 'chuck', 'matilda', 'bomb', 'hal'];
  const isOrderCorrect = orderClean.length === 5 && orderClean.every((b, i) => b === expectedOrder[i]);

  const pin = parseInt(answer.vault_pin, 10);
  const damage = parseInt(answer.total_damage, 10);
  const isPinCorrect = pin === 1788;
  const isDamageCorrect = damage === 298;

  let score = 0;
  if (pigsAllCorrect) score += 300;
  if (isOrderCorrect) score += 400;
  if (isPinCorrect) score += 500;
  if (isDamageCorrect) score += 100;

  const valid = pigsAllCorrect && isOrderCorrect && isDamageCorrect && isPinCorrect;

  return {
    valid,
    pigsAllCorrect,
    isOrderCorrect,
    isPinCorrect,
    isDamageCorrect,
    score,
    vault_pin: pin,
    total_damage: damage,
    reason: valid
      ? 'Pig roles, launch order, total damage, and Vault PIN verified.'
      : (!pigsAllCorrect ? 'Pig Honest/Liar classifications are incorrect.'
        : (!isOrderCorrect ? 'Launch sequence order is incorrect.'
          : (!isDamageCorrect ? 'Total damage is incorrect.' : 'Vault PIN is incorrect.')))
  };
}

function validateOfficersSolution(answer) {
  if (!answer) return { valid: false, reason: 'No answer provided for 25 Officers puzzle', score: 0 };

  // Check 1: Passcode bypass / code from vercel
  const passcode = String(answer.passcode || answer.password || '').trim();
  if (passcode.toLowerCase() === 'tuhaikon@codestars') {
    return {
      valid: true,
      score: 1000,
      verified_by: 'passcode',
      reason: '25 Officer Puzzle verified! Secret passcode tuhaikon@codestars confirmed.'
    };
  }

  // Check 2: 5x5 arrangement array
  const arrangement = answer.arrangement;
  if (Array.isArray(arrangement) && arrangement.length === 25) {
    const size = 5;

    // Check all cells filled
    for (let i = 0; i < 25; i++) {
      if (!arrangement[i] || !arrangement[i].color || !arrangement[i].piece) {
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

  return { valid: false, reason: 'Invalid or incomplete 25 officers arrangement or passcode', score: 0 };
}

// ----------------------------------------------------
// TRACK 2: CODESTARS TRI-CHALLENGE CONFIG & VALIDATORS
// ----------------------------------------------------
const TRACK2_CONFIG = {
  id: 'track2',
  title: 'Track 2: All Other Years (Harder)',
  subtitle: 'Hashi 10×10 Hard + Brain Teaser Mystery + Alphametic Cryptarithm',
  time_limit_seconds: 1800, // 30 minutes for the entire round
  stages: [
    {
      id: 'stage1',
      num: 1,
      title: '1. Hashi 10*10 HARD',
      subtitle: 'Standard 10×10 Championship Board',
      type: 'hashi',
      reference_url: 'https://www.puzzle-bridges.com/?size=52',
      puzzle_id: 'puzzle-10x10-pro',
      description: 'Connect all islands with orthogonal bridges matching the island numbers. No bridges cross.'
    },
    {
      id: 'stage2',
      num: 2,
      title: '2. WHO IS THE DEEPFAKE?',
      subtitle: 'CODESTARS NON-TECH BRAIN TEASER',
      type: 'deepfake',
      case_text: 'A creator posts five short videos — A, B, C, D and E — as part of a viral online challenge. Hours later, the creator reveals that exactly one video is an AI-generated deepfake. The other four are genuine recordings. Visual inspection is useless: the fake looks perfect. The only way to identify it is to check what each video claims against the other evidence.',
      rules: [
        'The deepfake contains exactly TWO false claims.',
        'Every genuine video contains exactly ONE false claim.'
      ],
      videos: [
        { id: 'A', claim1: 'B was uploaded before me.', claim2: 'A is the deepfake.' },
        { id: 'B', claim1: 'C is genuine.', claim2: 'D was uploaded after E.' },
        { id: 'C', claim1: 'B and E have different authenticity: one is genuine and the other is fake.', claim2: 'C was uploaded before A.' },
        { id: 'D', claim1: 'D was uploaded before A.', claim2: 'B is genuine.' },
        { id: 'E', claim1: "D's claim that B is genuine is false.", claim2: 'E was uploaded before D.' }
      ],
      evidence: [
        '1. The upload order was not alphabetical.',
        '2. Video B was uploaded earlier than Video D. E was uploaded after C.',
        '3. Exactly two of these statements are true: • "B was before A" • "A was before C" • "D was before A"',
        '4. The deepfake was not the first or last video uploaded.',
        '5. A platform notification confirms that E was uploaded before D.'
      ],
      ai_fact_check: {
        statement: 'Video A is genuine, and Video C was uploaded before Video B.',
        note: 'You are told that the AI fact-check contains exactly ONE incorrect conclusion.'
      }
    },
    {
      id: 'stage3',
      num: 3,
      title: '3. ZERO TO CRORE',
      subtitle: 'An alphametic logic puzzle',
      type: 'alphametic',
      description: 'A mysterious number-code has been used to hide a message. Each letter represents one unique digit from 0 to 9. The same letter always represents the same digit. Different letters represent different digits. No number can begin with 0. All ten digits from 0 to 9 are used exactly once. The same letter-to-digit key must work for both equations.',
      equations: [
        'RAJA + ZERO = CRORE',
        'GANGA + ZERO = SAREE'
      ],
      letters: ['R', 'A', 'J', 'Z', 'E', 'O', 'C', 'G', 'N', 'S'],
      instructions: [
        '1. Find the complete letter → digit mapping (R, A, J, Z, E, O, C, G, N, S).',
        '2. Determine the numerical value of SAREE.',
        '3. Divide that number by 6.',
        '4. Convert the resulting quotient back into letters using the same key to discover a meaningful English word.'
      ],
      hints: [
        { id: 1, title: 'Hint 1 — The Ten-Digit Lock', text: 'There are exactly 10 different letters in the two equations: R, A, J, Z, E, O, C, G, N, S. All ten digits 0 to 9 are used exactly once.' },
        { id: 2, title: "Hint 2 — Don't Start From the Left", text: 'Look at the addition column by column, starting from the units column: A + O = E in both RAJA + ZERO and GANGA + ZERO. The units addition is identical in both equations!' },
        { id: 3, title: 'Hint 3 — Watch the Carries', text: 'In RAJA + ZERO = CRORE, two 4-digit numbers sum to a 5-digit number (CRORE). The carry into the ten-thousands column can only be 1, which directly fixes C = 1!' },
        { id: 4, title: 'Hint 4 — The Leftmost Digit', text: 'With C = 1, in the thousands column R + Z (+ carry) must produce 1R. Since R + Z >= 10, examine the heavily constrained carry conditions.' },
        { id: 5, title: 'Final Hint — The Second Equation Is the Check', text: 'Use GANGA + ZERO = SAREE to eliminate the remaining branches. There is only ONE unique key that satisfies both equations simultaneously.' }
      ]
    }
  ]
};

function validateDeepfakeSolution(answer) {
  if (!answer) return { valid: false, reason: 'No answer provided for Deepfake puzzle', score: 0 };
  const deepfakeClean = String(answer.deepfake || '').trim().toUpperCase();
  const isDeepfakeCorrect = deepfakeClean === 'C';

  let orderClean = [];
  if (Array.isArray(answer.upload_order)) {
    orderClean = answer.upload_order.map(x => String(x).trim().toUpperCase());
  } else if (typeof answer.upload_order === 'string') {
    orderClean = answer.upload_order.toUpperCase().replace(/[^A-E]/g, '').split('');
  }
  const isOrderCorrect = orderClean.join('') === 'BACED';

  let score = 0;
  if (isDeepfakeCorrect) score += 500;
  if (isOrderCorrect) score += 500;
  if (isDeepfakeCorrect && isOrderCorrect) score += 200; // bonus for full deduction

  const valid = isDeepfakeCorrect && isOrderCorrect;
  return {
    valid,
    isDeepfakeCorrect,
    isOrderCorrect,
    score,
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
  if (!answer) return { valid: false, reason: 'No answer provided for Zero to Crore puzzle', score: 0 };

  const finalWordClean = String(answer.final_word || '').trim().toUpperCase();
  const sareeVal = parseInt(answer.saree_value, 10);
  const quotVal = parseInt(answer.quotient_value, 10);

  let mappingValid = false;
  if (answer.mapping && typeof answer.mapping === 'object') {
    const m = answer.mapping;
    const digits = ['R', 'A', 'J', 'Z', 'E', 'O', 'C', 'G', 'N', 'S'].map(k => String(m[k] ?? ''));
    const distinctDigits = digits.every(d => /^[0-9]$/.test(d)) && new Set(digits).size === 10;
    const leadingDigits = ['R', 'Z', 'C', 'G', 'S'].every(k => String(m[k]) !== '0');
    const raja = Number(m.R) * 1000 + Number(m.A) * 100 + Number(m.J) * 10 + Number(m.A);
    const zero = Number(m.Z) * 1000 + Number(m.E) * 100 + Number(m.R) * 10 + Number(m.O);
    const crore = Number(m.C) * 10000 + Number(m.R) * 1000 + Number(m.O) * 100 + Number(m.R) * 10 + Number(m.E);
    const ganga = Number(m.G) * 10000 + Number(m.A) * 1000 + Number(m.N) * 100 + Number(m.G) * 10 + Number(m.A);
    const saree = Number(m.S) * 10000 + Number(m.A) * 1000 + Number(m.R) * 100 + Number(m.E) * 10 + Number(m.E);
    if (distinctDigits && leadingDigits && raja + zero === crore && ganga + zero === saree) {
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
    score,
    final_word: finalWordClean,
    saree_value: sareeVal,
    reason: valid
      ? 'Cryptarithm mapping, SAREE value, quotient, and decoded word verified.'
      : (!mappingValid ? 'Letter-to-digit mapping or equation sums are incorrect.'
        : (!isSareeCorrect ? 'SAREE value is incorrect.'
          : (!isQuotCorrect ? 'Division quotient is incorrect.' : 'Decoded word is incorrect.')))
  };
}

// ----------------------------------------------------
// ROUTES
// ----------------------------------------------------

// Tracks Overview
app.get('/api/tracks', (req, res) => {
  res.json({
    round_title: 'Round 2: The Non-Tech Round',
    time_limit_seconds: 1800,
    powerups: ALL_POWERUPS,
    tracks: [
      {
        id: 'track1',
        name: 'Track 1: FY Track (First Years)',
        description: '3 Sequential Stages: Hashi 10×10 Grid -> The Pig Fortress Problem -> 25 Officer Puzzle (Euler’s Graeco-Latin Square).',
        config: TRACK1_CONFIG
      },
      {
        id: 'track2',
        name: 'Track 2: All Other Years (Harder)',
        description: '3 Sequential Stages: Hashi 10×10 Hard -> WHO IS THE DEEPFAKE? -> ZERO TO CRORE Alphametic.',
        config: TRACK2_CONFIG
      }
    ]
  });
});

// Track 1 Details
app.get('/api/track1/info', (req, res) => {
  const puzzles = readJSON(PUZZLES_FILE, []);
  const puzzleFY = puzzles.find(p => p.id === 'puzzle-fy-10x10') || puzzles[0];

  res.json({
    ...TRACK1_CONFIG,
    puzzle: {
      id: puzzleFY.id,
      name: puzzleFY.name,
      difficulty: puzzleFY.difficulty,
      width: puzzleFY.width,
      height: puzzleFY.height,
      islands: puzzleFY.islands
    }
  });
});

// Track 2 Details
app.get('/api/track2/info', (req, res) => {
  const puzzles = readJSON(PUZZLES_FILE, []);
  const puzzle10x10 = puzzles.find(p => p.id === 'puzzle-10x10-pro') || puzzles[0];

  res.json({
    ...TRACK2_CONFIG,
    puzzle10x10: {
      id: puzzle10x10.id,
      name: puzzle10x10.name,
      difficulty: puzzle10x10.difficulty,
      width: puzzle10x10.width,
      height: puzzle10x10.height,
      islands: puzzle10x10.islands
    }
  });
});

// Power-Ups List
app.get('/api/powerups', (req, res) => {
  res.json({
    powerups: ALL_POWERUPS,
    pool_rules: [
      { questions_solved: 1, pool_size: 2, unlocked: ['time_cracker', 'topic_finder'] },
      { questions_solved: 2, pool_size: 4, unlocked: ['time_cracker', 'topic_finder', 'penalty_sweeper', 'jumper_points'] },
      { questions_solved: 3, pool_size: 4, unlocked: ['time_cracker', 'topic_finder', 'penalty_sweeper', 'jumper_points'] }
    ]
  });
});

// ----------------------------------------------------
// ROUND 2 PARTICIPANT WORKFLOW ENDPOINTS
// ----------------------------------------------------

// Start Round 2 Attempt (Track 1 or Track 2)
app.post('/api/round2/start', (req, res) => {
  const { batch, student_id, student_name, name, college, track, lab } = req.body;
  const finalName = (student_name || name || '').trim();
  if (!finalName) {
    return res.status(400).json({ error: 'Contestant or Team name is required' });
  }

  const room = readJSON(ROOM_FILE, {});
  const finalCollege = (college && String(college).trim()) ? String(college).trim() : (room.default_college || '');

  const activeTrack = (track === 'track1') ? 'track1' : 'track2';
  const assignedLab = (lab && String(lab).trim()) ? String(lab).trim() : 'Lab 1';
  const assignedBatch = (batch && String(batch).trim()) ? String(batch).trim() : 'Cohort 1';
  const assignedId = (student_id && String(student_id).trim())
    ? String(student_id).trim().toUpperCase()
    : `CST-${Math.floor(100 + Math.random() * 900)}`;

  const dataset = readJSON(DATASET_FILE, []);
  const attemptId = `att_r2_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const startTime = new Date().toISOString();

  const puzzles = readJSON(PUZZLES_FILE, []);
  const puzzleId = (activeTrack === 'track1') ? 'puzzle-fy-10x10' : 'puzzle-10x10-pro';
  const puzzle = puzzles.find(p => p.id === puzzleId) || puzzles[0];

  const newAttempt = {
    id: attemptId,
    track: activeTrack,
    batch: assignedBatch,
    lab: assignedLab,
    college: finalCollege,
    student_id: assignedId,
    student_name: finalName,
    puzzle_id: puzzle.id,
    puzzle_name: (activeTrack === 'track1') ? 'FY Track Challenge' : 'Codestars Tri-Challenge',
    difficulty: (activeTrack === 'track1') ? 'Classic' : 'Championship',
    status: 'IN_PROGRESS',
    time_limit_seconds: 1800, // 30 minutes
    questions_solved: 0,
    pool_size: 0,
    unlocked_powerups: [],
    powerups_selected: [],
    powerups_confirmed: false,
    powerups_locked_at: null,
    current_stage: 1,
    stages: {
      stage1: { status: 'PENDING', valid: false, score: 0 },
      stage2: { status: 'LOCKED', valid: false, score: 0 },
      stage3: { status: 'LOCKED', valid: false, score: 0 }
    },
    start_time: startTime,
    finish_time: null,
    duration_seconds: null,
    formatted_time: '--:--',
    moves_count: 0,
    mistakes_count: 0,
    undos_count: 0,
    tab_switches: 0,
    score: 0,
    bridges: []
  };

  dataset.push(newAttempt);
  writeJSON(DATASET_FILE, dataset);

  res.json({
    attempt_id: attemptId,
    track: activeTrack,
    lab: assignedLab,
    college: finalCollege,
    student_name: finalName,
    student_id: assignedId,
    start_time: startTime,
    time_limit_seconds: 1800,
    config: (activeTrack === 'track1') ? TRACK1_CONFIG : TRACK2_CONFIG,
    puzzle: {
      id: puzzle.id,
      name: puzzle.name,
      difficulty: puzzle.difficulty,
      width: puzzle.width,
      height: puzzle.height,
      islands: puzzle.islands
    }
  });
});


// Validate Intermediate Stage with Sequential Unlocking
app.post('/api/round2/validate-stage', (req, res) => {
  try {
    const { attempt_id, track, stage, data } = req.body || {};
    const targetTrack = (track === 'track1') ? 'track1' : 'track2';
    const stageNum = Number(stage);
    const dataset = readJSON(DATASET_FILE, []);
    const idx = dataset.findIndex(a => a.id === attempt_id);
    if (idx === -1) return res.status(404).json({ valid: false, reason: 'Attempt not found' });
    const att = dataset[idx];
    if (att.track !== targetTrack) return res.status(400).json({ valid: false, reason: 'Attempt track does not match' });
    if (![1, 2, 3].includes(stageNum)) return res.status(400).json({ valid: false, reason: 'Invalid stage' });
    if (att.status !== 'IN_PROGRESS') return res.status(409).json({ valid: false, reason: 'Round already submitted' });
    if (Date.now() - Date.parse(att.start_time) >= 1800000) {
      return res.status(403).json({ valid: false, reason: 'The 30-minute round has expired' });
    }
    if (stageNum > 1 && att.stages?.[`stage${stageNum - 1}`]?.status !== 'COMPLETED') {
      return res.status(409).json({ valid: false, reason: 'Complete the previous stage first' });
    }

    const puzzles = readJSON(PUZZLES_FILE, []);
    let result = { valid: false, reason: 'Invalid validation request' };

    if (targetTrack === 'track1') {
      if (stageNum === 1) {
        const puzzle = puzzles.find(p => p.id === 'puzzle-fy-10x10') || puzzles[0];
        result = validateHashiSolution(puzzle, data?.bridges || []);
      } else if (stageNum === 2) {
        result = validatePigFortressSolution(data);
      } else if (stageNum === 3) {
        result = validateOfficersSolution(data);
      }
    } else {
      if (stageNum === 1) {
        const puzzle = puzzles.find(p => p.id === 'puzzle-10x10-pro') || puzzles[0];
        result = validateHashiSolution(puzzle, data?.bridges || []);
      } else if (stageNum === 2) {
        result = validateDeepfakeSolution(data);
      } else if (stageNum === 3) {
        result = validateZeroToCroreSolution(data);
      }
    }

    // Record a verified stage only for the active attempt.
    if (result.valid) {
        att.stages = att.stages || {
          stage1: { status: 'PENDING' },
          stage2: { status: 'LOCKED' },
          stage3: { status: 'LOCKED' }
        };

          att.stages[`stage${stageNum}`] = {
            status: 'COMPLETED',
            valid: true,
            score: result.score || 500,
            completed_at: new Date().toISOString(),
            reason: result.reason
          };

          // Unlock next stage sequentially
          if (stageNum === 1 && att.stages.stage2 && att.stages.stage2.status === 'LOCKED') {
            att.stages.stage2.status = 'PENDING';
          }
          if (stageNum === 2 && att.stages.stage3 && att.stages.stage3.status === 'LOCKED') {
            att.stages.stage3.status = 'PENDING';
          }

          // Recompute questions solved accurately
          let solvedCount = stageNum;
          if (att.stages.stage1?.status === 'COMPLETED' || att.stages.stage1?.valid) solvedCount = Math.max(solvedCount, 1);
          if (att.stages.stage2?.status === 'COMPLETED' || att.stages.stage2?.valid) solvedCount = Math.max(solvedCount, 2);
          if (att.stages.stage3?.status === 'COMPLETED' || att.stages.stage3?.valid) solvedCount = Math.max(solvedCount, 3);

          att.questions_solved = solvedCount;
          att.unlocked_powerups = getUnlockedPowerups(solvedCount);
          att.pool_size = att.unlocked_powerups.length;
          dataset[idx] = att;
          if (!writeJSON(DATASET_FILE, dataset)) {
            return res.status(500).json({ valid: false, reason: 'Could not save stage verification. Please retry.' });
          }
    }

    const currentSolved = att.questions_solved || 0;
    const unlockedPowerups = getUnlockedPowerups(currentSolved);

    res.json({
      stage: stageNum,
      track: targetTrack,
      ...result,
      questions_solved: currentSolved,
      pool_size: unlockedPowerups.length,
      unlocked_powerups: unlockedPowerups,
      next_stage_unlocked: result.valid && stageNum < 3
    });
  } catch (err) {
    console.error('Error in /api/round2/validate-stage:', err);
    res.status(200).json({
      stage: parseInt(req.body?.stage, 10) || 1,
      track: req.body?.track || 'track1',
      valid: false,
      reason: 'Validation processing issue: ' + (err.message || 'unknown error'),
      questions_solved: 0,
      pool_size: 0,
      unlocked_powerups: [],
      next_stage_unlocked: false
    });
  }
});

// Submit Complete Round 2 Attempt
function round2SubmissionResult(attempt) {
  const unlocked = getUnlockedPowerups(attempt.questions_solved || 0);
  return {
    success: true,
    allPassed: attempt.questions_solved === 3,
    attempt,
    stageBreakdown: attempt.stages,
    questions_solved: attempt.questions_solved || 0,
    pool_size: unlocked.length,
    unlocked_powerups: unlocked,
    totalScore: attempt.score || 0,
    ready_for_powerup_selection: true
  };
}

app.post(['/api/round2/submit', '/api/track2/submit'], (req, res) => {
  const {
    attempt_id,
    track,
    duration_seconds,
    stage1,
    stage2,
    stage3,
    moves_count,
    mistakes_count,
    undos_count,
    tab_switches
  } = req.body;

  const dataset = readJSON(DATASET_FILE, []);
  const attemptIndex = dataset.findIndex(a => a.id === attempt_id);
  if (attemptIndex === -1) {
    return res.status(404).json({ error: 'Attempt not found' });
  }

  const attempt = dataset[attemptIndex];
  // A retry retrieves the saved result without changing scores or finish time.
  if (attempt.finish_time && ['COMPLETED', 'PARTIAL', 'FAILED'].includes(attempt.status)) {
    return res.json(round2SubmissionResult(attempt));
  }
  if (attempt.status !== 'IN_PROGRESS') {
    return res.status(409).json({ error: 'Round already submitted' });
  }
  const puzzles = readJSON(PUZZLES_FILE, []);
  const targetTrack = attempt.track || track || 'track1';

  let val1 = { valid: false }, val2 = { valid: false }, val3 = { valid: false };

  if (targetTrack === 'track1') {
    const puzzle = puzzles.find(p => p.id === 'puzzle-fy-10x10') || puzzles[0];
    val1 = attempt.stages?.stage1?.valid ? attempt.stages.stage1 : validateHashiSolution(puzzle, stage1?.bridges || []);
    val2 = attempt.stages?.stage2?.valid ? attempt.stages.stage2 : validatePigFortressSolution(stage2);
    val3 = attempt.stages?.stage3?.valid ? attempt.stages.stage3 : validateOfficersSolution(stage3);
  } else {
    const puzzle = puzzles.find(p => p.id === 'puzzle-10x10-pro') || puzzles[0];
    val1 = attempt.stages?.stage1?.valid ? attempt.stages.stage1 : validateHashiSolution(puzzle, stage1?.bridges || []);
    val2 = attempt.stages?.stage2?.valid ? attempt.stages.stage2 : validateDeepfakeSolution(stage2);
    val3 = attempt.stages?.stage3?.valid ? attempt.stages.stage3 : validateZeroToCroreSolution(stage3);
  }

  // A final submission may grade the current stage at timeout, but cannot skip earlier stages.
  if (attempt.stages?.stage1?.status !== 'COMPLETED') {
    val2 = { valid: false, score: 0, reason: 'Stage 1 was not verified' };
    val3 = { valid: false, score: 0, reason: 'Stage 2 was not verified' };
  } else if (attempt.stages?.stage2?.status !== 'COMPLETED') {
    val3 = { valid: false, score: 0, reason: 'Stage 2 was not verified' };
  }

  const finishTime = new Date().toISOString();
  const finalDuration = Math.max(1, Math.floor((Date.now() - Date.parse(attempt.start_time)) / 1000));

  let solvedCount = 0;
  let totalScore = 0;
  if (val1.valid) { solvedCount++; totalScore += (val1.score || 800); }
  if (val2.valid) { solvedCount++; totalScore += (val2.score || 800); }
  if (val3.valid) { solvedCount++; totalScore += (val3.score || 1000); }

  const allPassed = solvedCount === 3;
  attempt.status = allPassed ? 'COMPLETED' : (solvedCount > 0 ? 'PARTIAL' : 'FAILED');
  attempt.finish_time = finishTime;
  attempt.duration_seconds = finalDuration;
  attempt.formatted_time = formatDuration(finalDuration);
  attempt.moves_count = moves_count || attempt.moves_count;
  attempt.mistakes_count = mistakes_count || attempt.mistakes_count;
  attempt.undos_count = undos_count || attempt.undos_count;
  attempt.tab_switches = tab_switches || attempt.tab_switches;
  attempt.score = totalScore;
  attempt.questions_solved = solvedCount;
  attempt.unlocked_powerups = getUnlockedPowerups(solvedCount);
  attempt.pool_size = attempt.unlocked_powerups.length;
  attempt.stages = {
    stage1: { status: val1.valid ? 'COMPLETED' : 'FAILED', valid: val1.valid, score: val1.score || 0, reason: val1.reason },
    stage2: { status: val2.valid ? 'COMPLETED' : 'FAILED', valid: val2.valid, score: val2.score || 0, reason: val2.reason },
    stage3: { status: val3.valid ? 'COMPLETED' : 'FAILED', valid: val3.valid, score: val3.score || 0, reason: val3.reason }
  };

  dataset[attemptIndex] = attempt;
  if (!writeJSON(DATASET_FILE, dataset)) {
    return res.status(500).json({ error: 'Could not save your round. Please retry submission.' });
  }

  res.json(round2SubmissionResult(attempt));
});

// Select exactly 2 Power-Ups (Post-Round Selection)
app.get('/api/round2/attempt/:attemptId/powerups', (req, res) => {
  const attempt = readJSON(DATASET_FILE, []).find(a => a.id === req.params.attemptId);
  if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
  const unlocked = getUnlockedPowerups(attempt.questions_solved || 0);
  const selected = [...new Set(attempt.powerups_selected || [])].filter(id => unlocked.includes(id));
  res.set('Cache-Control', 'no-store');
  res.json({
    attempt_id: attempt.id,
    round_submitted: !!attempt.finish_time && ['COMPLETED', 'PARTIAL', 'FAILED'].includes(attempt.status),
    questions_solved: attempt.questions_solved || 0,
    unlocked_powerups: unlocked,
    selected_powerups: selected,
    confirmed: !!attempt.powerups_confirmed && selected.length === 2,
    locked_at: attempt.powerups_locked_at
  });
});

app.post('/api/round2/select-powerups', (req, res) => {
  const { attempt_id, selected_powerups } = req.body;
  const { attempt_id, selected_powerups } = req.body;
  if (!attempt_id) return res.status(400).json({ error: 'attempt_id required' });

  const dataset = readJSON(DATASET_FILE, []);
  const attemptIndex = dataset.findIndex(a => a.id === attempt_id);
  if (attemptIndex === -1) {
    return res.status(404).json({ error: 'Attempt not found' });
  }

  const attempt = dataset[attemptIndex];
  if (!attempt.finish_time || attempt.status === 'IN_PROGRESS') {
    return res.status(409).json({ error: 'Submit the round before selecting power-ups' });
  }
  const existingChoices = attempt.powerups_selected || [];
  const existingChoicesValid = existingChoices.length === 2 && existingChoices.every(id => ALL_POWERUPS.some(p => p.id === id));
  if (attempt.powerups_confirmed && existingChoicesValid) {
    if (Array.isArray(selected_powerups) && selected_powerups.length === 2 &&
        new Set(selected_powerups).size === 2 && selected_powerups.every(id => existingChoices.includes(id))) {
      return res.json({ success: true, locked: true, powerups_selected: existingChoices, locked_at: attempt.powerups_locked_at });
    }
    return res.status(400).json({
      error: 'Power-up choices are already locked for this attempt and cannot be changed',
      choices: attempt.powerups_selected,
      locked_at: attempt.powerups_locked_at
    });
  }

  const availablePool = getUnlockedPowerups(attempt.questions_solved || 0);
  const selected = Array.isArray(selected_powerups) ? selected_powerups : [];
  if (availablePool.length < 2) return res.status(400).json({ error: 'No power-ups are available for this attempt' });

  // Validation: exactly 2 power-ups required if pool size >= 2
  const requiredCount = Math.min(2, availablePool.length);
  if (requiredCount === 0 || selected.length !== requiredCount || new Set(selected).size !== selected.length) {
    return res.status(400).json({
      error: `You must select exactly ${requiredCount} power-up(s) from your unlocked pool of ${availablePool.length}`
    });
  }

  // Ensure each selected power-up is in their unlocked pool
  for (const p of selected) {
    if (!availablePool.includes(p)) {
      return res.status(400).json({
        error: `Power-up "${p}" is not in your unlocked pool!`
      });
    }
  }

  // Target selection is not part of choosing Round 3 power-ups.
  const target = null;

  attempt.powerups_selected = selected;
  attempt.powerups_confirmed = true;
  attempt.powerups_locked_at = new Date().toISOString();

  dataset[attemptIndex] = attempt;
  if (!writeJSON(DATASET_FILE, dataset)) {
    return res.status(500).json({ error: 'Could not save power-up choices. Please retry.' });
  }

  // Get friendly names for chosen power-ups
  const selectedDetails = selected.map(id => ALL_POWERUPS.find(p => p.id === id) || { id, name: id });

  res.json({
    success: true,
    locked: true,
    message: 'Choices successfully confirmed and permanently locked for Round 3!',
    powerups_selected: selected,
    selected_details: selectedDetails,
    locked_at: attempt.powerups_locked_at
  });
});

// Admin Power-Up Overview API
app.get('/api/admin/powerups', (req, res) => {
  const { track, lab, batch } = req.query;
  const dataset = readJSON(DATASET_FILE, []);

  let filtered = dataset;
  if (track && track !== 'all') {
    filtered = filtered.filter(r => (r.track || 'track1').toLowerCase() === track.toLowerCase());
  }
  if (lab && lab !== 'all') {
    filtered = filtered.filter(r => (r.lab || 'Lab 1').toLowerCase() === lab.toLowerCase());
  }
  if (batch && batch !== 'all') {
    filtered = filtered.filter(r => (r.batch || 'Batch A').toLowerCase() === batch.toLowerCase());
  }

  // Statistics breakdown
  const stats = {
    total: filtered.length,
    confirmed_powerups_count: filtered.filter(r => r.powerups_confirmed && (r.powerups_selected || []).filter(id => ALL_POWERUPS.some(p => p.id === id)).length === 2).length,
    powerup_counts: {
      time_cracker: 0,
      topic_finder: 0,
      penalty_sweeper: 0,
      jumper_points: 0
    },
    solved_distribution: {
      zero: filtered.filter(r => (r.questions_solved || 0) === 0).length,
      one: filtered.filter(r => r.questions_solved === 1).length,
      two: filtered.filter(r => r.questions_solved === 2).length,
      three: filtered.filter(r => r.questions_solved === 3).length
    }
  };

  filtered.forEach(r => {
    if (Array.isArray(r.powerups_selected)) {
      r.powerups_selected.forEach(pId => {
        if (stats.powerup_counts[pId] !== undefined) {
          stats.powerup_counts[pId]++;
        }
      });
    }
  });

  const records = filtered.map(r => {
    const selected = (r.powerups_selected || []).filter(id => ALL_POWERUPS.some(p => p.id === id));
    const p1 = selected[0];
    const p2 = selected[1];
    const p1Info = ALL_POWERUPS.find(p => p.id === p1);
    const p2Info = ALL_POWERUPS.find(p => p.id === p2);

    return {
      id: r.id,
      participant_id: r.student_id,
      participant_name: r.student_name,
      student_id: r.student_id,
      student_name: r.student_name,
      college: r.college || '—',
      track: r.track || 'track1',
      batch: r.batch,
      lab: r.lab || 'Lab 1',
      questions_solved: r.questions_solved || (r.status === 'COMPLETED' ? 3 : (r.status === 'PARTIAL' ? 1 : 0)),
      pool_size: getUnlockedPowerups(r.questions_solved || 0).length,
      unlocked_powerups: getUnlockedPowerups(r.questions_solved || 0),
      powerup_1: p1Info ? p1Info.name : (p1 || 'Not Selected'),
      powerup_2: p2Info ? p2Info.name : (p2 || 'Not Selected'),
      powerups_confirmed: !!r.powerups_confirmed && selected.length === 2,
      powerups_locked_at: r.powerups_locked_at,
      score: r.score || 0,
      duration_seconds: r.duration_seconds,
      formatted_time: r.formatted_time || '--:--',
      status: r.status
    };
  });

  res.json({
    stats,
    records
  });
});

// Admin: Excel Export of Power-Up Choices
// Suggested Excel Export Columns (from round-2-non-tech-round.md):
// Participant / Team | College | Track | Lab | Questions Solved | Pool Size | Power-Up 1 | Power-Up 2
app.get('/api/admin/export/excel', (req, res) => {
  const { track, lab, batch } = req.query;
  const dataset = readJSON(DATASET_FILE, []);

  let filtered = dataset;
  if (track && track !== 'all') {
    filtered = filtered.filter(r => (r.track || 'track1').toLowerCase() === track.toLowerCase());
  }
  if (lab && lab !== 'all') {
    filtered = filtered.filter(r => (r.lab || 'Lab 1').toLowerCase() === lab.toLowerCase());
  }
  if (batch && batch !== 'all') {
    filtered = filtered.filter(r => (r.batch || 'Batch A').toLowerCase() === batch.toLowerCase());
  }

  const headers = [
    'No.',
    'Participant / Team',
    'College',
    'Track',
    'Lab',
    'Questions Solved Count',
    'Questions Solved Breakdown',
    'Unlocked Power-Ups Count',
    'Unlocked Power-Ups Pool',
    'Selected Power-Up 1',
    'Selected Power-Up 2',
    'Total Score',
    'Duration',
    'Status',
    'Power-Ups Locked At'
  ];

  const rows = filtered.map((r, idx) => {
    const selected = (r.powerups_selected || []).filter(id => ALL_POWERUPS.some(p => p.id === id));
    const p1 = selected[0];
    const p2 = selected[1];
    const p1Name = ALL_POWERUPS.find(p => p.id === p1)?.name || (p1 || 'None');
    const p2Name = ALL_POWERUPS.find(p => p.id === p2)?.name || (p2 || 'None');
    const qSolved = r.questions_solved !== undefined ? r.questions_solved : (r.status === 'COMPLETED' ? 3 : (r.status === 'PARTIAL' ? 1 : 0));
    const poolSize = getUnlockedPowerups(qSolved).length;
    const trackName = (r.track === 'track1') ? 'Track 1 (FY Track)' : 'Track 2 (Other Years)';

    // Solved breakdown
    const solvedQuestionsList = [];
    if (r.stages) {
      if (r.stages.stage1?.valid) solvedQuestionsList.push(r.track === 'track1' ? 'Stage 1 (Hashi 10x10)' : 'Stage 1 (Hashi 10x10 Hard)');
      if (r.stages.stage2?.valid) solvedQuestionsList.push(r.track === 'track1' ? 'Stage 2 (Pig Fortress)' : 'Stage 2 (Deepfake Detective)');
      if (r.stages.stage3?.valid) solvedQuestionsList.push(r.track === 'track1' ? 'Stage 3 (Euler 25 Officers)' : 'Stage 3 (Zero to Crore)');
    } else if (r.status === 'COMPLETED') {
      solvedQuestionsList.push(r.track === 'track1' ? 'Stage 1, Stage 2, Stage 3' : 'Stage 1, Stage 2, Stage 3');
    }
    const questionsBreakdown = solvedQuestionsList.length > 0 ? solvedQuestionsList.join('; ') : 'None';

    // Unlocked pool names
    const unlockedPoolList = getUnlockedPowerups(qSolved);
    const unlockedPoolNames = unlockedPoolList
      .map(id => ALL_POWERUPS.find(p => p.id === id)?.name || id)
      .join('; ');

    return [
      idx + 1,
      `"${r.student_name} (${r.student_id})"`,
      `"${(r.college || '—').replace(/"/g, '""')}"`,
      `"${trackName}"`,
      `"${r.lab || 'Lab 1'}"`,
      qSolved,
      `"${questionsBreakdown}"`,
      poolSize,
      `"${unlockedPoolNames || 'None'}"`,
      `"${p1Name}"`,
      `"${p2Name}"`,
      r.score || 0,
      `"${r.formatted_time || ''}"`,
      `"${r.status}"`,
      `"${r.powerups_locked_at || (r.powerups_confirmed ? 'Confirmed' : 'Pending')}"`
    ];
  });

  // Include UTF-8 BOM (\uFEFF) for direct double-click opening in Microsoft Excel
  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="round2_powerup_choices_${Date.now()}.csv"`);
  res.send(csvContent);
});

// Admin Authentication Endpoint (Configured dynamically in data/room_config.json)
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  const room = readJSON(ROOM_FILE, {});
  const configuredPassword = room.admin_password || process.env.ADMIN_PASSWORD || 'admin123';

  if (password && String(password).trim() === String(configuredPassword).trim()) {
    return res.json({
      success: true,
      message: 'Admin authentication successful',
      role: 'admin'
    });
  }

  return res.status(401).json({
    success: false,
    error: 'Incorrect administrative password. Please try again.'
  });
});

// 1. Get Puzzles
app.get('/api/puzzles', (req, res) => {
  const puzzles = readJSON(PUZZLES_FILE, []);
  // Return puzzle metadata without solutions
  const safePuzzles = puzzles.map(p => ({
    id: p.id,
    name: p.name,
    difficulty: p.difficulty,
    width: p.width,
    height: p.height,
    islandsCount: p.islands.length,
    islands: p.islands
  }));
  res.json(safePuzzles);
});

// 2. Get specific puzzle
app.get('/api/puzzles/:id', (req, res) => {
  const puzzles = readJSON(PUZZLES_FILE, []);
  const found = puzzles.find(p => p.id === req.params.id);
  if (!found) return res.status(404).json({ error: 'Puzzle not found' });
  res.json({
    id: found.id,
    name: found.name,
    difficulty: found.difficulty,
    width: found.width,
    height: found.height,
    islands: found.islands
  });
});

// 3. Room configuration
app.get('/api/room', (req, res) => {
  const room = readJSON(ROOM_FILE, {
    active_track: 'track2',
    active_puzzle_id: 'puzzle-10x10-pro',
    quiz_title: 'Codestars Non-Tech Tri-Challenge • 2nd Track',
    batches: ['Batch A', 'Batch B', 'Batch C'],
    time_limit_seconds: 600,
    allow_hints: true,
    status: 'active'
  });

  const puzzles = readJSON(PUZZLES_FILE, []);
  const activePuzzle = puzzles.find(p => p.id === room.active_puzzle_id) || puzzles[0];

  res.json({
    ...room,
    track2_config: TRACK2_CONFIG,
    puzzle: activePuzzle ? {
      id: activePuzzle.id,
      name: activePuzzle.name,
      difficulty: activePuzzle.difficulty,
      width: activePuzzle.width,
      height: activePuzzle.height,
      islands: activePuzzle.islands
    } : null
  });
});

app.post('/api/room', (req, res) => {
  const current = readJSON(ROOM_FILE, {});
  const updated = {
    ...current,
    ...req.body
  };
  writeJSON(ROOM_FILE, updated);
  res.json({ success: true, room: updated });
});

// 4. Student Starts Attempt
app.post('/api/student/start', (req, res) => {
  const { batch, student_id, student_name, puzzle_id } = req.body;
  if (!batch || !student_id || !student_name) {
    return res.status(400).json({ error: 'Batch, student ID, and name are required' });
  }

  const room = readJSON(ROOM_FILE, {});
  const targetPuzzleId = puzzle_id || room.active_puzzle_id || 'puzzle-7x7-easy';
  const puzzles = readJSON(PUZZLES_FILE, []);
  const puzzle = puzzles.find(p => p.id === targetPuzzleId) || puzzles[0];

  const dataset = readJSON(DATASET_FILE, []);
  const attemptId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const startTime = new Date().toISOString();

  // Create attempt entry
  const newAttempt = {
    id: attemptId,
    batch: batch.trim(),
    student_id: student_id.trim().toUpperCase(),
    student_name: student_name.trim(),
    puzzle_id: puzzle.id,
    puzzle_name: puzzle.name,
    difficulty: puzzle.difficulty,
    status: 'IN_PROGRESS',
    start_time: startTime,
    finish_time: null,
    duration_seconds: null,
    formatted_time: '--:--',
    moves_count: 0,
    mistakes_count: 0,
    undos_count: 0,
    tab_switches: 0,
    islands_completed: 0,
    total_islands: puzzle.islands.length,
    score: 0,
    bridges: []
  };

  dataset.push(newAttempt);
  writeJSON(DATASET_FILE, dataset);

  res.json({
    attempt_id: attemptId,
    start_time: startTime,
    time_limit_seconds: room.time_limit_seconds || 600,
    puzzle: {
      id: puzzle.id,
      name: puzzle.name,
      difficulty: puzzle.difficulty,
      width: puzzle.width,
      height: puzzle.height,
      islands: puzzle.islands
    }
  });
});

// 5. Student Heartbeat / Live Progress
app.post('/api/student/heartbeat', (req, res) => {
  const {
    attempt_id,
    moves_count,
    mistakes_count,
    undos_count,
    tab_switches,
    islands_completed,
    elapsed_seconds
  } = req.body;

  if (!attempt_id) return res.status(400).json({ error: 'attempt_id required' });

  const dataset = readJSON(DATASET_FILE, []);
  const index = dataset.findIndex(a => a.id === attempt_id);
  if (index !== -1 && dataset[index].status === 'IN_PROGRESS') {
    dataset[index].moves_count = moves_count || dataset[index].moves_count;
    dataset[index].mistakes_count = mistakes_count || dataset[index].mistakes_count;
    dataset[index].undos_count = undos_count || dataset[index].undos_count;
    dataset[index].tab_switches = tab_switches || dataset[index].tab_switches;
    dataset[index].islands_completed = islands_completed || dataset[index].islands_completed;
    dataset[index].duration_seconds = elapsed_seconds || dataset[index].duration_seconds;
    dataset[index].formatted_time = formatDuration(dataset[index].duration_seconds);
    writeJSON(DATASET_FILE, dataset);
  }

  res.json({ ok: true });
});

// 6. Student Submits Solution
app.post('/api/student/submit', (req, res) => {
  const {
    attempt_id,
    bridges,
    duration_seconds,
    moves_count,
    mistakes_count,
    undos_count,
    tab_switches
  } = req.body;

  const dataset = readJSON(DATASET_FILE, []);
  const attemptIndex = dataset.findIndex(a => a.id === attempt_id);
  if (attemptIndex === -1) {
    return res.status(404).json({ error: 'Attempt not found' });
  }

  const attempt = dataset[attemptIndex];
  const puzzles = readJSON(PUZZLES_FILE, []);
  const puzzle = puzzles.find(p => p.id === attempt.puzzle_id);

  if (!puzzle) return res.status(404).json({ error: 'Puzzle not found' });

  // Validate the solution
  const validation = validateHashiSolution(puzzle, bridges || []);
  const finishTime = new Date().toISOString();
  const finalDuration = Math.max(1, parseFloat(duration_seconds) || 1);

  if (validation.valid) {
    attempt.status = 'COMPLETED';
    attempt.finish_time = finishTime;
    attempt.duration_seconds = finalDuration;
    attempt.formatted_time = formatDuration(finalDuration);
    attempt.moves_count = moves_count || attempt.moves_count;
    attempt.mistakes_count = mistakes_count || attempt.mistakes_count;
    attempt.undos_count = undos_count || attempt.undos_count;
    attempt.tab_switches = tab_switches || attempt.tab_switches;
    attempt.islands_completed = puzzle.islands.length;
    attempt.score = computeScore(finalDuration, attempt.mistakes_count, puzzle.islands.length);
    attempt.bridges = bridges;
  } else {
    attempt.status = 'FAILED';
    attempt.finish_time = finishTime;
    attempt.duration_seconds = finalDuration;
    attempt.formatted_time = formatDuration(finalDuration);
    attempt.moves_count = moves_count || attempt.moves_count;
    attempt.mistakes_count = (mistakes_count || 0) + 1;
    attempt.tab_switches = tab_switches || attempt.tab_switches;
    attempt.score = Math.max(0, 50 - attempt.mistakes_count * 5);
  }

  dataset[attemptIndex] = attempt;
  writeJSON(DATASET_FILE, dataset);

  // Calculate student rank in their batch
  const batchCompleted = dataset
    .filter(a => a.batch === attempt.batch && a.status === 'COMPLETED')
    .sort((a, b) => a.duration_seconds - b.duration_seconds);
  const rank = batchCompleted.findIndex(a => a.id === attempt.id) + 1;

  res.json({
    success: true,
    valid: validation.valid,
    reason: validation.reason || 'Perfect solution! All bridges verified.',
    attempt,
    rank: rank > 0 ? rank : null,
    total_in_batch: batchCompleted.length
  });
});

// ----------------------------------------------------
// TRACK 2 SPECIFIC ENDPOINTS
// ----------------------------------------------------

// Student Starts Track 2 Attempt
app.post('/api/track2/start', (req, res) => {
  const { batch, student_id, student_name } = req.body;
  if (!batch || !student_id || !student_name) {
    return res.status(400).json({ error: 'Batch, student ID, and name are required' });
  }

  const puzzles = readJSON(PUZZLES_FILE, []);
  const puzzle = puzzles.find(p => p.id === 'puzzle-10x10-pro') || puzzles[0];

  const dataset = readJSON(DATASET_FILE, []);
  const attemptId = `att_tr2_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const startTime = new Date().toISOString();

  const newAttempt = {
    id: attemptId,
    track: 'track2',
    batch: batch.trim(),
    student_id: student_id.trim().toUpperCase(),
    student_name: student_name.trim(),
    puzzle_id: puzzle.id,
    puzzle_name: '10x10 Championship',
    difficulty: 'Hard',
    status: 'IN_PROGRESS',
    current_stage: 1,
    stages: {
      stage1: { status: 'PENDING', score: 0 },
      stage2: { status: 'PENDING', score: 0 },
      stage3: { status: 'PENDING', score: 0 }
    },
    start_time: startTime,
    finish_time: null,
    duration_seconds: null,
    formatted_time: '--:--',
    moves_count: 0,
    mistakes_count: 0,
    undos_count: 0,
    tab_switches: 0,
    score: 0,
    answers: {}
  };

  dataset.push(newAttempt);
  writeJSON(DATASET_FILE, dataset);

  res.json({
    attempt_id: attemptId,
    track: 'track2',
    start_time: startTime,
    time_limit_seconds: 600,
    config: TRACK2_CONFIG,
    puzzle: {
      id: puzzle.id,
      name: puzzle.name,
      difficulty: puzzle.difficulty,
      width: puzzle.width,
      height: puzzle.height,
      islands: puzzle.islands
    }
  });
});

// Intermediate Stage Validation for Track 2
app.post('/api/track2/validate-stage', (req, res) => {
  const { stage, data } = req.body;
  if (stage === 1 || stage === 'stage1') {
    const puzzles = readJSON(PUZZLES_FILE, []);
    const puzzle = puzzles.find(p => p.id === 'puzzle-10x10-pro') || puzzles[0];
    const result = validateHashiSolution(puzzle, data?.bridges || []);
    return res.json({ stage: 1, ...result });
  } else if (stage === 2 || stage === 'stage2') {
    const result = validateDeepfakeSolution(data);
    return res.json({ stage: 2, ...result });
  } else if (stage === 3 || stage === 'stage3') {
    const result = validateZeroToCroreSolution(data);
    return res.json({ stage: 3, ...result });
  }
  res.status(400).json({ error: 'Invalid stage parameter' });
});

// Final Track 2 Multi-Stage Submission
// 7. Leaderboard API
app.get('/api/leaderboard', (req, res) => {
  const { batch, track } = req.query;
  const dataset = readJSON(DATASET_FILE, []);

  let filtered = dataset;
  if (batch && batch !== 'all') {
    filtered = filtered.filter(a => a.batch.toLowerCase() === batch.toLowerCase());
  }
  if (track && track !== 'all') {
    filtered = filtered.filter(a => (a.track || 'track1').toLowerCase() === track.toLowerCase());
  }

  // Sort: COMPLETED first, then score descending, then duration ascending, then mistakes ascending
  const sorted = [...filtered].sort((a, b) => {
    if (a.status === 'COMPLETED' && b.status !== 'COMPLETED') return -1;
    if (a.status !== 'COMPLETED' && b.status === 'COMPLETED') return 1;
    if (a.status === 'COMPLETED' && b.status === 'COMPLETED') {
      if ((b.score || 0) !== (a.score || 0)) {
        return (b.score || 0) - (a.score || 0);
      }
      if (a.duration_seconds !== b.duration_seconds) {
        return a.duration_seconds - b.duration_seconds;
      }
      return (a.mistakes_count || 0) - (b.mistakes_count || 0);
    }
    return (b.score || 0) - (a.score || 0);
  });

  const ranked = sorted.map((item, idx) => ({
    ...item,
    rank: item.status === 'COMPLETED' ? idx + 1 : '-'
  }));

  res.json({
    batch: batch || 'all',
    track: track || 'all',
    total_participants: ranked.length,
    completed_count: ranked.filter(r => r.status === 'COMPLETED').length,
    leaderboard: ranked
  });
});

// 8. Dataset API (Search, Filter, Metrics)
app.get('/api/dataset', (req, res) => {
  const { batch, status, search, track, sort = 'rank', order = 'asc' } = req.query;
  const dataset = readJSON(DATASET_FILE, []);

  let filtered = dataset;
  if (batch && batch !== 'all') {
    filtered = filtered.filter(r => r.batch.toLowerCase() === batch.toLowerCase());
  }
  if (status && status !== 'all') {
    filtered = filtered.filter(r => r.status.toLowerCase() === status.toLowerCase());
  }
  if (track && track !== 'all') {
    filtered = filtered.filter(r => (r.track || 'track1').toLowerCase() === track.toLowerCase());
  }
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(r =>
      r.student_name.toLowerCase().includes(q) ||
      r.student_id.toLowerCase().includes(q) ||
      (r.batch && r.batch.toLowerCase().includes(q))
    );
  }

  // Sorting
  filtered.sort((a, b) => {
    let valA = a[sort];
    let valB = b[sort];
    if (sort === 'rank' || sort === 'duration_seconds') {
      valA = a.status === 'COMPLETED' ? (a.duration_seconds || 999999) : 9999999;
      valB = b.status === 'COMPLETED' ? (b.duration_seconds || 999999) : 9999999;
    } else if (sort === 'score') {
      valA = a.score || 0;
      valB = b.score || 0;
      return order === 'asc' ? valA - valB : valB - valA;
    }
    if (valA < valB) return order === 'asc' ? -1 : 1;
    if (valA > valB) return order === 'asc' ? 1 : -1;
    return 0;
  });

  // Calculate summary metrics
  const completed = filtered.filter(r => r.status === 'COMPLETED');
  const total = filtered.length;
  const avgDuration = completed.length > 0
    ? (completed.reduce((acc, c) => acc + c.duration_seconds, 0) / completed.length).toFixed(1)
    : 0;
  const fastest = completed.length > 0
    ? Math.min(...completed.map(c => c.duration_seconds))
    : 0;

  res.json({
    total,
    summary: {
      total_students: total,
      completed_count: completed.length,
      completion_rate: total > 0 ? Math.round((completed.length / total) * 100) : 0,
      avg_duration_seconds: parseFloat(avgDuration),
      avg_formatted_time: formatDuration(parseFloat(avgDuration)),
      fastest_seconds: fastest,
      fastest_formatted_time: formatDuration(fastest)
    },
    records: filtered
  });
});

// 9. Export CSV
app.get('/api/dataset/export/csv', (req, res) => {
  const { batch, track } = req.query;
  const dataset = readJSON(DATASET_FILE, []);
  let filtered = dataset;
  if (batch && batch !== 'all') {
    filtered = filtered.filter(r => r.batch.toLowerCase() === batch.toLowerCase());
  }
  if (track && track !== 'all') {
    filtered = filtered.filter(r => (r.track || 'track1').toLowerCase() === track.toLowerCase());
  }

  // Sort by completed & time
  filtered.sort((a, b) => {
    if (a.status === 'COMPLETED' && b.status !== 'COMPLETED') return -1;
    if (a.status !== 'COMPLETED' && b.status === 'COMPLETED') return 1;
    return (b.score || 0) - (a.score || 0) || (a.duration_seconds || 999999) - (b.duration_seconds || 999999);
  });

  const headers = [
    'Rank',
    'Track',
    'Lab',
    'Student ID',
    'Student Name',
    'Batch',
    'Questions Solved',
    'Pool Size',
    'Power-Up 1',
    'Power-Up 2',
    'Puzzle / Event',
    'Status',
    'Duration (Seconds)',
    'Time (mm:ss)',
    'Moves',
    'Mistakes',
    'Tab Switches',
    'Total Score',
    'Start Time',
    'Finish Time'
  ];

  const rows = filtered.map((r, i) => {
    const selected = (r.powerups_selected || []).filter(id => ALL_POWERUPS.some(p => p.id === id));
    const p1 = selected[0];
    const p2 = selected[1];
    const p1Name = ALL_POWERUPS.find(p => p.id === p1)?.name || (p1 || '-');
    const p2Name = ALL_POWERUPS.find(p => p.id === p2)?.name || (p2 || '-');
    const qSolved = r.questions_solved || (r.status === 'COMPLETED' ? 3 : (r.status === 'PARTIAL' ? 1 : 0));
    const poolSize = getUnlockedPowerups(qSolved).length;

    return [
      r.status === 'COMPLETED' ? i + 1 : 'N/A',
      `"${r.track || 'track1'}"`,
      `"${r.lab || 'Lab 1'}"`,
      `"${r.student_id}"`,
      `"${r.student_name.replace(/"/g, '""')}"`,
      `"${r.batch}"`,
      qSolved,
      poolSize,
      `"${p1Name}"`,
      `"${p2Name}"`,
      `"${r.track === 'track2' ? 'Codestars Tri-Challenge' : (r.puzzle_name || 'FY Track Challenge')}"`,
      r.status,
      r.duration_seconds ? r.duration_seconds.toFixed(1) : '',
      `"${r.formatted_time || ''}"`,
      r.moves_count || 0,
      r.mistakes_count || 0,
      r.tab_switches || 0,
      r.score || 0,
      `"${r.start_time || ''}"`,
      `"${r.finish_time || ''}"`
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="hashi_quiz_dataset_${batch || 'all'}_${track || 'all'}_${Date.now()}.csv"`);
  res.send(csvContent);
});

// 10. Export JSON
app.get('/api/dataset/export/json', (req, res) => {
  const { batch } = req.query;
  const dataset = readJSON(DATASET_FILE, []);
  let filtered = dataset;
  if (batch && batch !== 'all') {
    filtered = filtered.filter(r => r.batch.toLowerCase() === batch.toLowerCase());
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="hashi_quiz_dataset_${batch || 'all'}_${Date.now()}.json"`);
  res.send(JSON.stringify(filtered, null, 2));
});

// 11. Seed 30 Demo Students for a Cohort (Batch A or Batch B)
app.post('/api/dataset/seed', (req, res) => {
  const batchName = req.body.batch || 'Batch A';
  const count = parseInt(req.body.count, 10) || 30;

  const dataset = readJSON(DATASET_FILE, []);
  const room = readJSON(ROOM_FILE, {});
  const puzzles = readJSON(PUZZLES_FILE, []);
  const activePuzzle = puzzles.find(p => p.id === room.active_puzzle_id) || puzzles[0];

  const firstNames = [
    'Aarav', 'Diya', 'Rohan', 'Ananya', 'Vikram', 'Priya', 'Siddharth', 'Sneha',
    'Kabir', 'Ishaan', 'Tanvi', 'Aditya', 'Meera', 'Arjun', 'Riya', 'Karan',
    'Neha', 'Rahul', 'Pooja', 'Ayush', 'Shreya', 'Devansh', 'Kavya', 'Dhruv',
    'Nisha', 'Pranav', 'Anika', 'Manish', 'Sanya', 'Varun', 'Simran', 'Kunal'
  ];
  const lastNames = [
    'Sharma', 'Patel', 'Verma', 'Iyer', 'Singh', 'Nair', 'Mehta', 'Rao',
    'Joshi', 'Gupta', 'Kulkarni', 'Reddy', 'Nambiar', 'Das', 'Sen', 'Kapoor',
    'Chopra', 'Malhotra', 'Bhatia', 'Menon', 'Pillai', 'Saxena', 'Mukherjee', 'Banerjee'
  ];

  // Remove existing entries for this batch to cleanly re-seed 30 students
  const filteredDataset = dataset.filter(r => r.batch.toLowerCase() !== batchName.toLowerCase());

  const newRecords = [];
  const baseTime = Date.now() - 3600000; // 1 hour ago

  for (let i = 1; i <= count; i++) {
    const fName = firstNames[(i - 1) % firstNames.length];
    const lName = lastNames[(i * 3) % lastNames.length];
    const studentName = `${fName} ${lName}`;
    const studentId = `${batchName.replace(/\s+/g, '').toUpperCase()}-${String(i).padStart(3, '0')}`;

    // Most complete (27 out of 30), a few in-progress
    const isCompleted = i <= 28;
    // Varied times: between 85s (1m25s) and 420s (7m00s)
    const durationSeconds = isCompleted ? Math.round((85 + Math.pow(i / count, 1.4) * 310 + (Math.random() * 20 - 10)) * 10) / 10 : Math.round((120 + Math.random() * 80) * 10) / 10;
    const moves = Math.round(activePuzzle.islands.length * 2.2 + (Math.random() * 8));
    const mistakes = Math.floor(Math.random() * 3);
    const undos = Math.floor(Math.random() * 4);
    const tabSwitches = Math.random() < 0.2 ? Math.floor(Math.random() * 2) + 1 : 0;
    const startTimestamp = new Date(baseTime + i * 45000).toISOString();
    const finishTimestamp = isCompleted ? new Date(new Date(startTimestamp).getTime() + durationSeconds * 1000).toISOString() : null;

    newRecords.push({
      id: `seed_${batchName.replace(/\s+/g, '_')}_${i}`,
      batch: batchName,
      student_id: studentId,
      student_name: studentName,
      puzzle_id: activePuzzle.id,
      puzzle_name: activePuzzle.name,
      difficulty: activePuzzle.difficulty,
      status: isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
      start_time: startTimestamp,
      finish_time: finishTimestamp,
      duration_seconds: isCompleted ? durationSeconds : durationSeconds,
      formatted_time: formatDuration(durationSeconds),
      moves_count: moves,
      mistakes_count: mistakes,
      undos_count: undos,
      tab_switches: tabSwitches,
      islands_completed: isCompleted ? activePuzzle.islands.length : Math.floor(activePuzzle.islands.length * 0.6),
      total_islands: activePuzzle.islands.length,
      score: isCompleted ? computeScore(durationSeconds, mistakes, activePuzzle.islands.length) : 0,
      bridges: []
    });
  }

  // Save merged
  const finalDataset = [...filteredDataset, ...newRecords];
  writeJSON(DATASET_FILE, finalDataset);

  res.json({
    success: true,
    message: `Successfully seeded ${count} students for ${batchName}`,
    batch: batchName,
    count
  });
});

// 12. Clear dataset
app.delete('/api/dataset', (req, res) => {
  const { batch } = req.query;
  if (batch && batch !== 'all') {
    const dataset = readJSON(DATASET_FILE, []);
    const remaining = dataset.filter(r => r.batch.toLowerCase() !== batch.toLowerCase());
    writeJSON(DATASET_FILE, remaining);
    res.json({ success: true, message: `Cleared records for ${batch}` });
  } else {
    writeJSON(DATASET_FILE, []);
    res.json({ success: true, message: 'All dataset records cleared' });
  }
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=================================================`);
  console.log(` Bridges (Hashi) Quiz & Dataset Platform running!`);
  console.log(` Listening on port: ${PORT}`);
  console.log(`=================================================`);
});
