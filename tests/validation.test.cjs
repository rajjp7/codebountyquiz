const { test } = require('node:test');
const assert = require('node:assert/strict');
const v = require('../server/validation.cjs');
const { puzzles, pig, officers, deepfake, crore } = require('./fixtures.cjs');
const clone = value => JSON.parse(JSON.stringify(value));
const reject = result => { assert.equal(result.valid, false); assert.equal(result.score || 0, 0); };

for (const puzzle of puzzles) test(`Hashi accepts the full valid solution: ${puzzle.id}`, () => {
  assert.equal(v.validateHashiSolution(puzzle, puzzle.solutionEdges).valid, true);
  reject(v.validateHashiSolution(puzzle, puzzle.solutionEdges.slice(1)));
});
const simple = { islands: [{ id: 1, r: 0, c: 0, number: 2 }, { id: 2, r: 0, c: 2, number: 2 }] };
for (const [name, bridges] of Object.entries({
  empty: [], object: {}, null: null, selfLoop: [{ u: 1, v: 1, count: 1 }], invalidIsland: [{ u: 1, v: 99, count: 2 }],
  strings: [{ u: '1', v: 2, count: 2 }], stringCount: [{ u: 1, v: 2, count: '2' }], fractional: [{ u: 1, v: 2, count: 1.5 }],
  zero: [{ u: 1, v: 2, count: 0 }], negative: [{ u: 1, v: 2, count: -1 }], excessive: [{ u: 1, v: 2, count: 3 }],
  nullEdge: [null], duplicate: [{ u: 1, v: 2, count: 1 }, { u: 2, v: 1, count: 1 }]
})) test(`Hashi rejects malformed or incomplete bridges: ${name}`, () => reject(v.validateHashiSolution(simple, bridges)));
test('Hashi rejects disconnected groups even when every degree matches', () => {
  const puzzle = { islands: [{ id: 1, r: 0, c: 0, number: 1 }, { id: 2, r: 0, c: 2, number: 1 }, { id: 3, r: 2, c: 0, number: 1 }, { id: 4, r: 2, c: 2, number: 1 }] };
  reject(v.validateHashiSolution(puzzle, [{ u: 1, v: 2, count: 1 }, { u: 3, v: 4, count: 1 }]));
});
test('Hashi rejects crossings, diagonals, and bridges through islands', () => {
  const cross = { islands: [{ id: 1, r: 1, c: 0, number: 1 }, { id: 2, r: 1, c: 2, number: 1 }, { id: 3, r: 0, c: 1, number: 1 }, { id: 4, r: 2, c: 1, number: 1 }] };
  reject(v.validateHashiSolution(cross, [{ u: 1, v: 2, count: 1 }, { u: 3, v: 4, count: 1 }]));
  reject(v.validateHashiSolution(cross, [{ u: 1, v: 3, count: 1 }]));
  reject(v.validateHashiSolution({ islands: [...simple.islands, { id: 3, r: 0, c: 1, number: 2 }] }, [{ u: 1, v: 2, count: 2 }]));
});
for (const [name, validator, answer] of [['Pig Fortress', v.validatePigFortressSolution, pig], ['Officers', v.validateOfficersSolution, officers], ['Deepfake', v.validateDeepfakeSolution, deepfake], ['Zero to Crore', v.validateZeroToCroreSolution, crore]]) {
  test(`${name} accepts its complete correct answer`, () => { const result = validator(answer); assert.equal(result.valid, true); assert.ok(result.score > 0); });
  for (const key of Object.keys(answer)) test(`${name} rejects missing ${key}`, () => { const incomplete = clone(answer); delete incomplete[key]; reject(validator(incomplete)); });
  test(`${name} rejects empty and malformed payloads`, () => { for (const value of [null, undefined, {}, [], '', false, 4]) reject(validator(value)); });
}
test('Pig Fortress rejects every incorrect classification and order position', () => {
  for (const name of Object.keys(pig.pigs)) { const answer = clone(pig); answer.pigs[name] = answer.pigs[name] === 'HONEST' ? 'LIAR' : 'HONEST'; reject(v.validatePigFortressSolution(answer)); }
  for (let index = 0; index < 5; index++) { const answer = clone(pig); answer.launch_order[index] = 'invalid'; reject(v.validatePigFortressSolution(answer)); }
  for (const total_damage of ['298garbage', 298.5, null, '', true]) reject(v.validatePigFortressSolution({ ...pig, total_damage }));
  reject(v.validatePigFortressSolution({ ...pig, vault_pin: '1788wrong' }));
});
test('Officers rejects the old passcode bypass, foreign pieces, missing cells, and duplicate pairs', () => {
  reject(v.validateOfficersSolution({ passcode: 'tuhaikon@codestars' }));
  const invalid = clone(officers); invalid.arrangement[0] = { color: 'Orange', piece: '♔' }; reject(v.validateOfficersSolution(invalid));
  invalid.arrangement[0] = { color: 'Red', piece: 'X' }; reject(v.validateOfficersSolution(invalid));
  invalid.arrangement[0] = null; reject(v.validateOfficersSolution(invalid));
  invalid.arrangement[0] = { color: {}, piece: '♔' }; reject(v.validateOfficersSolution(invalid));
  const duplicate = clone(officers); duplicate.arrangement[0] = duplicate.arrangement[1]; reject(v.validateOfficersSolution(duplicate));
  reject(v.validateOfficersSolution({ arrangement: officers.arrangement.slice(1) }));
  // Valid Latin rows and columns, but only five distinct color-piece pairs.
  reject(v.validateOfficersSolution({ arrangement: officers.arrangement.map((cell, i) => ({ ...cell, piece: ['♔', '♕', '♖', '♗', '♘'][(Math.floor(i / 5) + i % 5) % 5] })) }));
});
test('Deepfake rejects partly correct answers and extra unrecognized text', () => {
  reject(v.validateDeepfakeSolution({ ...deepfake, deepfake: 'A' }));
  reject(v.validateDeepfakeSolution({ ...deepfake, upload_order: ['B', 'A', 'C', 'D', 'E'] }));
  reject(v.validateDeepfakeSolution({ ...deepfake, upload_order: 'B A C E D nonsense' }));
  reject(v.validateDeepfakeSolution({ ...deepfake, upload_order: [...deepfake.upload_order, 'D'] }));
});
test('Alphametic enforces ten distinct digits, no leading zeros, both sums, and all derived answers', () => {
  for (const letter of Object.keys(crore.mapping)) { const answer = clone(crore); delete answer.mapping[letter]; reject(v.validateZeroToCroreSolution(answer)); }
  const zero = Object.fromEntries(Object.keys(crore.mapping).map(letter => [letter, 0]));
  reject(v.validateZeroToCroreSolution({ ...crore, mapping: zero }));
  for (const value of ['', null, false, '2junk', 2.5, 10, -1]) reject(v.validateZeroToCroreSolution({ ...crore, mapping: { ...crore.mapping, R: value } }));
  reject(v.validateZeroToCroreSolution({ ...crore, mapping: { ...crore.mapping, R: 0, J: 2 } }));
  reject(v.validateZeroToCroreSolution({ ...crore, saree_value: '75288junk' }));
  reject(v.validateZeroToCroreSolution({ ...crore, quotient_value: 1 }));
  reject(v.validateZeroToCroreSolution({ ...crore, final_word: 'WRONG' }));
});
test('Deepfake requires five separate video choices, not concatenated or nested tokens', () => {
  for (const upload_order of [['BACED'], ['BA', 'C', 'E', 'D'], [['B'], 'A', 'C', 'E', 'D'], ['B', 'A', 'C', 'E', 'D', '']]) reject(v.validateDeepfakeSolution({ ...deepfake, upload_order }));
  reject(v.validateDeepfakeSolution({ ...deepfake, deepfake: ['C'] }));
});
test('Answer schemas reject coercible arrays and extra mapping letters', () => {
  reject(v.validatePigFortressSolution({ ...pig, pigs: { ...pig.pigs, King: ['HONEST'] } }));
  reject(v.validateZeroToCroreSolution({ ...crore, final_word: ['CRANE'] }));
  reject(v.validateZeroToCroreSolution({ ...crore, mapping: { ...crore.mapping, X: 0 } }));
});
