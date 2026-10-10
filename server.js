const { validateHashiSolution, validatePigFortressSolution, validateOfficersSolution, validateDeepfakeSolution, validateZeroToCroreSolution } = require('./server/validation.cjs');
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
app.use(express.static(path.join(__dirname, 'dist')));

// Paths
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
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
    const temporary = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(temporary, file);
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
  {
    id: 'sweet_sabotage',
    name: 'Sweet Sabotage',
    tier: 3,
    unlocked_at_solved: 3,
    icon: '💣',
    badge: 'Ultimate Debuff',
    description: 'Use it on any one participant sitting in your lab. That contestant\'s final team points are reduced by 10%.'
  }
];

function getUnlockedPowerups(questionsSolved) {
  if (questionsSolved >= 3) {
    return ALL_POWERUPS.map(p => p.id); // 5 power-ups
  } else if (questionsSolved >= 2) {
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
      pieces: ['♔', '♕', '♖', '♗', '♘']
    }
  ]
};



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
      { questions_solved: 3, pool_size: 5, unlocked: ['time_cracker', 'topic_finder', 'penalty_sweeper', 'jumper_points', 'sweet_sabotage'] }
    ]
  });
});

// ----------------------------------------------------
// ROUND 2 PARTICIPANT WORKFLOW ENDPOINTS
// ----------------------------------------------------

require('./server/round2.cjs')(app, { readJSON, writeJSON, DATASET_FILE, PUZZLES_FILE, ROOM_FILE, TRACK1_CONFIG, TRACK2_CONFIG, ALL_POWERUPS, getUnlockedPowerups, formatDuration });

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
    confirmed_powerups_count: filtered.filter(r => r.powerups_confirmed).length,
    powerup_counts: {
      time_cracker: 0,
      topic_finder: 0,
      penalty_sweeper: 0,
      jumper_points: 0,
      sweet_sabotage: 0
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
    const p1 = r.powerups_selected?.[0];
    const p2 = r.powerups_selected?.[1];
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
      pool_size: r.pool_size || (r.questions_solved === 3 ? 5 : (r.questions_solved === 2 ? 4 : (r.questions_solved === 1 ? 2 : 0))),
      unlocked_powerups: r.unlocked_powerups || getUnlockedPowerups(r.questions_solved || (r.status === 'COMPLETED' ? 3 : 0)),
      powerup_1: p1Info ? p1Info.name : (p1 || 'Not Selected'),
      powerup_2: p2Info ? p2Info.name : (p2 || 'Not Selected'),
      sabotage_target: r.sabotage_target || '-',
      powerups_confirmed: !!r.powerups_confirmed,
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
    'Sabotage Target',
    'Total Score',
    'Duration',
    'Status',
    'Power-Ups Locked At'
  ];

  const rows = filtered.map((r, idx) => {
    const p1 = r.powerups_selected?.[0];
    const p2 = r.powerups_selected?.[1];
    const p1Name = ALL_POWERUPS.find(p => p.id === p1)?.name || (p1 || 'None');
    const p2Name = ALL_POWERUPS.find(p => p.id === p2)?.name || (p2 || 'None');
    const qSolved = r.questions_solved !== undefined ? r.questions_solved : (r.status === 'COMPLETED' ? 3 : (r.status === 'PARTIAL' ? 1 : 0));
    const poolSize = r.pool_size !== undefined ? r.pool_size : (qSolved === 3 ? 5 : (qSolved === 2 ? 4 : (qSolved === 1 ? 2 : 0)));
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
    const unlockedPoolList = (r.unlocked_powerups && r.unlocked_powerups.length > 0)
      ? r.unlocked_powerups
      : getUnlockedPowerups(qSolved);
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
      `"${(r.sabotage_target || '-').replace(/"/g, '""')}"`,
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
    ...Object.fromEntries(Object.entries(room).filter(([key]) => key !== 'admin_password')),
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

app.post(['/api/student/start', '/api/student/heartbeat', '/api/student/submit', '/api/track2/start', '/api/track2/validate-stage', '/api/track2/submit'], (req, res) => res.status(410).json({ error: 'Use the authenticated /api/round2 workflow.' }));

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
    'Sabotage Target',
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
    const p1 = r.powerups_selected?.[0];
    const p2 = r.powerups_selected?.[1];
    const p1Name = ALL_POWERUPS.find(p => p.id === p1)?.name || (p1 || '-');
    const p2Name = ALL_POWERUPS.find(p => p.id === p2)?.name || (p2 || '-');
    const qSolved = r.questions_solved || (r.status === 'COMPLETED' ? 3 : (r.status === 'PARTIAL' ? 1 : 0));
    const poolSize = r.pool_size || (qSolved === 3 ? 5 : (qSolved === 2 ? 4 : (qSolved === 1 ? 2 : 0)));

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
      `"${(r.sabotage_target || '-').replace(/"/g, '""')}"`,
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

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ valid: false, error: 'The request could not be saved or processed. Please retry.' });
});

// Start Server
if (require.main === module) app.listen(PORT, '0.0.0.0', () => {
  console.log(`=================================================`);
  console.log(` Bridges (Hashi) Quiz & Dataset Platform running!`);
  console.log(` Listening on port: ${PORT}`);
  console.log(`=================================================`);
});

module.exports = app;
