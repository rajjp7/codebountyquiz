const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pig, officers, deepfake, crore, solution } = require('./fixtures.cjs');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hashi-react-test-'));
process.env.NODE_ENV = 'test';
process.env.DATA_DIR = temp;
process.env.ADMIN_PASSWORD = 'test-admin-password';
fs.copyFileSync(path.join(__dirname, '../data/puzzles.json'), path.join(temp, 'puzzles.json'));
fs.writeFileSync(path.join(temp, 'dataset.json'), '[]');
fs.writeFileSync(path.join(temp, 'room_config.json'), JSON.stringify({ admin_password: 'must-not-leak', batches: ['Batch A'] }));
const app = require('../server.js');
let server, base;
before(async () => {
  await new Promise((resolve, reject) => { server = app.listen(0, '127.0.0.1', error => error ? reject(error) : resolve()); server.once('error', reject); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  fs.rmSync(temp, { recursive: true, force: true });
});
async function request(route, { token, body, method } = {}) {
  const response = await fetch(base + route, { method: method || (body === undefined ? 'GET' : 'POST'), headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, data: await response.json() };
}
async function start(track = 'track1') {
  const result = await request('/api/round2/start', { body: { student_name: '<script>Test</script>', college: 'Test College', lab: 'Lab 2', track } });
  assert.equal(result.status, 200); assert.ok(result.data.token); assert.equal(result.data.attempt.session_hash, undefined); return result.data;
}
const validate = (session, stage, data, extra = {}) => request('/api/round2/validate-stage', { token: session.token, body: { attempt_id: session.attempt_id, stage, data, ...extra } });
const getAttempt = session => request(`/api/round2/attempt/${session.attempt_id}`, { token: session.token });

for (const track of ['track1', 'track2']) test(`${track}: full sequential round accepts only complete answers and locks rewards`, async () => {
  const session = await start(track);
  const stage2 = track === 'track1' ? pig : deepfake, stage3 = track === 'track1' ? officers : crore;
  assert.equal((await validate(session, 2, stage2)).status, 409);
  assert.equal((await validate(session, 3, stage3)).status, 409);
  let invalid = await validate(session, 1, { bridges: [] });
  assert.equal(invalid.data.valid, false); assert.equal(invalid.data.attempt.questions_solved, 0); assert.equal(invalid.data.attempt.score, 0); assert.equal(invalid.data.attempt.pool_size, 0);
  let result = await validate(session, 1, solution(track));
  assert.equal(result.data.valid, true); assert.equal(result.data.attempt.questions_solved, 1); assert.equal(result.data.attempt.pool_size, 2);
  assert.equal(result.data.attempt.stages.stage2.status, 'PENDING'); assert.equal(result.data.attempt.stages.stage3.status, 'LOCKED');
  assert.equal((await validate(session, 1, { bridges: [] })).status, 409);
  assert.equal((await request('/api/round2/select-powerups', { token: session.token, body: { attempt_id: session.attempt_id, selected_powerups: ['time_cracker', 'topic_finder'] } })).status, 409);
  invalid = await validate(session, 2, track === 'track1' ? { vault_pin: 1788 } : { deepfake: 'C' });
  assert.equal(invalid.data.valid, false); assert.equal(invalid.data.attempt.questions_solved, 1); assert.equal(invalid.data.attempt.pool_size, 2);
  result = await validate(session, 2, stage2);
  assert.equal(result.data.valid, true); assert.equal(result.data.attempt.questions_solved, 2); assert.equal(result.data.attempt.pool_size, 4);
  invalid = await validate(session, 3, track === 'track1' ? { passcode: 'tuhaikon@codestars' } : { final_word: 'CRANE', saree_value: 75288 });
  assert.equal(invalid.data.valid, false); assert.equal(invalid.data.attempt.questions_solved, 2);
  result = await validate(session, 3, stage3);
  assert.equal(result.data.valid, true); assert.equal(result.data.attempt.status, 'COMPLETED'); assert.equal(result.data.attempt.questions_solved, 3); assert.equal(result.data.attempt.pool_size, 5);
  assert.equal((await validate(session, 3, stage3)).status, 409);
  const stored = (await getAttempt(session)).data.attempt;
  assert.deepEqual(stored.answers.stage3, stage3);
  const finalized = await request('/api/round2/submit', { token: session.token, body: { attempt_id: session.attempt_id, duration_seconds: -1000, score: 999999 } });
  assert.equal(finalized.data.allPassed, true); assert.deepEqual(finalized.data.attempt, stored);
  for (const selected_powerups of [[], ['time_cracker'], ['time_cracker', 'time_cracker'], ['time_cracker', 'fake'], ['time_cracker', 'topic_finder', 'sweet_sabotage']]) {
    assert.equal((await request('/api/round2/select-powerups', { token: session.token, body: { attempt_id: session.attempt_id, selected_powerups } })).status, 400);
  }
  const selected = await request('/api/round2/select-powerups', { token: session.token, body: { attempt_id: session.attempt_id, selected_powerups: ['time_cracker', 'sweet_sabotage'] } });
  assert.equal(selected.data.attempt.powerups_confirmed, true);
  assert.equal((await request('/api/round2/select-powerups', { token: session.token, body: { attempt_id: session.attempt_id, selected_powerups: ['topic_finder', 'penalty_sweeper'] } })).status, 409);
});
test('Attempt identity, track, and stage cannot be spoofed', async () => {
  const session = await start();
  assert.equal((await request(`/api/round2/attempt/${session.attempt_id}`)).status, 401);
  assert.equal((await request('/api/round2/validate-stage', { body: { attempt_id: session.attempt_id, stage: 1, data: solution('track1') } })).status, 401);
  const other = await start();
  assert.equal((await request(`/api/round2/attempt/${session.attempt_id}`, { token: other.token })).status, 401);
  assert.equal((await validate(session, 1, solution('track2'), { track: 'track2' })).status, 400);
  for (const stage of [0, 4, 'stage1', '1junk', null, 1.5, '1']) assert.equal((await validate(session, stage, solution('track1'))).status, 400);
  assert.equal((await getAttempt(session)).data.attempt.questions_solved, 0);
});
test('Submit ignores forged answers, completion flags, scores, and durations', async () => {
  const session = await start();
  const result = await request('/api/round2/submit', { token: session.token, body: { attempt_id: session.attempt_id, stage1: solution('track1'), stage2: pig, stage3: officers, allPassed: true, questions_solved: 3, score: 9999, duration_seconds: -20 } });
  assert.equal(result.data.allPassed, false); assert.equal(result.data.attempt.status, 'FAILED'); assert.equal(result.data.attempt.score, 0); assert.equal(result.data.attempt.questions_solved, 0); assert.ok(result.data.attempt.duration_seconds >= 0);
  assert.equal((await validate(session, 1, solution('track1'))).status, 409);
});
test('Partial finalization retains only accepted stage rewards', async () => {
  const session = await start(); await validate(session, 1, solution('track1'));
  const result = await request('/api/round2/submit', { token: session.token, body: { attempt_id: session.attempt_id } });
  assert.equal(result.data.attempt.status, 'PARTIAL'); assert.equal(result.data.allPassed, false); assert.equal(result.data.attempt.questions_solved, 1);
  const invalid = await request('/api/round2/select-powerups', { token: session.token, body: { attempt_id: session.attempt_id, selected_powerups: ['sweet_sabotage', 'time_cracker'] } });
  assert.equal(invalid.status, 400);
});
test('Server deadline locks submissions without trusting the client clock', async () => {
  const session = await start(); await validate(session, 1, solution('track1'));
  const file = path.join(temp, 'dataset.json');
  const records = JSON.parse(fs.readFileSync(file, 'utf8'));
  records.find(a => a.id === session.attempt_id).start_time = new Date(Date.now() - 1800001).toISOString();
  fs.writeFileSync(file, JSON.stringify(records));
  const result = await validate(session, 2, pig);
  assert.equal(result.status, 409); assert.equal(result.data.attempt.status, 'EXPIRED'); assert.equal(result.data.attempt.questions_solved, 1); assert.equal(result.data.attempt.duration_seconds, 1800);
  assert.equal((await getAttempt(session)).data.attempt.status, 'EXPIRED');
});
test('Concurrent repeated validation awards a stage exactly once', async () => {
  const session = await start();
  const responses = await Promise.all([validate(session, 1, solution('track1')), validate(session, 1, solution('track1'))]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  const attempt = (await getAttempt(session)).data.attempt;
  assert.equal(attempt.questions_solved, 1); assert.equal(attempt.score, 800); assert.equal(attempt.pool_size, 2);
});
test('Legacy APIs cannot bypass the authenticated workflow', async () => {
  const session = await start();
  for (const route of ['/api/student/start', '/api/student/submit', '/api/student/heartbeat', '/api/track2/start', '/api/track2/submit', '/api/track2/validate-stage']) {
    assert.equal((await request(route, { token: session.token, body: { attempt_id: session.attempt_id, stage: 1, bridges: solution('track1').bridges } })).status, 410);
  }
  assert.equal((await getAttempt(session)).data.attempt.questions_solved, 0);
});
test('Admin routes require server authentication, settings do not reveal passwords, and exports work', async () => {
  const publicRoom = await request('/api/room'); assert.equal(publicRoom.data.admin_password, undefined);
  for (const route of ['/api/dataset', '/api/admin/powerups', '/api/leaderboard', '/api/dataset/export/json', '/api/admin/export/excel', '/api/DATASET/', '/api/ADMIN/powerups/']) assert.equal((await request(route)).status, 401);
  assert.equal((await request('/api/room', { body: { status: 'active' } })).status, 401);
  assert.equal((await request('/api/ROOM/', { body: { status: 'active' } })).status, 401);
  assert.equal((await request('/api/admin/login', { body: { password: 'wrong' } })).status, 401);
  const login = await request('/api/admin/login', { body: { password: process.env.ADMIN_PASSWORD } });
  const token = login.data.token; assert.ok(token);
  for (const route of ['/api/dataset', '/api/admin/powerups', '/api/leaderboard']) assert.equal((await request(route, { token })).status, 200);
  for (const route of ['/api/dataset/export/json', '/api/dataset/export/csv', '/api/admin/export/excel', '/api/DATASET/', '/api/ADMIN/powerups/']) assert.equal((await fetch(base + route, { headers: { Authorization: `Bearer ${token}` } })).status, 200);
  assert.equal((await request('/api/admin/logout', { token, body: {} })).status, 200);
  assert.equal((await request('/api/dataset', { token })).status, 401);
});
test('Persistence errors cannot return accepted or unlocked progress', async () => {
  const session = await start();
  const file = path.join(temp, 'dataset.json'), saved = fs.readFileSync(file);
  const writeFileSync = fs.writeFileSync;
  fs.writeFileSync = (...args) => { if (String(args[0]).startsWith(`${file}.`)) throw new Error('simulated persistence failure'); return writeFileSync(...args); };
  try { const result = await validate(session, 1, solution('track1')); assert.equal(result.status, 500); assert.equal(result.data.valid, false); assert.equal(result.data.attempt, undefined); }
  finally { fs.writeFileSync = writeFileSync; }
  assert.deepEqual(fs.readFileSync(file), saved);
  assert.equal((await getAttempt(session)).data.attempt.questions_solved, 0);
});
