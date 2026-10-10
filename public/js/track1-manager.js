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
    this.isTimeUp = false;

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
      let data = null;
      try {
        const res = await fetch('/api/track1/info');
        if (res.ok) {
          data = await res.json();
          localStorage.setItem('cached_track1_info', JSON.stringify(data));
        }
      } catch (netErr) {
        console.warn('Network issue fetching Track 1 info, using cached if available:', netErr);
      }

      if (!data) {
        const cached = localStorage.getItem('cached_track1_info');
        if (cached) data = JSON.parse(cached);
      }

      if (data) {
        this.config = data;
        this.puzzleFY = data.puzzle;

        this.initStage1Board();
        this.initStage2UI();
        this.initStage3Board();
        this.updateStepperUI();
      }
    } catch (err) {
      console.error('Failed to load Track 1 info:', err);
    }
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

    // Stage 2 Pig buttons
    document.querySelectorAll('.pig-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pig = btn.getAttribute('data-pig');
        const type = btn.getAttribute('data-type');
        this.setPigType(pig, type);
      });
    });

    // Stage 2 Bird order reset
    document.getElementById('tr1-btn-reset-bird-order')?.addEventListener('click', () => {
      this.resetBirdOrder();
    });

    // Stage 3 Verification & Actions
    document.getElementById('tr1-btn-clear-officers')?.addEventListener('click', () => {
      if (confirm('Clear the 5x5 officer grid?')) this.resetOfficerGrid();
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
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (stageNum === 1) {
      if (!this.hashiEngine || !this.hashiEngine.svg || !document.contains(this.hashiEngine.svg)) {
        this.initStage1Board();
      } else {
        setTimeout(() => this.hashiEngine.updateVisualState(), 50);
      }
    } else if (stageNum === 2) {
      this.initStage2UI();
    } else if (stageNum === 3) {
      this.initStage3Board();
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
        } else {
          statusEl.textContent = String(s);
          statusEl.classList.remove('completed');
        }
      }
    });

    this.syncButtonStates();
  }

  syncButtonStates() {
    const btn1 = document.getElementById('tr1-btn-verify-stage1');
    if (btn1) {
      if (this.stagesCompleted[1]) {
        btn1.className = 'btn-primary btn-success-verified';
        btn1.innerHTML = '<span>✓ Stage 1 Accepted • Continue to Stage 2 →</span>';
        btn1.disabled = false;
        btn1.style.opacity = '1';
      } else {
        btn1.className = 'btn-primary';
        btn1.innerHTML = '<span>Verify & Unlock Next Stage →</span>';
      }
    }

    const btn2 = document.getElementById('tr1-btn-verify-stage2');
    if (btn2) {
      if (this.stagesCompleted[2]) {
        btn2.className = 'btn-primary btn-success-verified';
        btn2.innerHTML = '<span>✓ Stage 2 Accepted • Continue to Stage 3 →</span>';
        btn2.disabled = false;
        btn2.style.opacity = '1';
      } else {
        btn2.className = 'btn-primary';
        btn2.innerHTML = '<span>Verify & Unlock Final Stage →</span>';
      }
    }

    const btn3 = document.getElementById('tr1-btn-verify-stage3');
    if (btn3) {
      if (this.stagesCompleted[3]) {
      window.powerupsManager?.updatePool(3);
        btn3.className = 'btn-primary btn-success-verified';
        btn3.innerHTML = '<span>✓ Stage 3 Accepted • Proceed to Power-Ups Selection →</span>';
        btn3.disabled = false;
        btn3.style.opacity = '1';
      } else {
        btn3.className = 'btn-primary';
        btn3.innerHTML = '<span>Verify & Submit 25 Officers</span>';
      }
    }
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
      onMove: () => {
        this.updateStage1Status();
        this.saveProgress();
      },
      onStateChange: () => {
        this.updateStage1Status();
        this.saveProgress();
      },
      onSolved: () => {
        const btn = document.getElementById('tr1-btn-verify-stage1');
        if (btn && !this.stagesCompleted[1]) {
          btn.classList.add('pulse-ready');
          btn.innerHTML = '<span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Board Solved! Click to Verify & Unlock 2 Power-Ups →</span>';
        }
        if (window.powerupsManager) {
          window.powerupsManager.updatePool(1, ['time_cracker', 'topic_finder']);
        }
        window.app?.showToast('🎉 All 24 islands satisfied! 2 Power-Ups Unlocked in Real Time (Time Cracker <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> + Topic Finder <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>)!', 'success');
      }
    });

    if (this._pendingBridges && this._pendingBridges.length > 0) {
      this.hashiEngine.loadBridges(this._pendingBridges);
      this._pendingBridges = null;
    }

    this.updateStage1Status();
  }

  solveHashiDemo() {
    if (!this.hashiEngine || !this.puzzleFY || !this.puzzleFY.solutionEdges) return;
    this.hashiEngine.loadBridges(this.puzzleFY.solutionEdges);
    if (window.powerupsManager) {
      window.powerupsManager.updatePool(1, ['time_cracker', 'topic_finder']);
    }
    window.app?.showToast('FY 10×10 solution loaded! 2 Power-Ups Unlocked in Real Time.', 'success');
  }

  updateStage1Status() {
    const statusPill = document.getElementById('tr1-stage1-status-pill');
    if (!statusPill || !this.hashiEngine) return;

    const stats = this.hashiEngine.getStats();
    statusPill.textContent = `${stats.satisfied}/${stats.total} Islands Satisfied • ${stats.bridgesCount} Bridges`;
    if (stats.satisfied === stats.total && stats.total > 0) {
      statusPill.style.color = 'var(--emerald-500, #10b981)';
    } else if (stats.satisfied > 0) {
      statusPill.style.color = 'var(--island-satisfied-text, #34d399)';
    } else {
      statusPill.style.color = 'var(--text-secondary)';
    }
  }

  async verifyStage1() {
    if (this.isTimeUp) {
      window.app?.showToast('Time is up for Round 2! Answers are locked and cannot be modified.', 'error');
      window.app?.showTimeUpModal();
      return;
    }

    if (this.stagesCompleted[1]) {
      this.switchStage(2);
      return;
    }

    if (!this.hashiEngine) {
      window.app?.showToast('Board engine is initializing, please wait a moment...', 'info');
      return;
    }

    const btn = document.getElementById('tr1-btn-verify-stage1');
    const originalContent = btn ? btn.innerHTML : null;
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.7';
      btn.innerHTML = '<span>Verifying...</span>';
    }

    try {
      const localEval = this.hashiEngine.evaluateState ? this.hashiEngine.evaluateState() : { isSolved: false };
      const bridges = (typeof this.hashiEngine.exportBridges === 'function')
        ? this.hashiEngine.exportBridges()
        : Array.from(this.hashiEngine.bridgeState.entries()).map(([k, cnt]) => {
            const [u, v] = k.split('-').map(Number);
            return { u, v, count: cnt };
          });

      let data = null;
      try {
        const res = await fetch('/api/round2/validate-stage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attempt_id: this.attempt?.id || localStorage.getItem('hashi_tr1_latest_attempt_id') || '',
            track: 'track1',
            stage: 1,
            data: { bridges }
          })
        });
        if (res.ok) {
          data = await res.json();
        }
      } catch (err) {
        console.warn('Server validation request issue, falling back to local Nikoli engine:', err);
      }

      // Graceful Client-side Fallback
      if (!data) {
        if (localEval.isSolved) {
          data = {
            valid: true,
            questions_solved: 1,
            unlocked_powerups: ['time_cracker', 'topic_finder']
          };
        } else {
          let reason = 'Bridges do not satisfy all island rules.';
          if (!localEval.isFullyConnected) {
            reason = 'All islands must form a single unified network (found disconnected island groups).';
          } else if (localEval.completedCount < localEval.totalCount) {
            reason = `Only ${localEval.completedCount} of ${localEval.totalCount} islands are satisfied. Check bridge counts!`;
          }
          data = { valid: false, reason };
        }
      }

      if (data.valid) {
        this.stagesCompleted[1] = true;
        this.stagesUnlocked[2] = true;
        this.updateStepperUI();
        this.saveProgress();
        this.syncButtonStates();

        window.powerupsManager?.updatePool(data.questions_solved || 1, data.unlocked_powerups || ['time_cracker', 'topic_finder']);

        window.soundManager?.playFanfare();
        window.app?.triggerConfetti();

        window.app?.showAcceptedToast(1, ['Time Cracker', 'Topic Finder'], '2/5');

        window.app?.showStageConfirmation({
          isCorrect: true,
          stageNumber: 1,
          unlockedPowerups: ['time_cracker', 'topic_finder'],
          poolSize: '2/5',
          title: 'Stage 1 Verified',
          message: 'All 24 islands are correctly connected into a single unified network according to Nikoli rules.',
          reward: '<strong>Rewards Earned:</strong> +500 Points',
          buttonText: 'Continue to Stage 2: Pig Fortress →',
          onAction: () => this.switchStage(2)
        });
      } else {
        window.soundManager?.playError();
        window.app?.showStageConfirmation({
          isCorrect: false,
          stageNumber: 1,
          title: 'Incorrect Answer',
          message: data.reason || 'Bridges do not satisfy all island rules or network is disconnected.',
          buttonText: 'Review & Try Again'
        });
      }
    } finally {
      if (btn && !this.stagesCompleted[1]) {
        btn.disabled = false;
        btn.style.opacity = '1';
        if (originalContent) btn.innerHTML = originalContent;
      }
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
    if (this.isTimeUp) return;
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

  shuffleBirdPool() {
    const original = this.availableBirds.map(bird => bird.id);
    // Reject the solution order so the starting pool never gives away the answer.
    do {
      this.birdPoolOrder = [...original];
      for (let i = this.birdPoolOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.birdPoolOrder[i], this.birdPoolOrder[j]] = [this.birdPoolOrder[j], this.birdPoolOrder[i]];
      }
    } while (this.birdPoolOrder.every((id, index) => id === original[index]));
  }

  renderBirdPool() {
    const poolContainer = document.getElementById('tr1-bird-pool');
    if (!poolContainer) return;
    poolContainer.innerHTML = '';

    if (!this.birdPoolOrder) this.shuffleBirdPool();
    this.birdPoolOrder.forEach(birdId => {
      const bird = this.availableBirds.find(item => item.id === birdId);
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
    const breakdownEl = document.getElementById('tr1-calc-breakdown');
    if (!breakdownEl) return;

    if (this.launchOrder.length !== 5) {
      breakdownEl.innerHTML = '<span style="color: var(--text-tertiary);">Place all 5 birds in launch positions (1 to 5) to compute damage.</span>';
      return;
    }

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

    let honestCount = 0;
    let liarCount = 0;
    Object.values(this.pigsClassification).forEach(t => {
      if (t === 'Honest') honestCount++;
      if (t === 'Liar') liarCount++;
    });

    const calculatedPin = totalDamage * honestCount * liarCount;

    // Synchronize inputs if they are present in the DOM
    const dmgInput = document.getElementById('tr1-input-damage');
    const pinInput = document.getElementById('tr1-input-vault-pin');
    if (dmgInput && (!dmgInput.value || dmgInput.value === '0')) dmgInput.value = totalDamage;
    if (calculatedPin === 1788 && this.launchOrder.length === 5) {
      if (window.powerupsManager) {
        window.powerupsManager.updatePool(2);
      }
    }

    breakdownEl.innerHTML = `
      <div style="font-size: 0.8rem; line-height: 1.5; color: var(--text-secondary);">
        ${lines.join(' • ')}<br>
        <strong>Total Damage:</strong> <span class="mono" style="color: var(--text-primary); font-size: 0.95rem;">${totalDamage}</span> |
        <strong>Pigs:</strong> ${honestCount} Honest, ${liarCount} Liars |
        <strong>Calculated PIN:</strong> <span class="mono" style="color: var(--text-primary); font-weight: 700; font-size: 1rem;">${calculatedPin > 0 ? calculatedPin : '—'}</span>
      </div>
    `;
  }

  solvePigFortressDemo() {
    this.pigsClassification = {
      Minion: 'Honest',
      Corporal: 'Liar',
      Foreman: 'Liar',
      King: 'Honest',
      Helmet: 'Honest'
    };
    document.querySelectorAll('.pig-toggle-btn').forEach(btn => {
      const pig = btn.getAttribute('data-pig');
      const type = btn.getAttribute('data-type');
      btn.classList.toggle('active', this.pigsClassification[pig] === type);
    });
    this.launchOrder = ['red', 'chuck', 'matilda', 'bomb', 'hal'];
    this.renderBirdPool();
    this.renderLaunchSlots();
    const dmgInput = document.getElementById('tr1-input-damage');
    const pinInput = document.getElementById('tr1-input-vault-pin');
    if (dmgInput) dmgInput.value = '298';
    if (pinInput) pinInput.value = '1788';
    this.recalculateScoring();
    if (window.powerupsManager) {
      window.powerupsManager.updatePool(2);
    }
    window.app?.showToast('Stage 2 Pig Fortress solution loaded! 4 Power-Ups Unlocked in Real Time.', 'success');
  }

  solveOfficersDemo() {
    const input = document.getElementById('tr1-input-officer-passcode');
    if (input) input.value = 'tuhaikon@codestars';
    if (window.powerupsManager) {
      window.powerupsManager.updatePool(3);
    }
    window.app?.showToast('Stage 3 passcode loaded! All 5 Power-Ups Unlocked in Real Time.', 'success');
  }

  async verifyStage2() {
    if (this.isTimeUp) {
      window.app?.showToast('Time is up for Round 2! Answers are locked and cannot be modified.', 'error');
      window.app?.showTimeUpModal();
      return;
    }

    if (this.stagesCompleted[2]) {
      this.switchStage(3);
      return;
    }

    const btn = document.getElementById('tr1-btn-verify-stage2');
    const originalContent = btn ? btn.innerHTML : null;
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.7';
      btn.innerHTML = '<span>Verifying Stage 2...</span>';
    }

    // Auto-calculate exact values from current selections
    let bombIndex = this.launchOrder.indexOf('bomb');
    let computedDamage = 0;
    this.launchOrder.forEach((birdId, idx) => {
      const pos = idx + 1;
      const bird = this.availableBirds.find(b => b.id === birdId);
      if (bird) {
        const isDoubled = (idx === bombIndex + 1);
        computedDamage += pos * (isDoubled ? bird.power * 2 : bird.power);
      }
    });

    let honestCount = 0;
    let liarCount = 0;
    Object.values(this.pigsClassification).forEach(t => {
      if (t === 'Honest') honestCount++;
      if (t === 'Liar') liarCount++;
    });
    const computedPin = computedDamage * honestCount * liarCount;

    const pinInput = document.getElementById('tr1-input-vault-pin');
    const damageInput = document.getElementById('tr1-input-damage');
    const pinVal = parseInt(pinInput?.value || computedPin || 0, 10);
    const damageVal = parseInt(damageInput?.value || computedDamage || 0, 10);

    const data = {
      pigs: this.pigsClassification,
      launch_order: this.launchOrder,
      vault_pin: pinVal,
      total_damage: damageVal
    };

    let result = null;

    try {
      const res = await fetch('/api/round2/validate-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attempt_id: this.attempt?.id || localStorage.getItem('hashi_tr1_latest_attempt_id') || '',
          track: 'track1',
          stage: 2,
          data
        })
      });

      if (res.ok) {
        result = await res.json();
      } else {
        console.warn(`Server validation returned status ${res.status}, using local solver fallback`);
      }
    } catch (err) {
      console.warn('Network issue during Stage 2 validation, evaluating locally:', err);
    }

    // Client-side evaluation fallback to avoid network lockouts
    if (!result) {
      const isMinion = String(this.pigsClassification.Minion || '').toUpperCase() === 'HONEST';
      const isCorporal = String(this.pigsClassification.Corporal || '').toUpperCase() === 'LIAR';
      const isForeman = String(this.pigsClassification.Foreman || '').toUpperCase() === 'LIAR';
      const isKing = String(this.pigsClassification.King || '').toUpperCase() === 'HONEST';
      const isHelmet = String(this.pigsClassification.Helmet || '').toUpperCase() === 'HONEST';
      const pigsCorrect = isMinion && isCorporal && isForeman && isKing && isHelmet;

      const expectedOrder = ['red', 'chuck', 'matilda', 'bomb', 'hal'];
      const cleanOrder = (this.launchOrder || []).map(b => String(b).toLowerCase());
      const orderCorrect = cleanOrder.length === 5 && cleanOrder.every((b, i) => b === expectedOrder[i]);
      const pinCorrect = pinVal === 1788;
      const damageCorrect = damageVal === 298;

      if (pinCorrect || (pigsCorrect && orderCorrect)) {
        result = {
          valid: true,
          questions_solved: 2,
          unlocked_powerups: ['time_cracker', 'topic_finder', 'penalty_sweeper', 'jumper_points'],
          reason: 'Pig Fortress deductions, bird launch sequence, and Vault PIN verified!'
        };
      } else {
        result = {
          valid: false,
          reason: !orderCorrect
            ? 'Launch sequence order is incorrect. Check pig clues!'
            : (!pigsCorrect ? 'Pig Honest/Liar classifications are incorrect.' : 'Vault PIN calculation is incorrect.')
        };
      }
    }

    try {
      if (result.valid) {
        this.stagesCompleted[2] = true;
        this.stagesUnlocked[3] = true;
        this.updateStepperUI();
        this.saveProgress();
        this.syncButtonStates();

        window.powerupsManager?.updatePool(result.questions_solved || 2, result.unlocked_powerups || ['time_cracker', 'topic_finder', 'penalty_sweeper', 'jumper_points']);

        window.soundManager?.playFanfare();
        window.app?.triggerConfetti();

        window.app?.showAcceptedToast(2, ['Penalty Sweeper', 'Jumper Points'], '4/5');

        window.app?.showStageConfirmation({
          isCorrect: true,
          stageNumber: 2,
          unlockedPowerups: ['penalty_sweeper', 'jumper_points'],
          poolSize: '4/5',
          title: 'Stage 2 Verified',
          message: result.reason || 'Pig Fortress deductions, bird launch sequence, and Vault PIN verified!',
          reward: '<strong>Rewards Earned:</strong> +1200 Points',
          buttonText: 'Continue to Stage 3: 25 Officers →',
          onAction: () => this.switchStage(3)
        });
      } else {
        window.soundManager?.playError();
        window.app?.showStageConfirmation({
          isCorrect: false,
          stageNumber: 2,
          title: 'Incorrect Answer',
          message: result.reason || 'Pig role classification, launch order, or vault PIN does not match.',
          buttonText: 'Review & Try Again'
        });
      }
    } finally {
      if (btn && !this.stagesCompleted[2]) {
        btn.disabled = false;
        btn.style.opacity = '1';
        if (originalContent) btn.innerHTML = originalContent;
      }
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

    this.officerColors.forEach(color => {
      this.officerPieces.forEach(piece => {
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
    if (this.isTimeUp) {
      window.app?.showToast('Time is up for Round 2! Answers are locked and cannot be modified.', 'error');
      window.app?.showTimeUpModal();
      return;
    }

    if (this.stagesCompleted[3]) {
      window.powerupsManager?.updatePool(3);
      this.switchStage(4);
      window.app?.switchTab('powerups');
      return;
    }

    const btn = document.getElementById('tr1-btn-verify-stage3');
    const originalContent = btn ? btn.innerHTML : null;
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.7';
      btn.innerHTML = '<span>Verifying Officers...</span>';
    }

    const passcodeInput = document.getElementById('tr1-input-officer-passcode');
    const passcodeVal = String(passcodeInput?.value || '').trim();

    const data = {
      passcode: passcodeVal,
      arrangement: this.officerGrid
    };

    let result = null;

    try {
      const res = await fetch('/api/round2/validate-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attempt_id: this.attempt?.id || localStorage.getItem('hashi_tr1_latest_attempt_id') || '',
          track: 'track1',
          stage: 3,
          data
        })
      });

      if (res.ok) {
        result = await res.json();
      } else {
        console.warn(`Server responded with HTTP ${res.status}, evaluating locally`);
      }
    } catch (err) {
      console.warn('Network issue during Stage 3 validation, checking passcode locally:', err);
    }

    // Client-side fallback for passcode confirmation
    if (!result) {
      if (passcodeVal.toLowerCase() === 'tuhaikon@codestars') {
        result = {
          valid: true,
          questions_solved: 3,
          unlocked_powerups: ['time_cracker', 'topic_finder', 'penalty_sweeper', 'jumper_points', 'sweet_sabotage'],
          reason: '25 Officer Puzzle verified! Secret passcode confirmed.'
        };
      } else {
        result = {
          valid: false,
          reason: 'Passcode is incorrect or officer grid is incomplete.'
        };
      }
    }

    try {
      if (result.valid) {
        this.stagesCompleted[3] = true;
        this.stagesUnlocked[4] = true;
        this.updateStepperUI();
        this.saveProgress();
        this.syncButtonStates();

        window.powerupsManager?.updatePool(3, result.unlocked_powerups || ['time_cracker', 'topic_finder', 'penalty_sweeper', 'jumper_points', 'sweet_sabotage']);

        window.soundManager?.playFanfare();
        window.app?.triggerConfetti();

        window.app?.showAcceptedToast(3, ['Sweet Sabotage (Ultimate)'], '5/5');

        window.app?.showStageConfirmation({
          isCorrect: true,
          stageNumber: 3,
          unlockedPowerups: ['sweet_sabotage'],
          poolSize: '5/5 (Full Pool)',
          title: 'Stage 3 Solved',
          message: 'The 25 Officer Graeco-Latin Square and secret verification passcode have been confirmed!',
          reward: '<strong>Rewards Earned:</strong> +1000 Points',
          buttonText: 'Proceed to Power-Ups Selection →',
          onAction: () => {
            this.switchStage(4);
            window.app?.switchTab('powerups');
          }
        });
      } else {
        window.soundManager?.playError();
        window.app?.showStageConfirmation({
          isCorrect: false,
          stageNumber: 3,
          title: 'Incorrect Answer',
          message: result.reason || 'Officers arrangement violates orthogonal rows/columns or passcode is incorrect.',
          buttonText: 'Review & Try Again'
        });
      }
    } finally {
      if (btn && !this.stagesCompleted[3]) {
        btn.disabled = false;
        btn.style.opacity = '1';
        if (originalContent) btn.innerHTML = originalContent;
      }
    }
  }

  saveProgress() {
    if (!this.attempt || !this.attempt.id) return;
    const progress = {
      attempt: this.attempt,
      startTime: this.startTime || Date.now(),
      stagesUnlocked: this.stagesUnlocked,
      stagesCompleted: this.stagesCompleted,
      currentStage: this.currentStage || 1,
      stage1Bridges: this.hashiEngine ? this.hashiEngine.serializeSolution() : (this._pendingBridges || []),
      pigsClassification: this.pigsClassification || {},
      launchOrder: this.launchOrder || [],
      birdPoolOrder: this.birdPoolOrder,
      damageInput: document.getElementById('tr1-input-damage')?.value || '',
      pinInput: document.getElementById('tr1-input-vault-pin')?.value || '',
      officerGrid: this.officerGrid || []
    };
    try {
      localStorage.setItem(`hashi_tr1_progress_${this.attempt.id}`, JSON.stringify(progress));
      localStorage.setItem('hashi_tr1_latest_attempt_id', this.attempt.id);
    } catch (e) {
      console.warn('Failed to save Track 1 progress to localStorage', e);
    }
  }

  restoreProgress(attemptId) {
    if (!attemptId) return false;
    const raw = localStorage.getItem(`hashi_tr1_progress_${attemptId}`);
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      if (!data) return false;

      this.attempt = data.attempt || this.attempt;
      this.startTime = data.startTime || Date.now();
      this.stagesUnlocked = data.stagesUnlocked || { 1: true, 2: false, 3: false, 4: false };
      this.stagesCompleted = data.stagesCompleted || { 1: false, 2: false, 3: false };
      this.currentStage = data.currentStage || 1;
      this.isTimeUp = false;

      // Remove lock banner if present
      const banner = document.getElementById('tr1-time-up-banner');
      if (banner) banner.remove();

      if (this.attempt) {
        this.updateStudentHeader(this.attempt.student_name, this.attempt.student_id, this.attempt.batch, this.attempt.lab);
      }
      this.updateStepperUI();
      this.startRoundTimer(this.startTime);

      // Restore Stage 1
      if (this.hashiEngine) {
        this.hashiEngine.setInteractive(true);
        if (data.stage1Bridges && data.stage1Bridges.length > 0) {
          this.hashiEngine.loadBridges(data.stage1Bridges);
        } else {
          this.hashiEngine.reset(true);
        }
        this.updateStage1Status();
      } else {
        this._pendingBridges = data.stage1Bridges || [];
      }

      // Restore Stage 2
      if (data.pigsClassification) {
        this.pigsClassification = data.pigsClassification;
        Object.entries(this.pigsClassification).forEach(([pig, type]) => {
          document.querySelectorAll(`.pig-toggle-btn[data-pig="${pig}"]`).forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-type') === type);
          });
        });
      }
      const savedPool = data.birdPoolOrder;
      if (Array.isArray(savedPool) && savedPool.length === this.availableBirds.length
        && new Set(savedPool).size === this.availableBirds.length
        && savedPool.every(id => this.availableBirds.some(bird => bird.id === id))
        && savedPool.some((id, index) => id !== this.availableBirds[index].id)) {
        this.birdPoolOrder = [...savedPool];
      } else {
        this.shuffleBirdPool();
      }
      this.renderBirdPool();
      if (data.launchOrder && Array.isArray(data.launchOrder)) {
        this.launchOrder = data.launchOrder;
        this.renderBirdPool();
        this.renderLaunchSlots();
      }
      if (data.damageInput !== undefined) {
        const dmgEl = document.getElementById('tr1-input-damage');
        if (dmgEl) dmgEl.value = data.damageInput;
      }
      if (data.pinInput !== undefined) {
        const pinEl = document.getElementById('tr1-input-vault-pin');
        if (pinEl) pinEl.value = data.pinInput;
      }
      this.recalculateScoring();

      // Restore Stage 3
      if (data.officerGrid && Array.isArray(data.officerGrid)) {
        this.officerGrid = data.officerGrid;
        this.renderOfficerBank();
        this.renderOfficerGrid();
        this.checkOfficerConflicts();
      }

      // Synchronize live power-up pool in real-time based on restored completed stages
      let solvedCount = 0;
      if (this.stagesCompleted[1]) solvedCount++;
      if (this.stagesCompleted[2]) solvedCount++;
      if (this.stagesCompleted[3]) solvedCount++;

      if (window.powerupsManager) {
        window.powerupsManager.attemptId = this.attempt?.id || attemptId;
        window.powerupsManager.updatePool(solvedCount);
      }

      this.switchStage(this.currentStage);
      return true;
    } catch (e) {
      console.error('Error restoring Track 1 progress:', e);
      return false;
    }
  }

  resetForNewAttempt(studentName, studentId, batch, lab, attemptId) {
    this.attempt = {
      id: attemptId || `att_tr1_${Date.now()}`,
      student_name: studentName,
      student_id: studentId,
      batch,
      lab
    };
    this.isTimeUp = false;

    // Remove lock banner if present
    const banner = document.getElementById('tr1-time-up-banner');
    if (banner) banner.remove();

    // Re-enable toolbar buttons
    ['tr1-hashi-undo', 'tr1-hashi-redo', 'tr1-hashi-reset', 'tr1-hashi-guides'].forEach(id => {
      const b = document.getElementById(id);
      if (b) { b.disabled = false; b.style.opacity = '1'; b.style.cursor = 'pointer'; }
    });

    // Reset Stage 1 Hashi engine
    if (this.hashiEngine) {
      this.hashiEngine.setInteractive(true);
      this.hashiEngine.reset(true);
      this.updateStage1Status();
    }
    this._pendingBridges = [];

    // Reset Stage 2 Pig Fortress
    this.shuffleBirdPool();
    this.pigsClassification = {
      Minion: null,
      Corporal: null,
      Foreman: null,
      King: null,
      Helmet: null
    };
    document.querySelectorAll('.pig-toggle-btn').forEach(btn => {
      btn.disabled = false;
      btn.style.cursor = 'pointer';
      btn.classList.remove('active');
    });
    this.launchOrder = [];
    this.renderBirdPool();
    this.renderLaunchSlots();
    const pinInput = document.getElementById('tr1-input-vault-pin');
    if (pinInput) { pinInput.disabled = false; pinInput.readOnly = false; pinInput.value = ''; }
    const damageInput = document.getElementById('tr1-input-damage');
    if (damageInput) { damageInput.disabled = false; damageInput.readOnly = false; damageInput.value = ''; }
    this.recalculateScoring();

    // Reset Stage 3 25 Officers
    this.officerGrid = new Array(25).fill(null);
    this.selectedOfficer = null;
    this.draggedOfficer = null;
    this.renderOfficerBank();
    this.renderOfficerGrid();
    this.checkOfficerConflicts();
    const passcode = document.getElementById('tr1-input-officer-passcode');
    if (passcode) { passcode.disabled = false; passcode.readOnly = false; passcode.value = ''; }
    document.querySelectorAll('.officer-palette-btn').forEach(b => {
      b.disabled = false;
      b.style.cursor = 'pointer';
    });

    // Re-enable verification buttons
    ['tr1-btn-verify-stage1', 'tr1-btn-verify-stage2', 'tr1-btn-verify-stage3', 'tr1-btn-final-submit'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
      }
    });

    // Reset stages state
    this.stagesUnlocked = { 1: true, 2: false, 3: false, 4: false };
    this.stagesCompleted = { 1: false, 2: false, 3: false };
    this.currentStage = 1;
    this.startTime = Date.now();

    this.updateStudentHeader(studentName, studentId, batch, lab);
    this.updateStepperUI();
    this.switchStage(1);
    this.startRoundTimer(this.startTime);
    this.saveProgress();
  }

  startOrResumeAttempt(studentName, studentId, batch, lab, attemptId) {
    this.attempt = {
      id: attemptId,
      student_name: studentName,
      student_id: studentId,
      batch,
      lab
    };
    this.updateStudentHeader(studentName, studentId, batch, lab);

    const restored = this.restoreProgress(attemptId);
    if (!restored) {
      this.resetForNewAttempt(studentName, studentId, batch, lab, attemptId);
      window.app?.showToast(`Joined FY Track as ${studentName}! 30-minute timer started.`, 'success');
    } else {
      window.app?.showToast(`Welcome back, ${studentName}! Progress restored.`, 'info');
    }
  }

  startNewAttempt(studentName, studentId, batch, lab, attemptId) {
    return this.startOrResumeAttempt(studentName, studentId, batch, lab, attemptId);
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
    if (avatarEl) avatarEl.textContent = (name || 'F').charAt(0).toUpperCase();
  }

  startRoundTimer(savedStartTime = null) {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (window.track2Manager?.timerInterval) {
      clearInterval(window.track2Manager.timerInterval);
      window.track2Manager.timerInterval = null;
    }
    const totalSeconds = 1800; // 30 minutes
    const startTime = savedStartTime || this.startTime || Date.now();
    this.startTime = startTime;

    const updateTick = () => {
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
        } else {
          clockEl.style.color = '';
        }
      }
      if (headerTimer) {
        headerTimer.textContent = str;
        if (remaining <= 300) {
          headerTimer.style.color = 'var(--rose-500)';
        } else {
          headerTimer.style.color = '';
        }
      }

      if (remaining <= 0) {
        this.onTimeUp();
      }
    };

    updateTick();
    this.timerInterval = setInterval(updateTick, 1000);
  }

  onTimeUp() {
    this.isTimeUp = true;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    if (this.hashiEngine) {
      this.hashiEngine.setInteractive(false);
    }
    ['tr1-hashi-undo', 'tr1-hashi-redo', 'tr1-hashi-reset', 'tr1-hashi-guides'].forEach(id => {
      const b = document.getElementById(id);
      if (b) { b.disabled = true; b.style.opacity = '0.5'; b.style.cursor = 'not-allowed'; }
    });

    document.querySelectorAll('.pig-toggle-btn').forEach(btn => {
      btn.disabled = true;
      btn.style.cursor = 'not-allowed';
    });
    document.querySelectorAll('.bird-token').forEach(tok => {
      tok.draggable = false;
      tok.style.cursor = 'not-allowed';
    });
    const pinInput = document.getElementById('tr1-input-vault-pin');
    if (pinInput) { pinInput.disabled = true; pinInput.readOnly = true; }
    const damageInput = document.getElementById('tr1-input-damage');
    if (damageInput) { damageInput.disabled = true; damageInput.readOnly = true; }

    document.querySelectorAll('.officer-palette-btn').forEach(b => {
      b.disabled = true;
      b.style.cursor = 'not-allowed';
    });
    const passcode = document.getElementById('tr1-input-officer-passcode');
    if (passcode) { passcode.disabled = true; passcode.readOnly = true; }

    ['tr1-btn-verify-stage1', 'tr1-btn-verify-stage2', 'tr1-btn-verify-stage3'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
      }
    });

    this.showLockedBanner();
    window.soundManager?.playError();
    window.app?.showTimeUpModal();
  }

  showLockedBanner() {
    let banner = document.getElementById('tr1-time-up-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'tr1-time-up-banner';
      banner.className = 'time-up-lock-banner';
      banner.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span>ROUND 2 TIME EXPIRED • ALL ANSWERS & BOARDS ARE LOCKED</span>
      `;
      const container = document.getElementById('view-track1');
      if (container) {
        container.insertBefore(banner, container.firstChild);
      }
    }
  }
}

// Reliable bootstrap on load
function bootstrapTrack1() {
  if (!window.track1Manager) {
    window.track1Manager = new Track1Manager();
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapTrack1);
} else {
  bootstrapTrack1();
}
