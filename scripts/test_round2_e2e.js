// E2E Verification Script for Round 2 Non-Tech Event
// Tests Track 1 (FY), Track 2 (All Other Years), Sequential Unlocking, Power-Ups Pool & Excel Export

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('=== STARTING ROUND 2 E2E VERIFICATION ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Check Powerups endpoint
  console.log('[1] Testing GET /api/powerups...');
  const resPowerups = await fetch(`${BASE_URL}/api/powerups`);
  const dataPowerups = await resPowerups.json();
  assert(dataPowerups.powerups?.length === 5, 'Found 5 power-ups');
  assert(dataPowerups.powerups.some(p => p.id === 'sweet_sabotage'), 'Sweet Sabotage present');
  assert(dataPowerups.pool_rules?.length === 3, 'Found 3 pool unlocking tiers');

  // 2. Check Track 1 Info
  console.log('\n[2] Testing GET /api/track1/info...');
  const resTr1 = await fetch(`${BASE_URL}/api/track1/info`);
  const tr1Info = await resTr1.json();
  assert(tr1Info.puzzle?.id === 'puzzle-fy-10x10', 'FY 10x10 puzzle loaded');
  assert(tr1Info.puzzle?.islands?.length === 24, 'FY puzzle has 24 islands');
  assert(tr1Info.stages?.length === 3, 'Track 1 has 3 sequential stages');

  // 3. Start Track 1 Attempt
  console.log('\n[3] Testing POST /api/round2/start (Track 1)...');
  const resStart1 = await fetch(`${BASE_URL}/api/round2/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      student_name: 'Test FY Competitor',
      student_id: 'FY-E2E-001',
      college: 'Test Tech Institute',
      batch: 'Batch A',
      lab: 'Lab 1',
      track: 'track1'
    })
  });
  const start1Data = await resStart1.json();
  assert(start1Data.attempt_id, 'Attempt ID generated');
  assert(start1Data.time_limit_seconds === 1800, '30-minute time limit assigned');
  assert(start1Data.track === 'track1', 'Track set to track1');

  // 4. Validate Track 1 Stage 1 (Hashi FY 10x10)
  console.log('\n[4] Testing Stage 1 Validation (Track 1 Hashi)...');
  const fs = require('fs');
  const puzzlesAll = JSON.parse(fs.readFileSync('data/puzzles.json', 'utf8'));
  const fyPuzzle = puzzlesAll.find(p => p.id === 'puzzle-fy-10x10');
  const bridgesFormatted = fyPuzzle.solutionEdges.map(e => ({ u: e.u, v: e.v, count: e.count }));

  const resVal1 = await fetch(`${BASE_URL}/api/round2/validate-stage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attempt_id: start1Data.attempt_id,
      track: 'track1',
      stage: 1,
      data: { bridges: bridgesFormatted }
    })
  });
  const val1Data = await resVal1.json();
  assert(val1Data.valid === true, 'Hashi 10x10 solution verified');
  assert(val1Data.questions_solved === 1, 'Questions solved count incremented to 1');
  assert(val1Data.pool_size === 2, 'Power-Up pool size is 2');
  assert(val1Data.unlocked_powerups.includes('time_cracker'), 'Time Cracker unlocked');
  assert(val1Data.unlocked_powerups.includes('topic_finder'), 'Topic Finder unlocked');

  // 5. Validate Track 1 Stage 2 (Pig Fortress)
  console.log('\n[5] Testing Stage 2 Validation (Pig Fortress Problem)...');
  const pigAnswer = {
    pigs: {
      Minion: 'Honest',
      Corporal: 'Liar',
      Foreman: 'Liar',
      King: 'Honest',
      Helmet: 'Honest'
    },
    launch_order: ['red', 'chuck', 'matilda', 'bomb', 'hal'],
    calculated_damage: 298,
    vault_pin: 1788
  };
  const resVal2 = await fetch(`${BASE_URL}/api/round2/validate-stage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attempt_id: start1Data.attempt_id,
      track: 'track1',
      stage: 2,
      data: pigAnswer
    })
  });
  const val2Data = await resVal2.json();
  assert(val2Data.valid === true, 'Pig Fortress solved with PIN 1788 & Launch Order');
  assert(val2Data.questions_solved === 2, 'Questions solved count incremented to 2');
  assert(val2Data.pool_size === 4, 'Power-Up pool size is 4');
  assert(val2Data.unlocked_powerups.includes('penalty_sweeper'), 'Penalty Sweeper unlocked');
  assert(val2Data.unlocked_powerups.includes('jumper_points'), 'Jumper Points unlocked');

  // 6. Validate Track 1 Stage 3 (25 Officer Puzzle)
  console.log('\n[6] Testing Stage 3 Validation (25 Officers Graeco-Latin Square)...');
  const resVal3 = await fetch(`${BASE_URL}/api/round2/validate-stage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attempt_id: start1Data.attempt_id,
      track: 'track1',
      stage: 3,
      data: {
        passcode: 'tuhaikon@codestars'
      }
    })
  });
  const val3Data = await resVal3.json();
  assert(val3Data.valid === true, '25 Officers verified with passcode tuhaikon@codestars');
  assert(val3Data.questions_solved === 3, 'Questions solved count incremented to 3');
  assert(val3Data.pool_size === 5, 'Full pool of 5 unlocked');
  assert(val3Data.unlocked_powerups.includes('sweet_sabotage'), 'Sweet Sabotage unlocked');

  // 7. Select Power-Ups
  console.log('\n[7] Testing Power-Up Selection (POST /api/round2/select-powerups)...');
  const resSelect = await fetch(`${BASE_URL}/api/round2/select-powerups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attempt_id: start1Data.attempt_id,
      selected_powerups: ['time_cracker', 'sweet_sabotage'],
      sabotage_target: 'STU-042 (Lab 1)'
    })
  });
  const selectData = await resSelect.json();
  assert(selectData.success === true, 'Successfully locked exactly 2 power-ups');
  assert(selectData.locked === true, 'Selection permanently locked');

  // 8. Test Track 2 Flow
  console.log('\n[8] Testing Track 2 Flow (Deepfake & Zero to Crore)...');
  const resStart2 = await fetch(`${BASE_URL}/api/round2/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      student_name: 'Test Track 2 Competitor',
      student_id: 'TR2-E2E-002',
      batch: 'Batch B',
      lab: 'Lab 2',
      track: 'track2'
    })
  });
  const start2Data = await resStart2.json();

  // Validate Deepfake
  const resDf = await fetch(`${BASE_URL}/api/round2/validate-stage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attempt_id: start2Data.attempt_id,
      track: 'track2',
      stage: 2,
      data: {
        deepfake: 'C',
        upload_order: ['B', 'A', 'C', 'E', 'D']
      }
    })
  });
  const dfData = await resDf.json();
  assert(dfData.valid === true, 'Deepfake C and order BACED validated');

  // Validate Zero to Crore
  const resZtc = await fetch(`${BASE_URL}/api/round2/validate-stage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attempt_id: start2Data.attempt_id,
      track: 'track2',
      stage: 3,
      data: {
        final_word: 'CRANE',
        saree_value: 75288,
        quotient_value: 12548
      }
    })
  });
  const ztcData = await resZtc.json();
  assert(ztcData.valid === true, 'Zero to Crore CRANE, SAREE=75288 validated');

  // 9. Admin & Excel Export
  console.log('\n[9] Testing Admin Powerups API & Excel Export...');
  const resAdmin = await fetch(`${BASE_URL}/api/admin/powerups`);
  const adminData = await resAdmin.json();
  assert(adminData.records?.length >= 1, `Admin returns ${adminData.records?.length} participant records`);

  const resExcel = await fetch(`${BASE_URL}/api/admin/export/excel`);
  const excelText = await resExcel.text();
  assert(excelText.includes('Participant / Team') && excelText.includes('College') && excelText.includes('Questions Solved Breakdown'), 'Excel header matches requested format with College and Questions Breakdown');
  assert(excelText.includes('Test FY Competitor'), 'Newly created student in export');
  assert(excelText.includes('Sweet Sabotage'), 'Selected power-up in export');

  console.log(`\n=== VERIFICATION SUMMARY ===`);
  console.log(`Passed: ${passed} | Failed: ${failed}`);
  if (failed === 0) {
    console.log('>>> ALL VERIFICATION CHECKS PASSED PERFECTLY! <<<\n');
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
