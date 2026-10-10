// Validate puzzle fixtures using the same strict validator as production.
const assert = require('node:assert/strict');
const { validateHashiSolution } = require('../server/validation.cjs');
for (const puzzle of require('../data/puzzles.json')) {
  const result = validateHashiSolution(puzzle, puzzle.solutionEdges);
  assert.equal(result.valid, true, `${puzzle.id}: ${result.reason}`);
  console.log(`${puzzle.id}: valid`);
}
