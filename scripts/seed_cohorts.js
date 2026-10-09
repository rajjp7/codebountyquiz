const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATASET_FILE = path.join(DATA_DIR, 'dataset.json');
const PUZZLES_FILE = path.join(DATA_DIR, 'puzzles.json');

const ALL_POWERUPS = [
  'time_cracker',
  'topic_finder',
  'penalty_sweeper',
  'jumper_points',
  'sweet_sabotage'
];

function getUnlockedPowerups(solved) {
  if (solved >= 3) return ALL_POWERUPS.slice();
  if (solved >= 2) return ALL_POWERUPS.slice(0, 4);
  if (solved >= 1) return ALL_POWERUPS.slice(0, 2);
  return [];
}

function seedCohortData() {
  const puzzles = fs.existsSync(PUZZLES_FILE) ? JSON.parse(fs.readFileSync(PUZZLES_FILE, 'utf8')) : [];
  const puzzleFY = puzzles.find(p => p.id === 'puzzle-fy-10x10') || puzzles[0];
  const puzzle10x10 = puzzles.find(p => p.id === 'puzzle-10x10-pro') || puzzles[0];

  const firstNames = [
    'Aarav', 'Diya', 'Rohan', 'Ananya', 'Vikram', 'Priya', 'Siddharth', 'Sneha',
    'Kabir', 'Ishaan', 'Tanvi', 'Aditya', 'Meera', 'Arjun', 'Riya', 'Karan',
    'Neha', 'Rahul', 'Pooja', 'Ayush', 'Shreya', 'Devansh', 'Kavya', 'Dhruv',
    'Nisha', 'Pranav', 'Anika', 'Manish', 'Sanya', 'Varun'
  ];
  const lastNames = [
    'Sharma', 'Patel', 'Verma', 'Iyer', 'Singh', 'Nair', 'Mehta', 'Rao',
    'Joshi', 'Gupta', 'Kulkarni', 'Reddy', 'Nambiar', 'Das', 'Sen', 'Kapoor'
  ];

  const labs = ['Lab 1 (Hall A)', 'Lab 2 (Ground Floor)', 'Lab 3 (First Floor)', 'Lab 4 (Second Floor)'];

  const formatDuration = (sec) => {
    if (!sec) return '--:--';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
  };

  const records = [];
  const baseTime = Date.now() - 3600000;

  for (const batchName of ['Batch A', 'Batch B']) {
    // 1. Seed 30 students for Track 1: First Years (FY Track)
    for (let i = 1; i <= 30; i++) {
      const fName = firstNames[(i - 1) % firstNames.length];
      const lName = lastNames[(i * 3) % lastNames.length];
      const assignedLab = labs[(i - 1) % labs.length];
      
      const isCompleted = i <= 24;
      const isPartial = !isCompleted && i <= 28;
      const questionsSolved = isCompleted ? 3 : (isPartial ? (i % 2 === 0 ? 2 : 1) : 0);
      const unlocked = getUnlockedPowerups(questionsSolved);

      const durationSeconds = isCompleted
        ? Math.round((240 + Math.pow(i / 30, 1.3) * 620 + (Math.random() * 25 - 12)) * 10) / 10
        : (isPartial ? Math.round((450 + Math.random() * 200) * 10) / 10 : Math.round((600 + Math.random() * 120) * 10) / 10);

      const startTimestamp = new Date(baseTime + i * 45000).toISOString();
      const finishTimestamp = (isCompleted || isPartial) ? new Date(new Date(startTimestamp).getTime() + durationSeconds * 1000).toISOString() : null;

      // Power-up selections (pick 2 if unlocked >= 2)
      let selectedPowerups = [];
      let sabotageTarget = null;
      let powerupsConfirmed = false;

      if (unlocked.length >= 2) {
        if (unlocked.includes('sweet_sabotage') && i % 3 === 0) {
          selectedPowerups = ['sweet_sabotage', unlocked[i % (unlocked.length - 1)]];
          sabotageTarget = `${labs[(i + 1) % labs.length]} - Seat ${(i * 3) % 30 + 1}`;
        } else {
          selectedPowerups = [unlocked[0], unlocked[Math.min(unlocked.length - 1, 1 + (i % (unlocked.length - 1)))]];
        }
        powerupsConfirmed = true;
      }

      const stage1Score = questionsSolved >= 1 ? 1000 : 0;
      const stage2Score = questionsSolved >= 2 ? 1200 : 0;
      const stage3Score = questionsSolved >= 3 ? 1500 : 0;
      const totalScore = stage1Score + stage2Score + stage3Score + (isCompleted ? Math.max(0, Math.floor((1800 - durationSeconds) * 0.8)) : 0);

      records.push({
        id: `seed_${batchName.replace(/\s+/g, '_')}_tr1_${i}`,
        track: 'track1',
        batch: batchName,
        lab: assignedLab,
        student_id: `${batchName.replace(/\s+/g, '').toUpperCase()}-FY-${String(i).padStart(3, '0')}`,
        student_name: `${fName} ${lName}`,
        puzzle_id: 'puzzle-fy-10x10',
        puzzle_name: 'FY Track Challenge',
        difficulty: 'Classic',
        status: isCompleted ? 'COMPLETED' : (isPartial ? 'PARTIAL' : 'IN_PROGRESS'),
        questions_solved: questionsSolved,
        pool_size: unlocked.length,
        unlocked_powerups: unlocked,
        powerups_selected: selectedPowerups,
        powerups_confirmed: powerupsConfirmed,
        powerups_locked_at: powerupsConfirmed ? finishTimestamp : null,
        sabotage_target: sabotageTarget,
        start_time: startTimestamp,
        finish_time: finishTimestamp,
        duration_seconds: durationSeconds,
        formatted_time: formatDuration(durationSeconds),
        moves_count: Math.round(48 + Math.random() * 14),
        mistakes_count: Math.floor(Math.random() * 3),
        undos_count: Math.floor(Math.random() * 4),
        tab_switches: Math.random() < 0.15 ? 1 : 0,
        score: totalScore,
        stages: {
          stage1: { valid: questionsSolved >= 1, score: stage1Score, title: '1. Hashi 10×10 Grid' },
          stage2: {
            valid: questionsSolved >= 2,
            score: stage2Score,
            vault_pin: questionsSolved >= 2 ? 1788 : 0,
            title: '2. The Pig Fortress Problem'
          },
          stage3: {
            valid: questionsSolved >= 3,
            score: stage3Score,
            title: '3. The 25 Officer Puzzle'
          }
        }
      });
    }

    // 2. Seed 30 students for Track 2: All Other Years
    for (let i = 1; i <= 30; i++) {
      const fName = firstNames[(i + 4) % firstNames.length];
      const lName = lastNames[(i * 5) % lastNames.length];
      const assignedLab = labs[(i + 2) % labs.length];

      const isCompleted = i <= 22;
      const isPartial = !isCompleted && i <= 27;
      const questionsSolved = isCompleted ? 3 : (isPartial ? (i % 2 === 0 ? 2 : 1) : 0);
      const unlocked = getUnlockedPowerups(questionsSolved);

      const durationSeconds = isCompleted
        ? Math.round((360 + Math.pow(i / 30, 1.3) * 720 + (Math.random() * 30 - 15)) * 10) / 10
        : (isPartial ? Math.round((520 + Math.random() * 220) * 10) / 10 : Math.round((700 + Math.random() * 150) * 10) / 10);

      const startTimestamp = new Date(baseTime + (i + 30) * 45000).toISOString();
      const finishTimestamp = (isCompleted || isPartial) ? new Date(new Date(startTimestamp).getTime() + durationSeconds * 1000).toISOString() : null;

      let selectedPowerups = [];
      let sabotageTarget = null;
      let powerupsConfirmed = false;

      if (unlocked.length >= 2) {
        if (unlocked.includes('sweet_sabotage') && i % 2 === 0) {
          selectedPowerups = ['sweet_sabotage', 'jumper_points'];
          sabotageTarget = `${labs[(i + 1) % labs.length]} - Seat ${(i * 4) % 30 + 1}`;
        } else {
          selectedPowerups = [unlocked[0], unlocked[Math.min(unlocked.length - 1, 1 + (i % 3))]];
        }
        powerupsConfirmed = true;
      }

      const stage1Score = questionsSolved >= 1 ? 1200 : 0;
      const stage2Score = questionsSolved >= 2 ? 1200 : 0;
      const stage3Score = questionsSolved >= 3 ? 1500 : 0;
      const totalScore = stage1Score + stage2Score + stage3Score + (isCompleted ? Math.max(0, Math.floor((1800 - durationSeconds) * 0.9)) : 0);

      records.push({
        id: `seed_${batchName.replace(/\s+/g, '_')}_tr2_${i}`,
        track: 'track2',
        batch: batchName,
        lab: assignedLab,
        student_id: `${batchName.replace(/\s+/g, '').toUpperCase()}-T2-${String(i).padStart(3, '0')}`,
        student_name: `${fName} ${lName}`,
        puzzle_id: 'puzzle-10x10-pro',
        puzzle_name: 'Codestars Tri-Challenge',
        difficulty: 'Hard',
        status: isCompleted ? 'COMPLETED' : (isPartial ? 'PARTIAL' : 'IN_PROGRESS'),
        questions_solved: questionsSolved,
        pool_size: unlocked.length,
        unlocked_powerups: unlocked,
        powerups_selected: selectedPowerups,
        powerups_confirmed: powerupsConfirmed,
        powerups_locked_at: powerupsConfirmed ? finishTimestamp : null,
        sabotage_target: sabotageTarget,
        start_time: startTimestamp,
        finish_time: finishTimestamp,
        duration_seconds: durationSeconds,
        formatted_time: formatDuration(durationSeconds),
        moves_count: Math.round(55 + Math.random() * 18),
        mistakes_count: Math.floor(Math.random() * 2),
        undos_count: Math.floor(Math.random() * 3),
        tab_switches: Math.random() < 0.15 ? 1 : 0,
        score: totalScore,
        stages: {
          stage1: { valid: questionsSolved >= 1, score: stage1Score, title: '1. Hashi 10*10 HARD' },
          stage2: {
            valid: questionsSolved >= 2,
            score: stage2Score,
            deepfake: questionsSolved >= 2 ? 'C' : 'A',
            upload_order: questionsSolved >= 2 ? 'B -> A -> C -> E -> D' : 'A -> B -> C -> D -> E',
            title: '2. WHO IS THE DEEPFAKE?'
          },
          stage3: {
            valid: questionsSolved >= 3,
            score: stage3Score,
            final_word: questionsSolved >= 3 ? 'CRANE' : '-',
            saree_value: questionsSolved >= 3 ? 75288 : 0,
            title: '3. ZERO TO CRORE'
          }
        }
      });
    }
  }

  fs.writeFileSync(DATASET_FILE, JSON.stringify(records, null, 2), 'utf8');
  console.log(`Successfully seeded ${records.length} total student records with realistic Round 2 Power-Ups and Labs!`);
}

seedCohortData();
