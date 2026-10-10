const crypto = require('node:crypto');
const validators = require('./validation.cjs');
const digest = token => crypto.createHash('sha256').update(token || '').digest('hex');
const tokenFrom = req => (req.headers.authorization || '').replace(/^Bearer /, '');

module.exports = function installRound2(app, deps) {
  const { readJSON, writeJSON, DATASET_FILE, PUZZLES_FILE, ROOM_FILE, TRACK1_CONFIG, TRACK2_CONFIG, ALL_POWERUPS, getUnlockedPowerups, formatDuration } = deps;
  const adminSessions = new Map();
  const safe = attempt => {
    const { session_hash, ...record } = attempt;
    return record;
  };
  const configFor = track => track === 'track1' ? TRACK1_CONFIG : TRACK2_CONFIG;
  const puzzleFor = attempt => readJSON(PUZZLES_FILE, []).find(p => p.id === attempt.puzzle_id);
  const response = attempt => ({ attempt: safe(attempt), server_time: Date.now() });
  const persist = (dataset, attempt) => {
    attempt.revision = (attempt.revision || 0) + 1;
    if (!writeJSON(DATASET_FILE, dataset)) throw new Error('Progress could not be saved. Please retry.');
  };
  const summarize = attempt => {
    const stages = [1, 2, 3].map(n => attempt.stages[`stage${n}`]);
    attempt.questions_solved = stages.filter(s => s.valid === true && s.status === 'COMPLETED').length;
    attempt.score = stages.reduce((sum, s) => sum + (s.valid === true ? s.score : 0), 0);
    attempt.unlocked_powerups = getUnlockedPowerups(attempt.questions_solved);
    attempt.pool_size = attempt.unlocked_powerups.length;
    attempt.current_stage = Math.min(attempt.questions_solved + 1, 4);
  };
  const finish = (attempt, expired = false) => {
    summarize(attempt);
    attempt.status = attempt.questions_solved === 3 ? 'COMPLETED' : expired ? 'EXPIRED' : attempt.questions_solved ? 'PARTIAL' : 'FAILED';
    attempt.finish_time = new Date().toISOString();
    attempt.duration_seconds = Math.max(0, Math.min(attempt.time_limit_seconds, (Date.now() - Date.parse(attempt.start_time)) / 1000));
    attempt.formatted_time = formatDuration(attempt.duration_seconds);
  };
  function load(req, res) {
    const dataset = readJSON(DATASET_FILE, []);
    const id = req.params.id || req.body?.attempt_id;
    const attempt = dataset.find(a => a.id === id);
    if (!attempt) { res.status(404).json({ error: 'Attempt not found' }); return null; }
    if (!attempt.session_hash || digest(tokenFrom(req)) !== attempt.session_hash) {
      res.status(401).json({ error: 'Session is invalid. Sign in again.' }); return null;
    }
    if (attempt.status === 'IN_PROGRESS' && Date.now() >= Date.parse(attempt.start_time) + attempt.time_limit_seconds * 1000) {
      finish(attempt, true);
      persist(dataset, attempt);
    }
    return { dataset, attempt };
  }
  const route = handler => (req, res, next) => { try { handler(req, res); } catch (error) { next(error); } };

  // Contestants cannot bypass validation by editing room settings or the dataset.
  app.use('/api', (req, res, next) => {
    const routePath = req.path.toLowerCase().replace(/\/+$/, '');
    const protectedRoute = routePath.startsWith('/dataset') || routePath.startsWith('/leaderboard') ||
      (routePath.startsWith('/admin/') && routePath !== '/admin/login') || (routePath === '/room' && req.method !== 'GET');
    if (protectedRoute && (adminSessions.get(digest(tokenFrom(req))) || 0) < Date.now()) {
      return res.status(401).json({ error: 'Administrator authentication required' });
    }
    next();
  });
  app.post('/api/admin/login', (req, res) => {
    const configured = process.env.ADMIN_PASSWORD || readJSON(ROOM_FILE, {}).admin_password || 'admin123';
    if (typeof req.body?.password !== 'string' || req.body.password !== configured) return res.status(401).json({ error: 'Incorrect administrator password' });
    const token = crypto.randomBytes(32).toString('hex');
    adminSessions.set(digest(token), Date.now() + 8 * 60 * 60 * 1000);
    res.json({ success: true, role: 'admin', token });
  });
  app.post('/api/admin/logout', (req, res) => {
    adminSessions.delete(digest(tokenFrom(req)));
    res.json({ success: true });
  });

  app.post('/api/round2/start', route((req, res) => {
    const { student_name, college, track, lab, batch } = req.body || {};
    if (typeof student_name !== 'string' || !student_name.trim() || typeof college !== 'string' || !college.trim() || !['track1', 'track2'].includes(track)) {
      return res.status(400).json({ error: 'Name, college, and a valid track are required' });
    }
    const config = configFor(track);
    const puzzle = readJSON(PUZZLES_FILE, []).find(p => p.id === config.stages[0].puzzle_id);
    if (!puzzle) return res.status(503).json({ error: 'Challenge puzzle is unavailable' });
    const token = crypto.randomBytes(32).toString('hex');
    const attempt = {
      id: `att_r2_${crypto.randomUUID()}`, session_hash: digest(token), validation_version: 2,
      track, student_id: `CST-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, student_name: student_name.trim(), college: college.trim(),
      lab: ['Lab 1', 'Lab 2', 'Lab 3', 'Lab 4'].includes(lab) ? lab : 'Lab 1', batch: typeof batch === 'string' && batch.trim() ? batch.trim() : 'Cohort 1',
      puzzle_id: puzzle.id, puzzle_name: config.title, difficulty: puzzle.difficulty,
      status: 'IN_PROGRESS', time_limit_seconds: config.time_limit_seconds,
      start_time: new Date().toISOString(), finish_time: null, duration_seconds: null, formatted_time: '--:--',
      stages: Object.fromEntries([1, 2, 3].map(n => [`stage${n}`, { status: n === 1 ? 'PENDING' : 'LOCKED', valid: false, score: 0 }])),
      answers: {}, powerups_selected: [], powerups_confirmed: false, powerups_locked_at: null, sabotage_target: null,
      moves_count: 0, mistakes_count: 0, undos_count: 0, tab_switches: 0
    };
    summarize(attempt);
    const dataset = readJSON(DATASET_FILE, []);
    dataset.push(attempt);
    persist(dataset, attempt);
    res.json({ ...response(attempt), attempt_id: attempt.id, token });
  }));
  app.get('/api/round2/attempt/:id', route((req, res) => {
    const loaded = load(req, res);
    if (loaded) res.json(response(loaded.attempt));
  }));

  app.post('/api/round2/validate-stage', route((req, res) => {
    const loaded = load(req, res);
    if (!loaded) return;
    const { attempt, dataset } = loaded;
    const { stage, track, data } = req.body;
    if (![1, 2, 3].includes(stage) || (track !== undefined && track !== attempt.track)) return res.status(400).json({ valid: false, error: 'Invalid stage or mismatched track' });
    if (attempt.status !== 'IN_PROGRESS') return res.status(409).json({ valid: false, error: 'This round is locked', ...response(attempt) });
    const key = `stage${stage}`;
    if (attempt.stages[key].valid === true) return res.status(409).json({ valid: false, error: 'This stage was already accepted and is locked', ...response(attempt) });
    if ([1, 2, 3].some(n => n < stage && attempt.stages[`stage${n}`].valid !== true)) return res.status(409).json({ valid: false, error: 'Complete every preceding stage first', ...response(attempt) });
    let result;
    if (stage === 1) result = validators.validateHashiSolution(puzzleFor(attempt), data?.bridges);
    else if (attempt.track === 'track1') result = stage === 2 ? validators.validatePigFortressSolution(data) : validators.validateOfficersSolution(data);
    else result = stage === 2 ? validators.validateDeepfakeSolution(data) : validators.validateZeroToCroreSolution(data);
    if (result.valid === true) {
      attempt.stages[key] = { status: 'COMPLETED', valid: true, score: result.score || 800, completed_at: new Date().toISOString(), reason: result.reason || 'All bridge rules satisfied.' };
      attempt.answers[key] = data;
      if (stage < 3) attempt.stages[`stage${stage + 1}`].status = 'PENDING';
    } else {
      attempt.mistakes_count++;
      attempt.stages[key] = { status: 'PENDING', valid: false, score: 0, reason: result.reason };
    }
    summarize(attempt);
    // The final accepted stage ends the clock, even if the response is lost.
    if (attempt.questions_solved === 3) finish(attempt);
    persist(dataset, attempt);
    res.json({ ...result, stage, ...response(attempt), questions_solved: attempt.questions_solved, unlocked_powerups: attempt.unlocked_powerups, pool_size: attempt.pool_size, next_stage_unlocked: result.valid === true && stage < 3 });
  }));

  app.post('/api/round2/submit', route((req, res) => {
    const loaded = load(req, res);
    if (!loaded) return;
    const { attempt, dataset } = loaded;
    // Finalization only uses stored, server-verified answers. Request flags and scores are ignored.
    if (attempt.status === 'IN_PROGRESS') { finish(attempt); persist(dataset, attempt); }
    res.json({ success: true, allPassed: attempt.status === 'COMPLETED', ...response(attempt), totalScore: attempt.score });
  }));

  app.post('/api/round2/select-powerups', route((req, res) => {
    const loaded = load(req, res);
    if (!loaded) return;
    const { attempt, dataset } = loaded;
    if (attempt.status === 'IN_PROGRESS') return res.status(409).json({ error: 'Finish the round before confirming power-ups' });
    if (attempt.powerups_confirmed) return res.status(409).json({ error: 'Power-up choices are already locked', ...response(attempt) });
    const selected = req.body.selected_powerups;
    const pool = attempt.unlocked_powerups;
    const count = Math.min(2, pool.length);
    if (!count || !Array.isArray(selected) || selected.length !== count || new Set(selected).size !== count || selected.some(id => !pool.includes(id))) {
      return res.status(400).json({ error: `Choose exactly ${count} distinct power-ups from your earned pool` });
    }
    attempt.powerups_selected = selected;
    attempt.powerups_confirmed = true;
    attempt.powerups_locked_at = new Date().toISOString();
    persist(dataset, attempt);
    res.json({ success: true, locked: true, ...response(attempt), selected_details: selected.map(id => ALL_POWERUPS.find(p => p.id === id)) });
  }));
};
