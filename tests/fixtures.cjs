const puzzles = require('../data/puzzles.json');
const colors = ['Red', 'Blue', 'Green', 'Yellow', 'Purple'];
const pieces = ['♔', '♕', '♖', '♗', '♘'];
const pig = { pigs: { Minion: 'HONEST', Corporal: 'LIAR', Foreman: 'LIAR', King: 'HONEST', Helmet: 'HONEST' }, launch_order: ['Red', 'Chuck', 'Matilda', 'Bomb', 'Hal'], total_damage: 298, vault_pin: 1788 };
const officers = { arrangement: Array.from({ length: 25 }, (_, i) => { const r = Math.floor(i / 5), c = i % 5; return { color: colors[(r + c) % 5], piece: pieces[(r + 2 * c) % 5] }; }) };
const deepfake = { deepfake: 'C', upload_order: ['B', 'A', 'C', 'E', 'D'] };
// The equations and decoded quotient independently constrain this complete key.
const crore = { mapping: { R: 2, A: 5, J: 0, Z: 9, E: 8, O: 3, C: 1, G: 6, N: 4, S: 7 }, saree_value: 75288, quotient_value: 12548, final_word: 'CRANE' };
module.exports = { puzzles, pig, officers, deepfake, crore, solution: track => ({ bridges: puzzles.find(p => p.id === (track === 'track1' ? 'puzzle-fy-10x10' : 'puzzle-10x10-pro')).solutionEdges }) };
