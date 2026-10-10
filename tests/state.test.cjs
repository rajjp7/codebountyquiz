const { test } = require('node:test');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const vm = require('node:vm');
const fs = require('node:fs');
// Exercise the real reducer without starting a browser or duplicating client logic.
const compiled = esbuild.transformSync(fs.readFileSync('src/state.js', 'utf8'), { format: 'cjs' }).code;
const context = { module: { exports: {} } }; vm.runInNewContext(compiled, context);
const { roundReducer, initialState } = context.module.exports;
const attempt = { id: 'one', revision: 1, status: 'IN_PROGRESS', current_stage: 1, stages: { stage1: { status: 'PENDING', valid: false }, stage2: { status: 'LOCKED', valid: false }, stage3: { status: 'LOCKED', valid: false } } };
const state = () => roundReducer(initialState, { type: 'RESTORE', attempt });
test('Editing drafts never accepts a challenge or opens a locked stage', () => {
  const edited = roundReducer(state(), { type: 'EDIT', stage: 1, answer: { valid: true, bridges: [] } });
  assert.equal(edited.attempt.stages.stage1.valid, false);
  assert.equal(roundReducer(edited, { type: 'STAGE', stage: 2 }).stage, 1);
  assert.equal(roundReducer(edited, { type: 'EDIT', stage: 2, answer: {} }), edited);
});
test('Pending, completed, and expired states reject edits', () => {
  const pending = roundReducer(state(), { type: 'PENDING' });
  assert.equal(roundReducer(pending, { type: 'EDIT', stage: 1, answer: {} }), pending);
  assert.equal(roundReducer(pending, { type: 'STAGE', stage: 4 }), pending);
  for (const status of ['COMPLETED', 'PARTIAL', 'FAILED', 'EXPIRED']) {
    const locked = { ...state(), attempt: { ...attempt, status } };
    assert.equal(roundReducer(locked, { type: 'EDIT', stage: 1, answer: {} }), locked);
  }
});
test('Accepted answers are immutable and only server sync advances status', () => {
  const accepted = roundReducer(state(), { type: 'SYNC', attempt: { ...attempt, revision: 2, stages: { ...attempt.stages, stage1: { status: 'COMPLETED', valid: true } } } });
  assert.equal(roundReducer(accepted, { type: 'EDIT', stage: 1, answer: {} }), accepted);
  assert.equal(roundReducer(accepted, { type: 'SYNC', attempt }), accepted);
  assert.equal(roundReducer(accepted, { type: 'SYNC', attempt: { ...attempt, id: 'different', revision: 10 } }), accepted);
});
test('A failed request clears pending without granting progress', () => {
  const failed = roundReducer(roundReducer(state(), { type: 'PENDING' }), { type: 'MESSAGE', message: { success: false, text: 'Offline' } });
  assert.equal(failed.pending, false); assert.equal(failed.attempt.stages.stage1.valid, false);
});
