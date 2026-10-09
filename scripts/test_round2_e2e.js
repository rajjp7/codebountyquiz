const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const puzzles = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'puzzles.json'), 'utf8'));
const solution = id => puzzles.find(p => p.id === id).solutionEdges;

async function post(route, body) {
  const response = await fetch(`${baseUrl}${route}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

async function stage(attemptId, track, number, data) {
  return post('/api/round2/validate-stage', { attempt_id: attemptId, track, stage: number, data });
}

async function run() {
  const powerups = await (await fetch(`${baseUrl}/api/powerups`)).json();
  assert.equal(powerups.powerups.length, 4);
  assert.deepEqual(powerups.pool_rules.map(rule => rule.pool_size), [2, 4, 4]);

  const fy = (await post('/api/round2/start', {
    student_name: 'Flow Test FY', college: 'Test College', track: 'track1'
  })).body.attempt_id;
  assert.ok(fy);

  let response = await stage(fy, 'track1', 2, { vault_pin: 1788 });
  assert.equal(response.status, 409, 'Stage 2 must stay locked before Stage 1');
  response = await post('/api/round2/select-powerups', {
    attempt_id: fy, selected_powerups: ['time_cracker', 'topic_finder']
  });
  assert.equal(response.status, 409, 'Power-ups cannot be locked before submission');

  response = await stage(fy, 'track1', 1, { bridges: solution('puzzle-fy-10x10') });
  assert.equal(response.body.valid, true);
  assert.equal(response.body.pool_size, 2);
  response = await stage(fy, 'track1', 2, { vault_pin: 1788 });
  assert.equal(response.body.valid, false, 'PIN alone cannot pass Pig Fortress');

  const pig = {
    pigs: { Minion: 'Honest', Corporal: 'Liar', Foreman: 'Liar', King: 'Honest', Helmet: 'Honest' },
    launch_order: ['red', 'chuck', 'matilda', 'bomb', 'hal'], total_damage: 298, vault_pin: 1788
  };
  response = await stage(fy, 'track1', 2, pig);
  assert.equal(response.body.valid, true);
  assert.equal(response.body.pool_size, 4);
  response = await stage(fy, 'track1', 3, { passcode: 'tuhaikon@codestars' });
  assert.equal(response.body.valid, true);
  assert.equal(response.body.pool_size, 4);

  response = await post('/api/round2/submit', {
    attempt_id: fy, track: 'track1', stage1: { bridges: solution('puzzle-fy-10x10') },
    stage2: pig, stage3: { passcode: 'tuhaikon@codestars' }
  });
  assert.equal(response.body.attempt.status, 'COMPLETED');
  assert.equal(response.body.questions_solved, 3);
  response = await post('/api/round2/select-powerups', {
    attempt_id: fy, selected_powerups: ['time_cracker', 'time_cracker']
  });
  assert.equal(response.status, 400, 'Duplicate selection rejected');
  response = await post('/api/round2/select-powerups', {
    attempt_id: fy, selected_powerups: ['time_cracker', 'unknown_powerup']
  });
  assert.equal(response.status, 400, 'Unknown power-up rejected');
  response = await post('/api/round2/select-powerups', {
    attempt_id: fy, selected_powerups: ['time_cracker', 'jumper_points']
  });
  assert.equal(response.body.success, true);

  const track2 = (await post('/api/round2/start', {
    student_name: 'Flow Test Track 2', college: 'Test College', track: 'track2'
  })).body.attempt_id;
  assert.ok(track2);
  response = await stage(track2, 'track2', 1, { bridges: solution('puzzle-10x10-pro') });
  assert.equal(response.body.valid, true);
  response = await stage(track2, 'track2', 2, { deepfake: 'C', upload_order: ['A', 'B', 'C', 'E', 'D'] });
  assert.equal(response.body.valid, false, 'Wrong upload order rejected');
  const deepfake = { deepfake: 'C', upload_order: ['B', 'A', 'C', 'E', 'D'] };
  response = await stage(track2, 'track2', 2, deepfake);
  assert.equal(response.body.valid, true);
  response = await stage(track2, 'track2', 3, {
    final_word: 'CRANE', saree_value: 75288, quotient_value: 12548
  });
  assert.equal(response.body.valid, false, 'Word and values without mapping rejected');
  const cryptarithm = {
    mapping: { S: 7, A: 5, R: 2, E: 8, C: 1, J: 0, Z: 9, O: 3, G: 6, N: 4 },
    saree_value: 75288, quotient_value: 12548, final_word: 'CRANE'
  };
  response = await stage(track2, 'track2', 3, cryptarithm);
  assert.equal(response.body.valid, true);
  response = await post('/api/round2/submit', {
    attempt_id: track2, track: 'track2', stage1: { bridges: solution('puzzle-10x10-pro') },
    stage2: deepfake, stage3: cryptarithm
  });
  assert.equal(response.body.attempt.status, 'COMPLETED');
  assert.equal(response.body.pool_size, 4);

  const csv = await (await fetch(`${baseUrl}/api/admin/export/excel`)).text();
  assert.ok(csv.includes('Flow Test FY'));
  assert.equal(csv.split('\n')[0].split(',').length, 15);
  console.log('Round 2 flow checks passed');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
