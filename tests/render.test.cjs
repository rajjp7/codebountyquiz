const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const esbuild = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { puzzles, pig, officers, deepfake, crore } = require('./fixtures.cjs');
function component(file) {
  const { outputFiles } = esbuild.buildSync({ entryPoints: [file], bundle: true, write: false, platform: 'node', format: 'cjs', external: ['react', 'react-dom'] });
  const context = { module: { exports: {} }, require, console, AbortController, URLSearchParams, setTimeout, clearTimeout, setInterval, clearInterval };
  vm.runInNewContext(outputFiles[0].text, context);
  return context.module.exports.default;
}
const Challenge = component('src/components/Challenges.jsx');
const Auth = component('src/components/Auth.jsx');
const Powerups = component('src/components/Powerups.jsx');
const Admin = component('src/components/Admin.jsx');
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));
const configs = [
  { type: 'hashi', title: 'Hashi', description: 'Connect all islands' },
  { type: 'pig_fortress', title: 'Pig Fortress', taunts_round1: Object.keys(pig.pigs).map(pig => ({ pig, statement: 'A clue' })), taunts_round2: [], scoring_rules: { powers: { Red: 7 }, damage_rule: 'Multiply' } },
  { type: 'officers', title: 'Officers', colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple'], pieces: ['♔', '♕', '♖', '♗', '♘'] },
  { type: 'deepfake', title: 'Deepfake', videos: ['A', 'B', 'C', 'D', 'E'].map(id => ({ id, claim1: 'One', claim2: 'Two' })), ai_fact_check: { statement: 'Test', note: 'One conclusion is incorrect' } },
  { type: 'alphametic', title: 'Zero to Crore', letters: Object.keys(crore.mapping), equations: ['RAJA + ZERO = CRORE', 'GANGA + ZERO = SAREE'], hints: [] }
];
const answers = [{ bridges: [] }, pig, officers, deepfake, crore];
configs.forEach((config, index) => test(`React ${config.type} screen renders empty, complete, and locked states without a browser`, () => {
  for (const answer of [{}, answers[index]]) for (const disabled of [false, true]) {
    const html = render(Challenge, { config, puzzle: puzzles[0], answer, disabled, onChange() {} });
    assert.ok(html.includes(config.title));
    if (disabled && config.type !== 'hashi') assert.match(html, /fieldset disabled/);
  }
}));
test('React authentication, admin, and earned power-up screens render', () => {
  assert.match(render(Auth, { onSession() {} }), /Confirm Track/);
  assert.match(render(Admin, { session: { token: 'test' }, onExit() {} }), /Administrator/);
  const html = render(Powerups, { attempt: { status: 'PARTIAL', questions_solved: 1, unlocked_powerups: ['time_cracker'], powerups_selected: [] }, powerups: [{ id: 'time_cracker', name: '<script>bad</script>' }], onConfirm() {} });
  assert.ok(!html.includes('<script>bad</script>')); assert.ok(html.includes('&lt;script&gt;bad&lt;/script&gt;'));
});
