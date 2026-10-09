// Track 2: Codestars Tri-Challenge Manager
// Stage 1: Hashi 10*10 Hard
// Stage 2: WHO IS THE DEEPFAKE? (Codestars Non-Tech Brain Teaser)
// Stage 3: ZERO TO CRORE (Alphametic Cryptarithm)

class Track2Manager {
  constructor() {
    this.currentStage = 1;
    this.stagesUnlocked = { 1: true, 2: false, 3: false, 4: false };
    this.stagesCompleted = { 1: false, 2: false, 3: false };
    this.attempt = null;
    this.hashiEngine = null;
    this.puzzle10x10 = null;
    this.elapsedSeconds = 0;
    this.timerInterval = null;
    this.heartbeatInterval = null;
    this.tabSwitches = 0;
    this.isSubmitted = false;

    // Stage 2 state
    this.selectedDeepfake = null;
    this.uploadOrder = [];
    this.availableVideos = ['A', 'B', 'C', 'D', 'E'];

    // Stage 3 state
    this.letters = ['R', 'A', 'J', 'Z', 'E', 'O', 'C', 'G', 'N', 'S'];
    this.letterMapping = {
      R: '', A: '', J: '', Z: '', E: '', O: '', C: '', G: '', N: '', S: ''
    };
    this.revealedHints = new Set();

    this.init();
  }

  async init() {
    this.bindDOM();
    await this.loadTrackData();
  }

  bindDOM() {
    // Stepper buttons
    document.querySelectorAll('.tr2-step-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const stageNum = parseInt(btn.getAttribute('data-stage'), 10);
        if (stageNum) this.switchStage(stageNum);
      });
    });

    // Verification & Progression buttons
    document.getElementById('tr2-btn-verify-stage1')?.addEventListener('click', () => this.verifyStage1());
    document.getElementById('tr2-btn-verify-stage2')?.addEventListener('click', () => this.verifyStage2());
    document.getElementById('tr2-btn-verify-stage3')?.addEventListener('click', () => this.verifyStage3());
    document.getElementById('tr2-btn-to-powerups')?.addEventListener('click', () => window.app?.switchTab('powerups'));

    // Back navigation buttons
    document.getElementById('tr2-btn-back-to-stage1')?.addEventListener('click', () => this.switchStage(1));
    document.getElementById('tr2-btn-back-to-stage2')?.addEventListener('click', () => this.switchStage(2));
    document.getElementById('tr2-btn-back-to-stage3')?.addEventListener('click', () => this.switchStage(3));

    // Stage 1 Toolbar Controls
    document.getElementById('tr2-hashi-undo')?.addEventListener('click', () => this.hashiEngine?.undo());
    document.getElementById('tr2-hashi-redo')?.addEventListener('click', () => this.hashiEngine?.redo());
    document.getElementById('tr2-hashi-reset')?.addEventListener('click', () => {
      if (confirm('Clear all bridges on this 10x10 board?')) this.hashiEngine?.reset();
    });
    document.getElementById('tr2-hashi-guides')?.addEventListener('click', () => {
      if (this.hashiEngine) {
        this.hashiEngine.options.showGuides = !this.hashiEngine.options.showGuides;
        this.hashiEngine.updateVisualState();
        window.app?.showToast(this.hashiEngine.options.showGuides ? 'Ray guides on' : 'Ray guides off', 'info');
      }
    });

    // Stage 2: Deepfake video selection buttons
    document.querySelectorAll('.deepfake-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = btn.getAttribute('data-video');
        this.selectDeepfake(v);
      });
    });

    // Stage 2: Reset upload order
    document.getElementById('tr2-btn-reset-order')?.addEventListener('click', () => {
      this.resetUploadOrder();
    });

    // Stage 2: Deduction check helper
    document.getElementById('tr2-btn-check-stage2')?.addEventListener('click', () => {
      this.checkStage2Deduction();
    });

    // Stage 3: Inputs and Hint reveals
    document.querySelectorAll('.hint-header').forEach(header => {
      header.addEventListener('click', () => {
        const item = header.closest('.hint-item');
        if (item) item.classList.toggle('open');
      });
    });

    // Stage 3: Word, Saree, Quotient inputs
    document.getElementById('tr2-input-saree')?.addEventListener('input', (e) => {
      this.updateCryptarithmDisplays();
      this.saveProgress();
    });
    document.getElementById('tr2-input-quotient')?.addEventListener('input', (e) => {
      this.updateCryptarithmDisplays();
      this.saveProgress();
    });
    document.getElementById('tr2-input-word')?.addEventListener('input', (e) => {
      this.updateCryptarithmDisplays();
      this.saveProgress();
    });

    // Final Submit Button
    document.getElementById('tr2-btn-final-submit')?.addEventListener('click', () => {
      this.submitTrack2();
    });
  }

  async loadTrackData() {
    try {
      let data = null;
      try {
        const res = await fetch('/api/track2/info');
        if (res.ok) {
          data = await res.json();
          localStorage.setItem('cached_track2_info', JSON.stringify(data));
        }
      } catch (netErr) {
        console.warn('Network issue fetching Track 2 info, using cached if available:', netErr);
      }

      if (!data) {
        const cached = localStorage.getItem('cached_track2_info');
        if (cached) data = JSON.parse(cached);
      }

      if (data) {
        this.config = data;
        this.puzzle10x10 = data.puzzle10x10;

        // Mount Hashi 10x10 board in Stage 1 container
        this.initHashiBoard();

        // Setup Stage 2 Video slots
        this.renderVideoOrderSlots();

        // Setup Stage 3 Letter-Digit keypad
        this.renderLetterKeypad();

        // If pending bridges were restored before board was mounted
        if (this._pendingBridges && this.hashiEngine) {
          this.hashiEngine.loadBridges(this._pendingBridges);
          delete this._pendingBridges;
          this.updateStage1Status();
        }
      }
    } catch (err) {
      console.error('Failed to load Track 2 data:', err);
    }
  }

  initHashiBoard() {
    const boardContainer = document.getElementById('tr2-hashi-board-container');
    if (!boardContainer || !this.puzzle10x10) return;

    if (window.BridgesEngine) {
      this.hashiEngine = new window.BridgesEngine(boardContainer, this.puzzle10x10, {
        cellSize: 46,
        padding: 34,
        showGuides: true,
        onMove: () => this.saveProgress(),
        onStateChange: () => {
          this.updateStage1Status();
          this.saveProgress();
        }
      });

      if (this._pendingBridges && this._pendingBridges.length > 0) {
        this.hashiEngine.loadBridges(this._pendingBridges);
        delete this._pendingBridges;
      }
      this.updateStage1Status();
    }
  }

  updateStage1Status() {
    if (!this.hashiEngine) return;
    const { isFullyConnected, satisfiedCount, totalCount } = this.hashiEngine.evaluateState();
    const statusText = document.getElementById('tr2-stage1-status-pill');
    if (statusText) {
      const pct = Math.round((satisfiedCount / totalCount) * 100);
      statusText.innerHTML = `${satisfiedCount}/${totalCount} Islands (${pct}%) • ${isFullyConnected ? 'Connected' : 'Connecting...'}`;
      if (isFullyConnected && satisfiedCount === totalCount && totalCount > 0) {
        statusText.style.color = 'var(--emerald-500, #10b981)';
      } else if (satisfiedCount > 0) {
        statusText.style.color = 'var(--island-satisfied-text, #34d399)';
      } else {
        statusText.style.color = 'var(--text-secondary)';
      }
    }

    this.updateStepperUI();
  }

  updateStepperUI() {
    [1, 2, 3, 4].forEach(stage => {
      const btn = document.querySelector(`.tr2-step-btn[data-stage="${stage}"]`);
      const statusSpan = document.getElementById(`tr2-step-${stage}-status`);
      if (!btn) return;

      const isUnlocked = this.stagesUnlocked[stage];
      const isCompleted = this.stagesCompleted[stage];

      btn.classList.toggle('locked', !isUnlocked);
      btn.classList.toggle('completed', !!isCompleted);

      if (statusSpan) {
        if (stage === 4) {
          statusSpan.textContent = String(stage);
          if (isUnlocked) statusSpan.classList.add('completed');
        } else if (isCompleted) {
          statusSpan.textContent = '✓';
          statusSpan.classList.add('completed');
        } else if (isUnlocked) {
          statusSpan.textContent = String(stage);
          statusSpan.classList.remove('completed');
        } else {
          statusSpan.textContent = String(stage);
          statusSpan.classList.remove('completed');
        }
      }
    });
  }

  switchStage(stageNum) {
    if (!this.stagesUnlocked[stageNum]) {
      window.app?.showToast(`Stage ${stageNum} is locked! Solve previous challenges first.`, 'warning');
      window.soundManager?.playError();
      return;
    }

    this.currentStage = stageNum;

    // Update Stepper buttons
    document.querySelectorAll('.tr2-step-btn').forEach(btn => {
      const num = parseInt(btn.getAttribute('data-stage'), 10);
      btn.classList.toggle('active', num === stageNum);
    });

    // Update Stage views
    document.querySelectorAll('.tr2-stage-view').forEach(view => {
      const num = parseInt(view.getAttribute('data-stage'), 10);
      view.classList.toggle('active', num === stageNum);
    });

    if (stageNum === 1) {
      if (!this.hashiEngine || !this.hashiEngine.svg || !document.contains(this.hashiEngine.svg)) {
        this.initHashiBoard();
      } else {
        this.hashiEngine.updateVisualState();
      }
    } else if (stageNum === 4) {
      this.updateSummaryReview();
    }

    this.saveProgress();

    // Scroll to top of stage
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async verifyStage1() {
    if (!this.hashiEngine) return;
    const bridges = Array.from(this.hashiEngine.bridgeState.entries()).map(([k, cnt]) => {
      const [u, v] = k.split('-').map(Number);
      return { u, v, count: cnt };
    });

    try {
      const res = await fetch('/api/round2/validate-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attempt_id: this.attempt?.id,
          track: 'track2',
          stage: 1,
          data: { bridges }
        })
      });
      const result = await res.json();

      if (result.valid) {
        this.stagesCompleted[1] = true;
        this.stagesUnlocked[2] = true;
        this.updateStepperUI();
        this.saveProgress();

        window.soundManager?.playFanfare();
        window.app?.triggerConfetti();
        window.powerupsManager?.updatePool(1, result.unlocked_powerups);

        window.app?.showStageConfirmation({
          isCorrect: true,
          title: 'Correct Answer! Stage 1 Verified',
          message: 'All islands on the 10×10 Championship board are correctly connected into a single unified network according to Nikoli rules.',
          reward: '<strong>Rewards Earned:</strong> +800 Points • <strong>Time Cracker</strong> & <strong>Topic Finder</strong> added to power-up pool (2 of 5 available).',
          buttonText: 'Continue to Stage 2: Deepfake Challenge →',
          onAction: () => this.switchStage(2)
        });
      } else {
        window.soundManager?.playError();
        window.app?.showStageConfirmation({
          isCorrect: false,
          title: 'Incorrect Answer',
          message: result.reason || 'Bridges do not satisfy all island rules or network is disconnected.',
          buttonText: 'Review & Try Again'
        });
      }
    } catch (err) {
      console.error(err);
      window.app?.showToast('Error validating Stage 1 with server', 'error');
    }
  }

  async verifyStage2() {
    if (!this.selectedDeepfake || this.uploadOrder.length !== 5) {
      window.app?.showToast('Please select the deepfake video and arrange all 5 upload order slots first!', 'warning');
      return;
    }

    try {
      const res = await fetch('/api/round2/validate-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attempt_id: this.attempt?.id,
          track: 'track2',
          stage: 2,
          data: {
            deepfake: this.selectedDeepfake,
            upload_order: this.uploadOrder
          }
        })
      });
      const result = await res.json();

      if (result.valid) {
        this.stagesCompleted[2] = true;
        this.stagesUnlocked[3] = true;
        this.updateStepperUI();
        this.saveProgress();

        window.soundManager?.playFanfare();
        window.app?.triggerConfetti();
        window.powerupsManager?.updatePool(2, result.unlocked_powerups);

        window.app?.showStageConfirmation({
          isCorrect: true,
          title: 'Correct Answer! Stage 2 Verified',
          message: result.reason || 'Deepfake video identified and chronological upload order validated!',
          reward: '<strong>Rewards Earned:</strong> +1200 Points • <strong>Penalty Sweeper</strong> & <strong>Jumper Points</strong> added to power-up pool (4 of 5 available).',
          buttonText: 'Continue to Stage 3: Zero to Crore →',
          onAction: () => this.switchStage(3)
        });
      } else {
        window.soundManager?.playError();
        window.app?.showStageConfirmation({
          isCorrect: false,
          title: 'Incorrect Answer',
          message: result.reason || 'Deduction for deepfake video or upload sequence order is incorrect.',
          buttonText: 'Review & Try Again'
        });
      }
    } catch (err) {
      console.error(err);
      window.app?.showToast('Error validating Stage 2 with server', 'error');
    }
  }

  async verifyStage3() {
    const wordInput = document.getElementById('tr2-input-word');
    const sareeInput = document.getElementById('tr2-input-saree');
    const quotientInput = document.getElementById('tr2-input-quotient');

    const word = String(wordInput?.value || '').trim().toUpperCase();
    const saree = sareeInput?.value;
    const quotient = quotientInput?.value;

    if (!word) {
      window.app?.showToast('Please enter the decoded secret word!', 'warning');
      return;
    }

    try {
      const res = await fetch('/api/round2/validate-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attempt_id: this.attempt?.id,
          track: 'track2',
          stage: 3,
          data: {
            mapping: this.letterMapping,
            saree_value: saree,
            quotient_value: quotient,
            final_word: word
          }
        })
      });
      const result = await res.json();

      if (result.valid) {
        this.stagesCompleted[3] = true;
        this.stagesUnlocked[4] = true;
        this.updateStepperUI();
        this.saveProgress();

        window.soundManager?.playFanfare();
        window.app?.triggerConfetti();
        window.powerupsManager?.updatePool(3, result.unlocked_powerups);

        window.app?.showStageConfirmation({
          isCorrect: true,
          title: 'Correct Answer! Stage 3 Solved',
          message: result.reason || 'Alphabetic cryptarithm solved, SAREE computed, and secret word decoded!',
          reward: '<strong>Rewards Earned:</strong> +1000 Points • <strong>Full Power-Up Pool Unlocked (5 of 5)</strong>, including <strong>Sweet Sabotage</strong>!',
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
          title: 'Incorrect Answer',
          message: result.reason || 'Decoded word, SAREE computation, or letter-to-digit mapping is incorrect.',
          buttonText: 'Review & Try Again'
        });
      }
    } catch (err) {
      console.error(err);
      window.app?.showToast('Error validating Stage 3 with server', 'error');
    }
  }

  // ------------------------------------------------------------------
  // STAGE 2: WHO IS THE DEEPFAKE? (Interactive Deductions)
  // ------------------------------------------------------------------

  selectDeepfake(videoLetter) {
    this.selectedDeepfake = videoLetter;
    document.querySelectorAll('.deepfake-choice-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.getAttribute('data-video') === videoLetter);
    });

    const display = document.getElementById('tr2-selected-deepfake-val');
    if (display) {
      display.textContent = `Video ${videoLetter}`;
      display.style.color = 'var(--rose-500)';
    }

    this.checkStage2Progress();
    this.saveProgress();
  }

  renderVideoOrderSlots() {
    const slotsContainer = document.getElementById('tr2-order-slots');
    const poolContainer = document.getElementById('tr2-video-pool');
    if (!slotsContainer || !poolContainer) return;

    // 1. Render 5 slots
    slotsContainer.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const slot = document.createElement('div');
      slot.className = 'tr2-sequence-slot';
      slot.setAttribute('data-index', i);

      const assigned = this.uploadOrder[i];
      if (assigned) {
        slot.classList.add('filled');
        slot.innerHTML = `
          <div class="slot-pos">${this.getOrdinal(i + 1)}</div>
          <div class="slot-video-token">${assigned}</div>
          <button class="slot-remove-btn" title="Remove">×</button>
        `;
        slot.querySelector('.slot-remove-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          this.removeVideoFromSlot(i);
        });
      } else {
        slot.innerHTML = `
          <div class="slot-pos">${this.getOrdinal(i + 1)}</div>
          <div class="slot-empty-label">Drop / Click</div>
        `;
      }

      slotsContainer.appendChild(slot);
    }

    // 2. Render available videos pool
    poolContainer.innerHTML = '';
    const all = ['A', 'B', 'C', 'D', 'E'];
    all.forEach(v => {
      const isUsed = this.uploadOrder.includes(v);
      const chip = document.createElement('button');
      chip.className = `video-pool-chip ${isUsed ? 'used' : ''}`;
      chip.textContent = `Video ${v}`;
      chip.setAttribute('data-video', v);
      if (!isUsed) {
        chip.addEventListener('click', () => this.addVideoToNextSlot(v));
      }
      poolContainer.appendChild(chip);
    });

    this.checkStage2Progress();
  }

  addVideoToNextSlot(videoLetter) {
    if (this.uploadOrder.length >= 5) return;
    this.uploadOrder.push(videoLetter);
    this.renderVideoOrderSlots();
    this.saveProgress();
  }

  removeVideoFromSlot(index) {
    if (index >= 0 && index < this.uploadOrder.length) {
      this.uploadOrder.splice(index, 1);
      this.renderVideoOrderSlots();
      this.saveProgress();
    }
  }

  resetUploadOrder() {
    this.uploadOrder = [];
    this.renderVideoOrderSlots();
    this.saveProgress();
  }

  getOrdinal(n) {
    return ['1st', '2nd', '3rd', '4th', '5th'][n - 1] || `${n}th`;
  }

  checkStage2Progress() {
    const isComplete = this.selectedDeepfake && this.uploadOrder.length === 5;
    const stepIndicator = document.getElementById('tr2-step-2-status');
    if (stepIndicator) {
      stepIndicator.textContent = isComplete ? '✓' : '2';
      stepIndicator.classList.toggle('completed', isComplete);
    }
  }

  async checkStage2Deduction() {
    if (!this.selectedDeepfake) {
      window.app?.showToast('Select which video is the deepfake first!', 'error');
      return;
    }
    if (this.uploadOrder.length < 5) {
      window.app?.showToast('Arrange all 5 videos in the upload order first!', 'error');
      return;
    }

    try {
      const res = await fetch('/api/track2/validate-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: 2,
          data: {
            deepfake: this.selectedDeepfake,
            upload_order: this.uploadOrder
          }
        })
      });
      const data = await res.json();
      if (data.valid) {
        window.app?.showToast(data.reason, 'success');
        if (window.soundManager) window.soundManager.playVictory();
      } else {
        window.app?.showToast(data.reason, 'error');
        if (window.soundManager) window.soundManager.playError();
      }
    } catch (e) {
      console.error(e);
    }
  }

  // ------------------------------------------------------------------
  // STAGE 3: ZERO TO CRORE (Alphametic Cryptarithm)
  // ------------------------------------------------------------------

  renderLetterKeypad() {
    const container = document.getElementById('tr2-letters-grid');
    if (!container) return;

    container.innerHTML = '';
    this.letters.forEach(letter => {
      const card = document.createElement('div');
      card.className = 'letter-keypad-card';

      card.innerHTML = `
        <div class="letter-badge">${letter}</div>
        <select class="digit-select" data-letter="${letter}">
          <option value="">-</option>
          ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => `
            <option value="${d}" ${this.letterMapping[letter] === String(d) ? 'selected' : ''}>${d}</option>
          `).join('')}
        </select>
      `;

      const sel = card.querySelector('select');
      sel.addEventListener('change', (e) => {
        this.letterMapping[letter] = e.target.value;
        this.updateCryptarithmDisplays();
        this.saveProgress();
      });

      container.appendChild(card);
    });

    this.updateCryptarithmDisplays();
  }

  updateCryptarithmDisplays() {
    // 1. Update unassigned digit chips
    const usedDigits = new Set(Object.values(this.letterMapping).filter(v => v !== ''));
    const pool = document.getElementById('tr2-digit-pool');
    if (pool) {
      pool.innerHTML = '';
      for (let d = 0; d <= 9; d++) {
        const isUsed = usedDigits.has(String(d));
        pool.innerHTML += `<span class="digit-chip ${isUsed ? 'used' : ''}">${d}</span>`;
      }
    }

    // 2. Evaluate Equation 1: RAJA + ZERO = CRORE
    const m = this.letterMapping;
    const canEvalEq1 = ['R', 'A', 'J', 'Z', 'E', 'O', 'C'].every(k => m[k] !== '');
    const eq1Card = document.getElementById('tr2-eq1-card');
    const eq1Status = document.getElementById('tr2-eq1-status');

    if (canEvalEq1) {
      const raja = Number(m.R) * 1000 + Number(m.A) * 100 + Number(m.J) * 10 + Number(m.A);
      const zero = Number(m.Z) * 1000 + Number(m.E) * 100 + Number(m.R) * 10 + Number(m.O);
      const crore = Number(m.C) * 10000 + Number(m.R) * 1000 + Number(m.O) * 100 + Number(m.R) * 10 + Number(m.E);
      const match = (raja + zero === crore);

      if (eq1Status) {
        eq1Status.innerHTML = `${raja} + ${zero} = ${crore} (${match ? 'Balanced' : 'Mismatch'})`;
        eq1Status.style.color = match ? 'var(--text-primary)' : 'var(--rose-500)';
      }
    } else {
      if (eq1Status) eq1Status.innerHTML = 'Assign letters to compute';
    }

    // 3. Evaluate Equation 2: GANGA + ZERO = SAREE
    const canEvalEq2 = ['G', 'A', 'N', 'Z', 'E', 'R', 'O', 'S'].every(k => m[k] !== '');
    const eq2Status = document.getElementById('tr2-eq2-status');

    if (canEvalEq2) {
      const ganga = Number(m.G) * 10000 + Number(m.A) * 1000 + Number(m.N) * 100 + Number(m.G) * 10 + Number(m.A);
      const zero = Number(m.Z) * 1000 + Number(m.E) * 100 + Number(m.R) * 10 + Number(m.O);
      const saree = Number(m.S) * 10000 + Number(m.A) * 1000 + Number(m.R) * 100 + Number(m.E) * 10 + Number(m.E);
      const match = (ganga + zero === saree);

      if (eq2Status) {
        eq2Status.innerHTML = `${ganga} + ${zero} = ${saree} (${match ? 'Balanced' : 'Mismatch'})`;
        eq2Status.style.color = match ? 'var(--text-primary)' : 'var(--rose-500)';
      }
    } else {
      if (eq2Status) eq2Status.innerHTML = 'Assign letters to compute';
    }

    // Check completion of Stage 3
    const wordInput = document.getElementById('tr2-input-word');
    const wordClean = (wordInput?.value || '').trim().toUpperCase();
    const isComplete = wordClean.length >= 4;

    const stepIndicator = document.getElementById('tr2-step-3-status');
    if (stepIndicator) {
      stepIndicator.textContent = isComplete ? '✓' : '3';
      stepIndicator.classList.toggle('completed', isComplete);
    }
  }

  // ------------------------------------------------------------------
  // STAGE 4: SUMMARY & FINAL SUBMIT
  // ------------------------------------------------------------------

  updateSummaryReview() {
    // Stage 1 summary
    const s1Card = document.getElementById('summary-stage1-val');
    if (s1Card && this.hashiEngine) {
      const st = this.hashiEngine.evaluateState();
      s1Card.textContent = `${st.satisfiedCount}/${st.totalCount} Islands Satisfied • ${st.isFullyConnected ? 'Single Network (Connected)' : 'Disconnected'}`;
    }

    // Stage 2 summary
    const s2Card = document.getElementById('summary-stage2-val');
    if (s2Card) {
      s2Card.textContent = `Deepfake: Video ${this.selectedDeepfake || '-'} | Order: ${this.uploadOrder.length === 5 ? this.uploadOrder.join(' → ') : 'Incomplete'}`;
    }

    // Stage 3 summary
    const s3Card = document.getElementById('summary-stage3-val');
    const wordInput = document.getElementById('tr2-input-word');
    const sareeInput = document.getElementById('tr2-input-saree');
    if (s3Card) {
      s3Card.textContent = `SAREE: ${sareeInput?.value || '-'} | Word: "${(wordInput?.value || '-').toUpperCase()}"`;
    }
  }

  async submitTrack2() {
    if (!this.attempt) {
      window.app?.showToast('Please join the quiz with student details first!', 'error');
      return;
    }

    if (!confirm('Are you ready to submit your 2nd Track contest entry? All stages will be evaluated!')) {
      return;
    }

    // Collect all data
    const stage1Bridges = this.hashiEngine ? Array.from(this.hashiEngine.bridgeState.entries()).map(([k, cnt]) => {
      const [u, v] = k.split('-').map(Number);
      return { u, v, count: cnt };
    }) : [];

    const wordInput = document.getElementById('tr2-input-word');
    const sareeInput = document.getElementById('tr2-input-saree');
    const quotientInput = document.getElementById('tr2-input-quotient');

    const payload = {
      attempt_id: this.attempt.id,
      duration_seconds: this.elapsedSeconds,
      moves_count: (this.hashiEngine?.movesCount || 0) + 10,
      mistakes_count: this.hashiEngine?.mistakesCount || 0,
      undos_count: this.hashiEngine?.undosCount || 0,
      tab_switches: this.tabSwitches,
      stage1: {
        bridges: stage1Bridges
      },
      stage2: {
        deepfake: this.selectedDeepfake,
        upload_order: this.uploadOrder
      },
      stage3: {
        mapping: this.letterMapping,
        saree_value: sareeInput?.value,
        quotient_value: quotientInput?.value,
        final_word: wordInput?.value
      }
    };

    try {
      const res = await fetch('/api/track2/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        this.isSubmitted = true;
        clearInterval(this.timerInterval);
        clearInterval(this.heartbeatInterval);

        // Show celebratory modal
        this.showVictoryModal(data);
        if (window.app) window.app.triggerConfetti();
        if (window.soundManager) window.soundManager.playVictory();
      } else {
        window.app?.showToast(data.reason || 'Submission error', 'error');
      }
    } catch (err) {
      console.error('Submission failed:', err);
      window.app?.showToast('Network error during submission', 'error');
    }
  }

  showVictoryModal(data) {
    const modal = document.getElementById('modal-tr2-victory');
    if (!modal) return;

    document.getElementById('tr2-res-score').textContent = data.totalScore || 0;
    document.getElementById('tr2-res-rank').textContent = data.rank ? `#${data.rank}` : '#1';
    document.getElementById('tr2-res-time').textContent = document.getElementById('tr2-timer-clock')?.textContent || '--:--';

    const s1Icon = document.getElementById('tr2-res-s1-icon');
    if (s1Icon) s1Icon.textContent = data.stageBreakdown?.stage1?.valid ? 'Passed' : 'Incomplete';

    const s2Icon = document.getElementById('tr2-res-s2-icon');
    if (s2Icon) s2Icon.textContent = data.stageBreakdown?.stage2?.valid ? 'Passed (1200 pts)' : `${data.stageBreakdown?.stage2?.score || 0} pts`;

    const s3Icon = document.getElementById('tr2-res-s3-icon');
    if (s3Icon) s3Icon.textContent = data.stageBreakdown?.stage3?.valid ? 'Passed (1500 pts)' : `${data.stageBreakdown?.stage3?.score || 0} pts`;

    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('open'));
  }

  // Single 30-Minute Round Timer (Resilient to Page Refresh)
  startRoundTimer(savedStartTime = null) {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (window.track1Manager?.timerInterval) {
      clearInterval(window.track1Manager.timerInterval);
      window.track1Manager.timerInterval = null;
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

      const clockEl = document.getElementById('tr2-timer-clock');
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
        clearInterval(this.timerInterval);
        this.timerInterval = null;
        window.app?.showToast('Time is up for Round 2! Please review and submit your power-ups.', 'warning');
      }
    };

    updateTick();
    this.timerInterval = setInterval(updateTick, 1000);
  }

  updateStudentHeader(name, id, batch, lab) {
    const nameEl = document.getElementById('tr2-display-student-name');
    const idEl = document.getElementById('tr2-display-student-id');
    const batchEl = document.getElementById('tr2-display-batch');
    const avatarEl = document.getElementById('tr2-display-avatar');

    if (nameEl) nameEl.textContent = name;
    if (idEl) idEl.textContent = id;
    if (batchEl) batchEl.textContent = `${batch}${lab ? ' • ' + lab : ''}`;
    if (avatarEl) avatarEl.textContent = (name || 'T').charAt(0).toUpperCase();
  }

  saveProgress() {
    if (!this.attempt || !this.attempt.id) return;
    try {
      const bridges = this.hashiEngine ? Array.from(this.hashiEngine.bridgeState.entries()).map(([k, cnt]) => {
        const [u, v] = k.split('-').map(Number);
        return { u, v, count: cnt };
      }) : (this._pendingBridges || []);

      const wordInput = document.getElementById('tr2-input-word');
      const sareeInput = document.getElementById('tr2-input-saree');
      const quotientInput = document.getElementById('tr2-input-quotient');

      const data = {
        attempt: this.attempt,
        startTime: this.startTime || (Date.now() - (this.elapsedSeconds * 1000)),
        stagesUnlocked: this.stagesUnlocked,
        stagesCompleted: this.stagesCompleted,
        currentStage: this.currentStage,
        stage1Bridges: bridges,
        selectedDeepfake: this.selectedDeepfake,
        uploadOrder: this.uploadOrder,
        letterMapping: this.letterMapping,
        saree_value: sareeInput?.value || '',
        quotient_value: quotientInput?.value || '',
        final_word: wordInput?.value || ''
      };

      localStorage.setItem(`hashi_tr2_progress_${this.attempt.id}`, JSON.stringify(data));
      localStorage.setItem('hashi_tr2_latest_attempt_id', this.attempt.id);
      localStorage.setItem('hashi_tr2_attempt', JSON.stringify(this.attempt));
    } catch (e) {
      console.warn('Could not save Track 2 progress:', e);
    }
  }

  restoreProgress(attemptId) {
    try {
      const key = attemptId ? `hashi_tr2_progress_${attemptId}` : `hashi_tr2_progress_${localStorage.getItem('hashi_tr2_latest_attempt_id')}`;
      let raw = localStorage.getItem(key);
      if (!raw && attemptId) {
        const latestId = localStorage.getItem('hashi_tr2_latest_attempt_id');
        if (latestId) raw = localStorage.getItem(`hashi_tr2_progress_${latestId}`);
      }
      if (!raw) return false;

      const data = JSON.parse(raw);
      if (!data) return false;

      this.attempt = data.attempt || this.attempt;
      this.startTime = data.startTime || Date.now();
      this.stagesUnlocked = data.stagesUnlocked || { 1: true, 2: false, 3: false, 4: false };
      this.stagesCompleted = data.stagesCompleted || { 1: false, 2: false, 3: false };
      this.currentStage = data.currentStage || 1;

      if (this.attempt) {
        this.updateStudentHeader(this.attempt.student_name, this.attempt.student_id, this.attempt.batch, this.attempt.lab);
      }
      this.updateStepperUI();
      this.startRoundTimer(this.startTime);

      // Restore Stage 1 Bridges
      if (data.stage1Bridges && data.stage1Bridges.length > 0) {
        if (this.hashiEngine) {
          this.hashiEngine.loadBridges(data.stage1Bridges);
          this.updateStage1Status();
        } else {
          this._pendingBridges = data.stage1Bridges;
        }
      }

      // Restore Stage 2
      if (data.selectedDeepfake) {
        this.selectDeepfake(data.selectedDeepfake);
      }
      if (data.uploadOrder && Array.isArray(data.uploadOrder)) {
        this.uploadOrder = data.uploadOrder;
        this.renderVideoOrderSlots();
      }

      // Restore Stage 3
      if (data.letterMapping) {
        this.letterMapping = { ...this.letterMapping, ...data.letterMapping };
        this.renderLetterKeypad();
      }
      const sareeInput = document.getElementById('tr2-input-saree');
      const quotientInput = document.getElementById('tr2-input-quotient');
      const wordInput = document.getElementById('tr2-input-word');
      if (sareeInput && data.saree_value !== undefined) sareeInput.value = data.saree_value;
      if (quotientInput && data.quotient_value !== undefined) quotientInput.value = data.quotient_value;
      if (wordInput && data.final_word !== undefined) wordInput.value = data.final_word;

      this.updateCryptarithmDisplays();
      this.switchStage(this.currentStage);
      return true;
    } catch (e) {
      console.error('Error restoring Track 2 progress:', e);
      return false;
    }
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
      this.startTime = Date.now();
      this.stagesUnlocked = { 1: true, 2: false, 3: false, 4: false };
      this.stagesCompleted = { 1: false, 2: false, 3: false };
      this.currentStage = 1;
      this.saveProgress();
      this.startRoundTimer(this.startTime);
      this.updateStepperUI();
      this.switchStage(1);
      window.app?.showToast(`Joined Track 2 as ${studentName}! 30-minute timer started.`, 'success');
    } else {
      window.app?.showToast(`Welcome back, ${studentName}! Progress restored.`, 'info');
    }
  }

  startNewAttempt(studentName, studentId, batch, lab, attemptId) {
    return this.startOrResumeAttempt(studentName, studentId, batch, lab, attemptId);
  }
}

// Instantiate on load
window.addEventListener('DOMContentLoaded', () => {
  window.track2Manager = new Track2Manager();
});
