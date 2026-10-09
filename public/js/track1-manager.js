// Track 1: First Years (FY Track) Manager
// Stage 1: Hashi 10×10 Grid (Nikoli Bridges)
// Stage 2: The Pig Fortress Problem (Logic Brain Teaser)
// Stage 3: The 25 Officer Puzzle (Euler's Graeco-Latin Square)

class Track1Manager {
  constructor() {
    this.currentStage = 1;
    this.stagesUnlocked = { 1: true, 2: false, 3: false, 4: false };
    this.stagesCompleted = { 1: false, 2: false, 3: false };
    this.attempt = null;
    this.hashiEngine = null;
    this.puzzleFY = null;
    this.elapsedSeconds = 0;
    this.timerInterval = null;
    this.tabSwitches = 0;
    this.isSubmitted = false;

    // Stage 2: The Pig Fortress Problem state
    this.pigsClassification = {
      Minion: null,
      Corporal: null,
      Foreman: null,
      King: null,
      Helmet: null
    };
    this.launchOrder = []; // Ordered bird IDs: ['red', 'chuck', 'matilda', 'bomb', 'hal']
    this.availableBirds = [
      { id: 'red', name: 'Red', power: 7, color: '#ef4444' },
      { id: 'chuck', name: 'Chuck', power: 12, color: '#eab308' },
      { id: 'matilda', name: 'Matilda', power: 9, color: '#f43f5e' },
      { id: 'bomb', name: 'Bomb', power: 25, color: '#18181b' },
      { id: 'hal', name: 'Hal', power: 14, color: '#10b981' }
    ];

    // Stage 3: The 25 Officer Puzzle state
    this.officerColors = ['Red', 'Blue', 'Green', 'Yellow', 'Purple'];
    this.colorHexMap = {
      Red: '#ef4444',
      Blue: '#3b82f6',
      Green: '#10b981',
      Yellow: '#eab308',
      Purple: '#a855f7'
    };
    this.officerPieces = ['♔', '♕', '♖', '♗', '♘'];
    this.officerGrid = new Array(25).fill(null); // { color, piece } or null
    this.selectedOfficer = null; // Currently clicked piece for tap-to-place
    this.draggedOfficer = null;

    this.init();
  }

  async init() {
    this.bindDOM();
    await this.loadTrackData();
  }

  async loadTrackData() {
    try {
      const res = await fetch('/api/track1/info');
      const data = await res.json();
      this.config = data;
      this.puzzleFY = data.puzzle;

      this.initStage1Board();
      this.initStage2UI();
      this.initStage3Board();
      this.updateStepperUI();
    } catch (err) {
      console.error('Failed to load Track 1 info:', err);
    }
  }

  startNewAttempt(studentName, studentId, batch, lab, attemptId) {
    this.attempt = {
      id: attemptId || `att_${Date.now()}`,
      student_name: studentName,
      student_id: studentId,
      batch: batch || 'Cohort 1',
      lab: lab || 'Lab 1'
    };
    const nameEl = document.getElementById('tr1-display-student-name');
    const idEl = document.getElementById('tr1-display-student-id');
    const batchEl = document.getElementById('tr1-display-batch');
    const avatarEl = document.getElementById('tr1-display-avatar');
    if (nameEl) nameEl.textContent = studentName;
    if (idEl) idEl.textContent = studentId;
    if (batchEl) batchEl.textContent = (batch && lab) ? `${batch} • ${lab}` : (lab || batch || 'Active');
    if (avatarEl) avatarEl.textContent = (studentName || 'F').charAt(0).toUpperCase();

    this.initStage1Board();
    this.switchStage(1);
  }

  bindDOM() {
    // Stepper buttons
    document.querySelectorAll('.tr1-step-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const stageNum = parseInt(btn.getAttribute('data-stage'), 10);
        if (stageNum) this.switchStage(stageNum);
      });
    });

    // Stage 1 Toolbar
    document.getElementById('tr1-hashi-undo')?.addEventListener('click', () => this.hashiEngine?.undo());
    document.getElementById('tr1-hashi-redo')?.addEventListener('click', () => this.hashiEngine?.redo());
    document.getElementById('tr1-hashi-reset')?.addEventListener('click', () => {
      if (confirm('Clear all bridges on this board?')) this.hashiEngine?.reset();
    });
    document.getElementById('tr1-hashi-guides')?.addEventListener('click', () => {
      if (this.hashiEngine) {
        this.hashiEngine.options.showGuides = !this.hashiEngine.options.showGuides;
        this.hashiEngine.updateVisualState();
        window.app?.showToast(this.hashiEngine.options.showGuides ? 'Ray guides on' : 'Ray guides off', 'info');
      }
    });

    // Stage 1 Verification
    document.getElementById('tr1-btn-verify-stage1')?.addEventListener('click', () => this.verifyStage1());

    // Stage 2 Pig buttons
    document.querySelectorAll('.pig-toggle-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const pig = btn.getAttribute('data-pig');
        const type = btn.getAttribute('data-type');
        this.setPigType(pig, type);
      });
    });

    // Stage 2 Bird order reset
    document.getElementById('tr1-btn-reset-bird-order')?.addEventListener('click', () => {
      this.resetBirdOrder();
    });

    // Stage 2 Verification
    document.getElementById('tr1-btn-verify-stage2')?.addEventListener('click', () => this.verifyStage2());
    document.getElementById('tr1-btn-back-to-stage1')?.addEventListener('click', () => this.switchStage(1));

    // Stage 3 Verification & Actions
    document.getElementById('tr1-btn-verify-stage3')?.addEventListener('click', () => this.verifyStage3());
    document.getElementById('tr1-btn-clear-officers')?.addEventListener('click', () => {
      if (confirm('Clear the 5x5 officer grid?')) this.resetOfficerGrid();
    });
    document.getElementById('tr1-btn-back-to-stage2')?.addEventListener('click', () => this.switchStage(2));
    document.getElementById('tr1-btn-to-powerups')?.addEventListener('click', () => {
      window.app?.switchTab('powerups');
    });
  }

  // ----------------------------------------------------
  // SEQUENTIAL STAGE SWITCHING
  // ----------------------------------------------------
  switchStage(stageNum) {
    if (!this.stagesUnlocked[stageNum]) {
      window.app?.showToast(`Stage ${stageNum} is locked! Complete the previous question to unlock.`, 'error');
      window.soundManager?.playError();
      return;
    }

    this.currentStage = stageNum;

    document.querySelectorAll('.tr1-stage-view').forEach(view => {
      const s = parseInt(view.getAttribute('data-stage'), 10);
      view.classList.toggle('active', s === stageNum);
    });

    this.updateStepperUI();

    if (stageNum === 1) {
      if (!this.hashiEngine || !this.hashiEngine.svg || !document.contains(this.hashiEngine.svg)) {
        this.initStage1Board();
      } else {
        setTimeout(() => this.hashiEngine.updateVisualState(), 50);
      }
    }
  }

  updateStepperUI() {
    document.querySelectorAll('.tr1-step-btn').forEach(btn => {
      const s = parseInt(btn.getAttribute('data-stage'), 10);
      btn.classList.toggle('active', s === this.currentStage);
      btn.classList.toggle('locked', !this.stagesUnlocked[s]);
      btn.classList.toggle('completed', !!this.stagesCompleted[s]);

      const statusEl = document.getElementById(`tr1-step-${s}-status`);
      if (statusEl) {
        if (this.stagesCompleted[s]) {
          statusEl.textContent = '✓';
          statusEl.classList.add('completed');
        } else if (!this.stagesUnlocked[s]) {
          statusEl.textContent = String(s);
          statusEl.classList.remove('completed');
        } else {
          statusEl.textContent = String(s);
          statusEl.classList.remove('completed');
        }
      }
    });
  }

  // ----------------------------------------------------
  // STAGE 1: HASHI 10x10 BRIDGES ENGINE
  // ----------------------------------------------------
  initStage1Board() {
    if (!this.puzzleFY) return;
    const container = document.getElementById('tr1-hashi-board-container');
    if (!container) return;
    container.innerHTML = '';

    this.hashiEngine = new BridgesEngine(container, this.puzzleFY, {
      showGuides: true,
      autoMarkSatisfied: true,
      interactive: true,
      soundEnabled: true,
      onMove: () => this.updateStage1Status()
    });

    this.updateStage1Status();
  }

  updateStage1Status() {
    const statusPill = document.getElementById('tr1-stage1-status-pill');
    if (!statusPill || !this.hashiEngine) return;

    const stats = this.hashiEngine.getStats();
    statusPill.textContent = `${stats.satisfied}/${stats.total} Islands Satisfied • ${stats.bridgesCount} Bridges`;
    if (stats.satisfied === stats.total) {
      statusPill.style.color = 'var(--text-primary)';
    } else {
      statusPill.style.color = 'var(--text-secondary)';
    }
  }

  async verifyStage1() {
    if (!this.hashiEngine) return;
    const bridges = this.hashiEngine.exportBridges();

    try {
      const res = await fetch('/api/round2/validate-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attempt_id: this.attempt?.id,
          track: 'track1',
          stage: 1,
          data: { bridges }
        })
      });
      const data = await res.json();

      if (data.valid) {
        this.stagesCompleted[1] = true;
        this.stagesUnlocked[2] = true;
        this.updateStepperUI();

        window.soundManager?.playFanfare();
        window.app?.triggerConfetti();
        window.app?.showToast('Stage 1 Solved! Stage 2: The Pig Fortress Problem Unlocked. 2 Power-Ups Unlocked.', 'success');

        // Notify power-ups manager
        window.powerupsManager?.updatePool(data.questions_solved || 1, data.unlocked_powerups);

        // Advance to Stage 2 after a brief delay
        setTimeout(() => this.switchStage(2), 700);
      } else {
        window.soundManager?.playError();
        window.app?.showToast(`Stage 1 check failed: ${data.reason || 'Not yet fully solved'}`, 'error');
      }
    } catch (err) {
      console.error(err);
      window.app?.showToast('Error validating Stage 1 with server', 'error');
    }
  }

  // ----------------------------------------------------
  // STAGE 2: THE PIG FORTRESS PROBLEM
  // ----------------------------------------------------
  initStage2UI() {
    this.renderBirdPool();
    this.renderLaunchSlots();
  }

  setPigType(pig, type) {
    this.pigsClassification[pig] = type;

    // Update active button classes
    document.querySelectorAll(`.pig-toggle-btn[data-pig="${pig}"]`).forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-type') === type);
    });

    this.recalculateScoring();
  }

  renderLaunchSlots() {
    const slotsContainer = document.getElementById('tr1-launch-slots');
    if (!slotsContainer) return;
    slotsContainer.innerHTML = '';

    for (let pos = 1; pos <= 5; pos++) {
      const slot = document.createElement('div');
      slot.className = 'sequence-slot';
      const birdId = this.launchOrder[pos - 1];
      const bird = this.availableBirds.find(b => b.id === birdId);

      slot.innerHTML = `
        <span class="slot-idx">${pos}</span>
        <span class="slot-val ${bird ? 'filled' : ''}">${bird ? bird.name : '—'}</span>
      `;

      if (bird) {
        slot.title = 'Click to remove';
        slot.style.cursor = 'pointer';
        slot.addEventListener('click', () => {
          this.removeBirdFromOrder(pos - 1);
        });
      }
      slotsContainer.appendChild(slot);
    }
  }

  renderBirdPool() {
    const poolContainer = document.getElementById('tr1-bird-pool');
    if (!poolContainer) return;
    poolContainer.innerHTML = '';

    this.availableBirds.forEach(bird => {
      const isPlaced = this.launchOrder.includes(bird.id);
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `video-chip ${isPlaced ? 'placed' : ''}`;
      chip.style.borderColor = bird.color;
      chip.innerHTML = `<strong>${bird.name}</strong> <span style="font-size: 0.7rem; opacity: 0.8;">(P:${bird.power})</span>`;

      if (!isPlaced && this.launchOrder.length < 5) {
        chip.addEventListener('click', () => {
          this.launchOrder.push(bird.id);
          this.renderBirdPool();
          this.renderLaunchSlots();
          this.recalculateScoring();
        });
      } else {
        chip.disabled = isPlaced;
      }

      poolContainer.appendChild(chip);
    });
  }

  removeBirdFromOrder(index) {
    this.launchOrder.splice(index, 1);
    this.renderBirdPool();
    this.renderLaunchSlots();
    this.recalculateScoring();
  }

  resetBirdOrder() {
    this.launchOrder = [];
    this.renderBirdPool();
    this.renderLaunchSlots();
    this.recalculateScoring();
  }

  recalculateScoring() {
    // Check if all 5 birds placed
    const breakdownEl = document.getElementById('tr1-calc-breakdown');
    if (!breakdownEl) return;

    if (this.launchOrder.length !== 5) {
      breakdownEl.innerHTML = '<span style="color: var(--text-tertiary);">Place all 5 birds in launch positions (1 to 5) to compute damage.</span>';
      return;
    }

    // Bird immediately after Bomb gets base power doubled!
    const bombIndex = this.launchOrder.indexOf('bomb');
    let totalDamage = 0;
    const lines = [];

    this.launchOrder.forEach((birdId, idx) => {
      const pos = idx + 1;
      const bird = this.availableBirds.find(b => b.id === birdId);
      const isDoubled = (idx === bombIndex + 1);
      const effectivePower = isDoubled ? bird.power * 2 : bird.power;
      const dmg = pos * effectivePower;
      totalDamage += dmg;

      lines.push(`${bird.name} (Pos ${pos} × Power ${effectivePower}${isDoubled ? ' [Doubled!]' : ''}) = ${dmg}`);
    });

    // Count Honest / Liar pigs
    let honestCount = 0;
    let liarCount = 0;
    Object.values(this.pigsClassification).forEach(t => {
      if (t === 'Honest') honestCount++;
      if (t === 'Liar') liarCount++;
    });

    const calculatedPin = totalDamage * honestCount * liarCount;

    breakdownEl.innerHTML = `
      <div style="font-size: 0.8rem; line-height: 1.5; color: var(--text-secondary);">
        ${lines.join(' • ')}<br>
        <strong>Total Damage:</strong> <span class="mono" style="color: var(--text-primary); font-size: 0.95rem;">${totalDamage}</span> |
        <strong>Pigs:</strong> ${honestCount} Honest, ${liarCount} Liars |
        <strong>Calculated PIN:</strong> <span class="mono" style="color: var(--text-primary); font-weight: 700; font-size: 1rem;">${calculatedPin > 0 ? calculatedPin : '—'}</span>
      </div>
    `;

    // Auto-fill input fields if present
    const damageInput = document.getElementById('tr1-input-damage');
    const pinInput = document.getElementById('tr1-input-vault-pin');
    if (damageInput && !damageInput.value) damageInput.value = totalDamage;
    if (pinInput && calculatedPin > 0 && !pinInput.value) pinInput.value = calculatedPin;
  }

  async verifyStage2() {
    const pinInput = document.getElementById('tr1-input-vault-pin');
    const damageInput = document.getElementById('tr1-input-damage');
    const pinVal = parseInt(pinInput?.value || '0', 10);
    const damageVal = parseInt(damageInput?.value || '0', 10);

    const data = {
      pigs: this.pigsClassification,
      launch_order: this.launchOrder,
      vault_pin: pinVal,
      total_damage: damageVal
    };

    try {
      const res = await fetch('/api/round2/validate-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attempt_id: this.attempt?.id,
          track: 'track1',
          stage: 2,
          data
        })
      });
      const result = await res.json();

      if (result.valid) {
        this.stagesCompleted[2] = true;
        this.stagesUnlocked[3] = true;
        this.updateStepperUI();

        window.soundManager?.playFanfare();
        window.app?.triggerConfetti();
        window.app?.showToast('Stage 2 Solved! Vault PIN: 1788 Verified! Stage 3: 25 Officer Puzzle Unlocked. 4 Power-Ups in Pool.', 'success');

        window.powerupsManager?.updatePool(result.questions_solved || 2, result.unlocked_powerups);

        setTimeout(() => this.switchStage(3), 700);
      } else {
        window.soundManager?.playError();
        window.app?.showToast(`Pig Fortress verification failed: ${result.reason || 'Incorrect PIN or order'}`, 'error');
      }
    } catch (err) {
      console.error(err);
      window.app?.showToast('Error validating Stage 2 with server', 'error');
    }
  }

  // ----------------------------------------------------
  // STAGE 3: THE 25 OFFICER PUZZLE (GRAECO-LATIN SQUARE)
  // ----------------------------------------------------
  initStage3Board() {
    this.renderOfficerBank();
    this.renderOfficerGrid();
  }

  renderOfficerBank() {
    const bank = document.getElementById('tr1-officer-bank');
    if (!bank) return;
    bank.innerHTML = '';

    // Generate 25 pieces: 5 colors x 5 chess pieces
    this.officerColors.forEach(color => {
      this.officerPieces.forEach(piece => {
        // Count how many are placed on board (max 1 of each pair!)
        const isPlaced = this.officerGrid.some(cell => cell && cell.color === color && cell.piece === piece);

        const pieceEl = document.createElement('div');
        pieceEl.className = `puzzle-piece ${isPlaced ? 'placed' : ''}`;
        pieceEl.draggable = !isPlaced;
        pieceEl.style.backgroundColor = this.colorHexMap[color] || '#3b82f6';
        pieceEl.style.color = '#ffffff';
        pieceEl.textContent = piece;
        pieceEl.title = `${color} ${piece}`;

        if (!isPlaced) {
          pieceEl.addEventListener('click', () => {
            this.selectOfficerPiece({ color, piece }, pieceEl);
          });

          pieceEl.addEventListener('dragstart', (e) => {
            this.draggedOfficer = { color, piece };
            e.dataTransfer.setData('text/plain', JSON.stringify({ color, piece }));
          });
        }

        bank.appendChild(pieceEl);
      });
    });
  }

  selectOfficerPiece(pieceData, el) {
    document.querySelectorAll('#tr1-officer-bank .puzzle-piece').forEach(p => p.classList.remove('selected'));
    if (this.selectedOfficer && this.selectedOfficer.color === pieceData.color && this.selectedOfficer.piece === pieceData.piece) {
      this.selectedOfficer = null;
    } else {
      this.selectedOfficer = pieceData;
      el.classList.add('selected');
      window.app?.showToast(`Selected: ${pieceData.color} ${pieceData.piece}. Click any grid square to place.`, 'info');
    }
  }

  renderOfficerGrid() {
    const gridEl = document.getElementById('tr1-officer-grid');
    if (!gridEl) return;
    gridEl.innerHTML = '';

    for (let i = 0; i < 25; i++) {
      const r = Math.floor(i / 5);
      const c = i % 5;
      const cellData = this.officerGrid[i];

      const cellEl = document.createElement('div');
      cellEl.className = 'officer-cell';
      cellEl.setAttribute('data-idx', i);

      if (cellData) {
        const pieceDisplay = document.createElement('div');
        pieceDisplay.className = 'puzzle-piece in-grid';
        pieceDisplay.style.backgroundColor = this.colorHexMap[cellData.color] || '#3b82f6';
        pieceDisplay.style.color = '#ffffff';
        pieceDisplay.textContent = cellData.piece;
        pieceDisplay.title = `Row ${r + 1}, Col ${c + 1}: ${cellData.color} ${cellData.piece} (Click to remove)`;
        
        pieceDisplay.addEventListener('click', (e) => {
          e.stopPropagation();
          this.officerGrid[i] = null;
          this.renderOfficerBank();
          this.renderOfficerGrid();
          this.checkOfficerConflicts();
        });

        cellEl.appendChild(pieceDisplay);
      }

      // Drag & Drop handlers
      cellEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        cellEl.classList.add('drag-over');
      });

      cellEl.addEventListener('dragleave', () => {
        cellEl.classList.remove('drag-over');
      });

      cellEl.addEventListener('drop', (e) => {
        e.preventDefault();
        cellEl.classList.remove('drag-over');
        if (this.draggedOfficer) {
          this.officerGrid[i] = this.draggedOfficer;
          this.draggedOfficer = null;
          this.selectedOfficer = null;
          this.renderOfficerBank();
          this.renderOfficerGrid();
          this.checkOfficerConflicts();
        }
      });

      // Tap-to-place handler
      cellEl.addEventListener('click', () => {
        if (this.selectedOfficer) {
          this.officerGrid[i] = this.selectedOfficer;
          this.selectedOfficer = null;
          this.renderOfficerBank();
          this.renderOfficerGrid();
          this.checkOfficerConflicts();
        }
      });

      gridEl.appendChild(cellEl);
    }

    this.checkOfficerConflicts();
  }

  checkOfficerConflicts() {
    const conflictBadge = document.getElementById('tr1-officer-conflict-status');
    if (!conflictBadge) return;

    let placedCount = 0;
    const rowColors = Array.from({ length: 5 }, () => new Set());
    const rowPieces = Array.from({ length: 5 }, () => new Set());
    const colColors = Array.from({ length: 5 }, () => new Set());
    const colPieces = Array.from({ length: 5 }, () => new Set());

    let hasConflict = false;

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const item = this.officerGrid[r * 5 + c];
        if (!item) continue;
        placedCount++;

        if (rowColors[r].has(item.color) || rowPieces[r].has(item.piece) ||
            colColors[c].has(item.color) || colPieces[c].has(item.piece)) {
          hasConflict = true;
        }

        rowColors[r].add(item.color);
        rowPieces[r].add(item.piece);
        colColors[c].add(item.color);
        colPieces[c].add(item.piece);
      }
    }

    if (hasConflict) {
      conflictBadge.textContent = `Conflict detected: duplicate color or piece in row/column (${placedCount}/25 placed)`;
      conflictBadge.style.color = 'var(--rose-500)';
    } else if (placedCount === 25) {
      conflictBadge.textContent = `All 25 officers placed without conflict. Graeco-Latin Square complete.`;
      conflictBadge.style.color = 'var(--text-primary)';
    } else {
      conflictBadge.textContent = `${placedCount}/25 officers placed. No conflicts so far.`;
      conflictBadge.style.color = 'var(--text-secondary)';
    }
  }

  resetOfficerGrid() {
    this.officerGrid = new Array(25).fill(null);
    this.renderOfficerBank();
    this.renderOfficerGrid();
  }

  // Pre-fill canonical 5x5 Graeco-Latin Square for quick demo/testing
  solveOfficerPuzzleDemo() {
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const color = this.officerColors[(r + c) % 5];
        const piece = this.officerPieces[(r + 2 * c) % 5];
        this.officerGrid[r * 5 + c] = { color, piece };
      }
    }
    this.renderOfficerBank();
    this.renderOfficerGrid();
    window.app?.showToast('Canonical 5x5 Graeco-Latin Square arrangement loaded!', 'success');
  }

  async verifyStage3() {
    const passcodeInput = document.getElementById('tr1-input-officer-passcode');
    const passcodeVal = String(passcodeInput?.value || '').trim();

    const data = {
      passcode: passcodeVal,
      arrangement: this.officerGrid
    };

    try {
      const res = await fetch('/api/round2/validate-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attempt_id: this.attempt?.id,
          track: 'track1',
          stage: 3,
          data
        })
      });
      const result = await res.json();

      if (result.valid) {
        this.stagesCompleted[3] = true;
        this.stagesUnlocked[4] = true;
        this.updateStepperUI();

        window.soundManager?.playFanfare();
        window.app?.triggerConfetti();
        window.app?.showToast('Stage 3 Conquered! All 3 Challenges Solved. Full Power-Up Pool Unlocked (5 of 5).', 'success');

        window.powerupsManager?.updatePool(3, result.unlocked_powerups);

        // Open summary view or power-ups tab
        setTimeout(() => {
          this.switchStage(4);
        }, 800);
      } else {
        window.soundManager?.playError();
        window.app?.showToast(`Verification failed: ${result.reason || 'Check grid or secret passcode'}`, 'error');
      }
    } catch (err) {
      console.error(err);
      window.app?.showToast('Error validating Stage 3 with server', 'error');
    }
  }

  startAttempt(attemptData) {
    this.attempt = attemptData;
    this.stagesUnlocked = { 1: true, 2: false, 3: false, 4: false };
    this.stagesCompleted = { 1: false, 2: false, 3: false };
    this.updateStepperUI();
    this.switchStage(1);
  }

  startNewAttempt(studentName, studentId, batch, lab, attemptId) {
    this.attempt = {
      id: attemptId,
      student_name: studentName,
      student_id: studentId,
      batch,
      lab
    };
    this.stagesUnlocked = { 1: true, 2: false, 3: false, 4: false };
    this.stagesCompleted = { 1: false, 2: false, 3: false };
    localStorage.setItem('hashi_tr1_attempt', JSON.stringify(this.attempt));
    this.updateStudentHeader(studentName, studentId, batch, lab);
    this.startRoundTimer();
    this.updateStepperUI();
    this.switchStage(1);
    window.app?.showToast(`Joined FY Track as ${studentName}! 30-minute timer started.`, 'success');
  }

  updateStudentHeader(name, id, batch, lab) {
    const nameEl = document.getElementById('tr1-display-student-name');
    const idEl = document.getElementById('tr1-display-student-id');
    const batchEl = document.getElementById('tr1-display-batch');
    const labEl = document.getElementById('tr1-display-lab');
    const avatarEl = document.getElementById('tr1-display-avatar');

    if (nameEl) nameEl.textContent = name;
    if (idEl) idEl.textContent = id;
    if (batchEl) batchEl.textContent = batch;
    if (labEl) labEl.textContent = lab || 'Lab 1';
    if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();
  }

  // Single 30-Minute Round Timer
  startRoundTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    const totalSeconds = 1800; // 30 minutes
    const startTime = Date.now();

    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      this.elapsedSeconds = elapsed;
      const remaining = Math.max(0, totalSeconds - elapsed);
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      const str = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

      const clockEl = document.getElementById('tr1-timer-clock');
      const headerTimer = document.getElementById('header-global-timer');
      if (clockEl) {
        clockEl.textContent = str;
        if (remaining <= 300) {
          clockEl.style.color = 'var(--rose-500)';
        }
      }
      if (headerTimer) {
        headerTimer.textContent = str;
        if (remaining <= 300) {
          headerTimer.style.color = 'var(--rose-500)';
        }
      }

      if (remaining <= 0) {
        clearInterval(this.timerInterval);
        window.app?.showToast('Time is up for Round 2! Please review and submit your power-ups.', 'warning');
      }
    }, 1000);
  }
}

// Instantiate on load
window.addEventListener('DOMContentLoaded', () => {
  window.track1Manager = new Track1Manager();
});
