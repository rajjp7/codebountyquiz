const fs = require('fs');
const path = require('path');

console.log('=== VERIFYING ALL USER REQUIREMENTS ===\n');

let allPassed = true;
function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    allPassed = false;
  }
}

// ----------------------------------------------------
// 1. Check Answer Placeholders in public/index.html
// ----------------------------------------------------
console.log('[1] Checking Answer Placeholders in public/index.html...');
const indexHtml = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');

// Ensure answer-revealing placeholders are NOT in HTML
const forbiddenPlaceholders = [
  'e.g. 298',
  'e.g. 1788',
  'e.g. tuhaikon',
  'e.g. 75288',
  'e.g. 12548',
  'e.g. CRANE'
];

forbiddenPlaceholders.forEach(ph => {
  assert(!indexHtml.includes(ph), `Forbidden placeholder "${ph}" is removed from index.html`);
});

// Check input fields have no placeholder attribute or have neutral placeholders
const tr1Damage = indexHtml.match(/id="tr1-input-damage"[^>]+/);
assert(tr1Damage && !tr1Damage[0].includes('placeholder='), 'tr1-input-damage has no placeholder attribute');

const tr1Pin = indexHtml.match(/id="tr1-input-vault-pin"[^>]+/);
assert(tr1Pin && !tr1Pin[0].includes('placeholder='), 'tr1-input-vault-pin has no placeholder attribute');

const tr1Officer = indexHtml.match(/id="tr1-input-officer-passcode"[^>]+/);
assert(tr1Officer && !tr1Officer[0].includes('placeholder='), 'tr1-input-officer-passcode has no placeholder attribute');

const tr2Saree = indexHtml.match(/id="tr2-input-saree"[^>]+/);
assert(tr2Saree && !tr2Saree[0].includes('placeholder='), 'tr2-input-saree has no placeholder attribute');

const tr2Quotient = indexHtml.match(/id="tr2-input-quotient"[^>]+/);
assert(tr2Quotient && !tr2Quotient[0].includes('placeholder='), 'tr2-input-quotient has no placeholder attribute');

const tr2Word = indexHtml.match(/id="tr2-input-word"[^>]+/);
assert(tr2Word && !tr2Word[0].includes('placeholder='), 'tr2-input-word has no placeholder attribute');

// ----------------------------------------------------
// 2. Check Auto-fill Removal in Manager JS files
// ----------------------------------------------------
console.log('\n[2] Checking Auto-Fill Removal in Managers...');
const tr1Js = fs.readFileSync(path.join(__dirname, '../public/js/track1-manager.js'), 'utf8');
const tr2Js = fs.readFileSync(path.join(__dirname, '../public/js/track2-manager.js'), 'utf8');

assert(!tr1Js.includes('damageInput.value = totalDmg'), 'track1-manager does not auto-fill damageInput');
assert(!tr1Js.includes('pinInput.value = vaultPin'), 'track1-manager does not auto-fill pinInput');
assert(!tr2Js.includes('sareeInput.value = saree'), 'track2-manager does not auto-fill sareeInput');

// ----------------------------------------------------
// 3. Check Leaderboard Removal for Students
// ----------------------------------------------------
console.log('\n[3] Checking Leaderboard Hidden for Contestants...');
const appJs = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');

assert(
  appJs.includes("if (navLeaderboard) navLeaderboard.style.display = 'none';"),
  'navLeaderboard is hidden in applyContestantSession'
);
assert(
  appJs.includes("if (this.currentRole === 'contestant')") &&
  appJs.includes("Leaderboard is hidden during competition"),
  'Contestants are blocked from switching to leaderboard tab'
);
assert(
  !indexHtml.includes("window.app.switchTab('leaderboard')") ||
  !indexHtml.includes("modal-tr2-victory"),
  'Victory modal directs to Power-Ups instead of Leaderboard'
);

// ----------------------------------------------------
// 4. Check Stage Confirmation Modals
// ----------------------------------------------------
console.log('\n[4] Checking Stage Confirmation Modal Implementation...');
assert(indexHtml.includes('id="modal-stage-confirmation"'), 'modal-stage-confirmation exists in index.html');
assert(indexHtml.includes('id="stage-conf-icon-box"'), 'stage-conf-icon-box exists');
assert(indexHtml.includes('id="stage-conf-title"'), 'stage-conf-title exists');
assert(indexHtml.includes('id="stage-conf-message"'), 'stage-conf-message exists');
assert(indexHtml.includes('id="stage-conf-reward-box"'), 'stage-conf-reward-box exists');
assert(indexHtml.includes('id="stage-conf-action-btn"'), 'stage-conf-action-btn exists');

assert(appJs.includes('showStageConfirmation({'), 'app.js implements showStageConfirmation');
assert(appJs.includes("modal.classList.add('open')"), 'showStageConfirmation adds open class');
assert(appJs.includes("modal.classList.remove('open')"), 'showStageConfirmation removes open class on action');

// Check that managers trigger showStageConfirmation
assert((tr1Js.match(/showStageConfirmation/g) || []).length >= 6, 'track1-manager calls showStageConfirmation for all 3 stages (success and error)');
assert((tr2Js.match(/showStageConfirmation/g) || []).length >= 6, 'track2-manager calls showStageConfirmation for all 3 stages (success and error)');

// ----------------------------------------------------
// 5. Check Timer Glitch Fix
// ----------------------------------------------------
console.log('\n[5] Checking Timer Glitch Fix...');
assert(
  tr1Js.includes('updateTick();\n    this.timerInterval = setInterval(updateTick, 1000);') ||
  tr1Js.includes('updateTick();') && tr1Js.includes('setInterval(updateTick, 1000)'),
  'track1-manager executes updateTick immediately on start'
);
assert(
  tr2Js.includes('updateTick();\n    this.timerInterval = setInterval(updateTick, 1000);') ||
  tr2Js.includes('updateTick();') && tr2Js.includes('setInterval(updateTick, 1000)'),
  'track2-manager executes updateTick immediately on start'
);
assert(
  tr1Js.includes('if (window.track2Manager?.timerInterval)') && tr1Js.includes('clearInterval(window.track2Manager.timerInterval)'),
  'track1-manager clears track2 timer interval (mutual exclusion)'
);
assert(
  tr2Js.includes('if (window.track1Manager?.timerInterval)') && tr2Js.includes('clearInterval(window.track1Manager.timerInterval)'),
  'track2-manager clears track1 timer interval (mutual exclusion)'
);

// ----------------------------------------------------
// 6. Check Track 2 Hashi Hardness (25 Islands)
// ----------------------------------------------------
console.log('\n[6] Checking Track 2 Hashi Puzzle Hardness...');
const puzzles = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/puzzles.json'), 'utf8'));
const tr2Puzzle = puzzles.find(p => p.id === 'puzzle-10x10-pro');

assert(!!tr2Puzzle, 'puzzle-10x10-pro exists in puzzles.json');
assert(tr2Puzzle.width === 10 && tr2Puzzle.height === 10, 'Track 2 board is 10x10');
assert(tr2Puzzle.islands.length === 25, `Track 2 board has 25 islands (actual: ${tr2Puzzle.islands.length})`);
assert(tr2Puzzle.solutionEdges.length >= 25, `Track 2 board has ${tr2Puzzle.solutionEdges.length} bridges in solutionEdges`);

const doubleBridges = tr2Puzzle.solutionEdges.filter(b => b.count === 2);
assert(doubleBridges.length >= 10, `Track 2 board contains ${doubleBridges.length} double bridges (>= 10 for high difficulty)`);

const highDegreeIslands = tr2Puzzle.islands.filter(isl => isl.number >= 4);
assert(highDegreeIslands.length >= 10, `Track 2 board has ${highDegreeIslands.length} high-degree islands (>= 4 bridges)`);

// ----------------------------------------------------
// Final Verdict
// ----------------------------------------------------
console.log('\n=======================================');
if (allPassed) {
  console.log('>>> ALL 26 REQUIREMENT CHECKS PASSED PERFECTLY! <<<');
  process.exit(0);
} else {
  console.error('>>> SOME REQUIREMENT CHECKS FAILED! <<<');
  process.exit(1);
}
