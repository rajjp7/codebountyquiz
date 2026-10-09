// Round 2 Power-Ups Manager
// Manages the live unlocked power-up pool and post-round selection of exactly 2 power-ups

class PowerupsManager {
  constructor() {
    this.allPowerups = [
      {
        id: 'time_cracker',
        name: 'Time Cracker',
        tier: 1,
        unlocked_at: 1,
        tag: 'TIME',
        iconSvg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        badge: 'Time Reduction',
        description: 'Deducts 20% of your total time taken to solve a question in Round 3.'
      },
      {
        id: 'topic_finder',
        name: 'Topic Finder',
        tier: 1,
        unlocked_at: 1,
        tag: 'INTEL',
        iconSvg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
        badge: 'Concept Clue',
        description: 'Reveals the topic of the question, meaning the exact algorithm/concept you need to use.'
      },
      {
        id: 'penalty_sweeper',
        name: 'Penalty Sweeper',
        tier: 2,
        unlocked_at: 2,
        tag: 'SHIELD',
        iconSvg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
        badge: 'Zero Penalty',
        description: 'Removes all penalty points on a question in the next round.'
      },
      {
        id: 'jumper_points',
        name: 'Jumper Points',
        tier: 2,
        unlocked_at: 2,
        tag: 'BOOST',
        iconSvg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
        badge: '1.5x Multiplier',
        description: 'Multiplier power-up: The points for the selected question are multiplied by 1.5x.'
      },
      {
        id: 'sweet_sabotage',
        name: 'Sweet Sabotage',
        tier: 3,
        unlocked_at: 3,
        tag: 'SABOTAGE',
        iconSvg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>',
        badge: 'Debuff Target',
        description: 'Use on any one participant sitting in your lab. That contestant\'s final team points are reduced by 10%!'
      }
    ];

    this.questionsSolved = 0;
    this.unlockedPool = []; // Array of powerup IDs
    this.selectedPowerups = new Set(); // Maximum 2
    this.isConfirmed = false;
    this.lockedAt = null;
    this.sabotageTarget = '';

    this.init();
  }

  init() {
    this.bindDOM();
    this.restoreState();
    this.renderPowerupsUI();
  }

  saveState() {
    try {
      const state = {
        questionsSolved: this.questionsSolved,
        unlockedPool: this.unlockedPool,
        selectedPowerups: Array.from(this.selectedPowerups),
        isConfirmed: this.isConfirmed,
        lockedAt: this.lockedAt,
        sabotageTarget: this.sabotageTarget
      };
      localStorage.setItem('hashi_powerups_state', JSON.stringify(state));
    } catch (e) {
      console.warn('Could not save powerups state:', e);
    }
  }

  restoreState() {
    try {
      const raw = localStorage.getItem('hashi_powerups_state');
      if (!raw) return;
      const state = JSON.parse(raw);
      if (!state) return;

      this.questionsSolved = state.questionsSolved || 0;
      this.unlockedPool = Array.isArray(state.unlockedPool) ? state.unlockedPool : [];
      this.selectedPowerups = new Set(Array.isArray(state.selectedPowerups) ? state.selectedPowerups : []);
      this.isConfirmed = !!state.isConfirmed;
      this.lockedAt = state.lockedAt || null;
      this.sabotageTarget = state.sabotageTarget || '';

      const inputSabotage = document.getElementById('input-sabotage-target');
      if (inputSabotage && this.sabotageTarget) {
        inputSabotage.value = this.sabotageTarget;
      }
    } catch (e) {
      console.warn('Could not restore powerups state:', e);
    }
  }

  bindDOM() {
    // Top bar & floating capsule click
    document.querySelectorAll('.btn-open-powerups').forEach(btn => {
      btn.addEventListener('click', () => this.openPowerupsModal());
    });

    // Close modal / drawer
    document.getElementById('btn-close-powerups-modal')?.addEventListener('click', () => {
      this.closePowerupsModal();
    });

    // Confirm choices button
    document.getElementById('btn-confirm-powerups')?.addEventListener('click', () => {
      this.confirmChoices();
    });

    // Sabotage target input
    document.getElementById('input-sabotage-target')?.addEventListener('input', (e) => {
      this.sabotageTarget = e.target.value;
      this.saveState();
    });
  }

  // Update pool when student solves questions
  updatePool(solvedCount, unlockedIds = null) {
    const prevSolved = this.questionsSolved;
    this.questionsSolved = Math.max(this.questionsSolved, solvedCount);

    if (unlockedIds) {
      this.unlockedPool = unlockedIds;
    } else {
      if (this.questionsSolved >= 3) {
        this.unlockedPool = this.allPowerups.map(p => p.id);
      } else if (this.questionsSolved >= 2) {
        this.unlockedPool = ['time_cracker', 'topic_finder', 'penalty_sweeper', 'jumper_points'];
      } else if (this.questionsSolved >= 1) {
        this.unlockedPool = ['time_cracker', 'topic_finder'];
      } else {
        this.unlockedPool = [];
      }
    }

    this.saveState();
    this.renderCapsuleBadges();
    this.renderPowerupsUI();

    // Trigger toast if new power-ups unlocked
    if (this.questionsSolved > prevSolved) {
      const newlyEarned = (this.questionsSolved === 1)
        ? 'Time Cracker & Topic Finder'
        : (this.questionsSolved === 2)
          ? 'Penalty Sweeper & Jumper Points'
          : 'Sweet Sabotage';
      window.app?.showToast(`Power-Up Unlocked: ${newlyEarned}. Pool Size: ${this.unlockedPool.length}/5`, 'success');
    }
  }

  renderCapsuleBadges() {
    const poolSize = this.unlockedPool.length;
    document.querySelectorAll('.live-powerup-pool-count').forEach(el => {
      el.textContent = `${poolSize}/5`;
    });
    document.querySelectorAll('.live-solved-count').forEach(el => {
      el.textContent = `${this.questionsSolved}/3`;
    });
  }

  renderPowerupsUI() {
    this.renderCapsuleBadges();

    // 1. Render in Powerups Selection Page (#tab-powerups)
    const selectionGrid = document.getElementById('powerups-selection-grid');
    if (selectionGrid) {
      selectionGrid.innerHTML = '';

      this.allPowerups.forEach(p => {
        const isUnlocked = this.unlockedPool.includes(p.id);
        const isSelected = this.selectedPowerups.has(p.id);

        const card = document.createElement('div');
        card.className = `powerup-card ${isUnlocked ? 'unlocked' : 'locked'} ${isSelected ? 'selected' : ''}`;
        card.setAttribute('data-id', p.id);

        card.innerHTML = `
          <div class="powerup-header">
            <div class="powerup-icon-box">${p.iconSvg}</div>
            <span class="powerup-badge ${isUnlocked ? 'badge-active' : ''}">${p.badge}</span>
          </div>
          <h3 class="powerup-name">${p.name}</h3>
          <p class="powerup-desc">${p.description}</p>
          <div class="powerup-footer">
            ${isUnlocked
              ? `<span class="powerup-status-label">${isSelected ? 'Selected' : 'Select Power-Up'}</span>`
              : `<span class="powerup-lock-label">Unlocks at Stage ${p.unlocked_at}</span>`
            }
          </div>
        `;

        if (isUnlocked && !this.isConfirmed) {
          card.style.cursor = 'pointer';
          card.addEventListener('click', () => this.toggleSelection(p.id));
        }

        selectionGrid.appendChild(card);
      });
    }

    // 2. Render in Quick Modal/Drawer (#powerups-drawer-content)
    const drawerContent = document.getElementById('powerups-drawer-list');
    if (drawerContent) {
      drawerContent.innerHTML = '';
      this.allPowerups.forEach(p => {
        const isUnlocked = this.unlockedPool.includes(p.id);
        const item = document.createElement('div');
        item.className = `drawer-powerup-item ${isUnlocked ? 'unlocked' : 'locked'}`;
        item.innerHTML = `
          <div class="drawer-powerup-icon-box">${p.iconSvg}</div>
          <div style="flex: 1;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <strong>${p.name}</strong>
              <span class="pill-badge">${isUnlocked ? 'AVAILABLE' : `STAGE ${p.unlocked_at}`}</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.2rem;">${p.description}</div>
          </div>
        `;
        drawerContent.appendChild(item);
      });
    }

    this.updateSelectionSummary();
  }

  toggleSelection(powerupId) {
    if (this.isConfirmed) return;

    if (this.selectedPowerups.has(powerupId)) {
      this.selectedPowerups.delete(powerupId);
      this.saveState();
    } else {
      if (this.selectedPowerups.size >= 2) {
        window.app?.showToast('You can only select exactly 2 power-ups! Deselect one first.', 'warning');
        window.soundManager?.playError();
        return;
      }
      this.selectedPowerups.add(powerupId);
      this.saveState();
      window.soundManager?.playPlace();
    }

    this.renderPowerupsUI();
  }

  updateSelectionSummary() {
    const countEl = document.getElementById('powerups-selected-count');
    const btnConfirm = document.getElementById('btn-confirm-powerups');
    const sabotageBox = document.getElementById('sabotage-input-box');

    const required = Math.min(2, this.unlockedPool.length);
    const count = this.selectedPowerups.size;

    if (countEl) {
      countEl.textContent = `${count} of ${required} Selected`;
      countEl.style.color = (count === required) ? 'var(--text-primary)' : 'var(--text-secondary)';
    }

    if (btnConfirm) {
      btnConfirm.disabled = (count !== required || this.isConfirmed);
    }

    // Toggle Sweet Sabotage target box
    if (sabotageBox) {
      const hasSweetSabotage = this.selectedPowerups.has('sweet_sabotage');
      sabotageBox.style.display = hasSweetSabotage ? 'block' : 'none';
    }

    // Confirmation locked banner
    const lockedBanner = document.getElementById('powerups-locked-banner');
    if (lockedBanner) {
      lockedBanner.style.display = this.isConfirmed ? 'block' : 'none';
    }
  }

  async confirmChoices() {
    const required = Math.min(2, this.unlockedPool.length);
    if (this.selectedPowerups.size !== required) {
      window.app?.showToast(`Please choose exactly ${required} power-ups!`, 'warning');
      return;
    }

    if (this.selectedPowerups.has('sweet_sabotage') && !this.sabotageTarget.trim()) {
      window.app?.showToast('Please specify the lab contestant / seat to sabotage with Sweet Sabotage!', 'warning');
      return;
    }

    const choiceNames = Array.from(this.selectedPowerups)
      .map(id => this.allPowerups.find(p => p.id === id)?.name || id)
      .join(' and ');

    if (!confirm(`Confirm and permanently lock your choices:\n• ${choiceNames}\n\nOnce confirmed, your choices cannot be changed and will be carried into Round 3!`)) {
      return;
    }

    // Send to server
    const attemptId = window.track1Manager?.attempt?.id || window.track2Manager?.attempt?.id;

    try {
      const res = await fetch('/api/round2/select-powerups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attempt_id: attemptId,
          selected_powerups: Array.from(this.selectedPowerups),
          sabotage_target: this.sabotageTarget
        })
      });
      const data = await res.json();

      if (data.success || data.locked) {
        this.isConfirmed = true;
        this.lockedAt = data.locked_at || new Date().toISOString();
        this.saveState();

        window.soundManager?.playFanfare();
        window.app?.triggerConfetti();
        window.app?.showToast('Power-Ups Successfully Locked for Round 3! Choices exported to Admin.', 'success');

        this.renderPowerupsUI();
      } else {
        window.app?.showToast(`Failed to lock choices: ${data.error || 'Server error'}`, 'error');
      }
    } catch (err) {
      console.error(err);
      // Offline fallback lock
      this.isConfirmed = true;
      this.lockedAt = new Date().toISOString();
      this.saveState();
      window.app?.showToast('Power-ups locked locally!', 'info');
      this.renderPowerupsUI();
    }
  }

  openPowerupsModal() {
    const modal = document.getElementById('modal-powerups-drawer');
    if (modal) modal.classList.add('open');
  }

  closePowerupsModal() {
    const modal = document.getElementById('modal-powerups-drawer');
    if (modal) modal.classList.remove('open');
  }
}

// Reliable bootstrap on load
function bootstrapPowerups() {
  if (!window.powerupsManager) {
    window.powerupsManager = new PowerupsManager();
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapPowerups);
} else {
  bootstrapPowerups();
}
