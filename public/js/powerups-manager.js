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
        attemptId: this.attemptId,
        questionsSolved: this.questionsSolved,
        unlockedPool: this.unlockedPool,
        selectedPowerups: Array.from(this.selectedPowerups),
        isConfirmed: this.isConfirmed,
        lockedAt: this.lockedAt,
        sabotageTarget: this.sabotageTarget
      };
      if (this.attemptId) {
        localStorage.setItem(`hashi_powerups_state_${this.attemptId}`, JSON.stringify(state));
      }
      localStorage.setItem('hashi_powerups_state', JSON.stringify(state));
    } catch (e) {
      console.warn('Could not save powerups state:', e);
    }
  }

  restoreState(attemptId = null) {
    try {
      const curId = attemptId || this.attemptId || localStorage.getItem('hashi_tr1_latest_attempt_id') || localStorage.getItem('hashi_tr2_latest_attempt_id');
      let raw = curId ? localStorage.getItem(`hashi_powerups_state_${curId}`) : null;
      if (!raw) {
        raw = localStorage.getItem('hashi_powerups_state');
      }
      if (!raw) return false;
      const state = JSON.parse(raw);
      if (!state) return false;

      this.attemptId = curId || state.attemptId || this.attemptId;
      this.questionsSolved = state.questionsSolved || 0;
      this.unlockedPool = Array.isArray(state.unlockedPool) ? state.unlockedPool : [];
      this.selectedPowerups = new Set(Array.isArray(state.selectedPowerups) ? state.selectedPowerups : []);
      this.isConfirmed = !!state.isConfirmed;
      this.lockedAt = state.lockedAt || null;
      this.sabotageTarget = state.sabotageTarget || '';

      const inputSabotage = document.getElementById('input-sabotage-target');
      if (inputSabotage) {
        inputSabotage.value = this.sabotageTarget || '';
        inputSabotage.disabled = this.isConfirmed;
      }
      this.renderCapsuleBadges();
      this.renderPowerupsUI();
      return true;
    } catch (e) {
      console.warn('Could not restore powerups state:', e);
      return false;
    }
  }

  resetForNewAttempt(attemptId = null) {
    this.attemptId = attemptId;
    this.questionsSolved = 0;
    this.unlockedPool = [];
    this.selectedPowerups = new Set();
    this.isConfirmed = false;
    this.lockedAt = null;
    this.sabotageTarget = '';

    const inputSabotage = document.getElementById('input-sabotage-target');
    if (inputSabotage) {
      inputSabotage.value = '';
      inputSabotage.disabled = false;
    }
    const confirmBtn = document.getElementById('btn-confirm-powerups');
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<span>Lock In Choices</span>';
    }

    if (attemptId) {
      this.restoreState(attemptId);
    }
    this.renderPowerupsUI();
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
    const count = Math.max(this.questionsSolved, parseInt(solvedCount, 10) || 0);
    this.questionsSolved = count;

    if (count >= 3) {
      this.unlockedPool = ['time_cracker', 'topic_finder', 'penalty_sweeper', 'jumper_points', 'sweet_sabotage'];
    } else if (count >= 2) {
      this.unlockedPool = ['time_cracker', 'topic_finder', 'penalty_sweeper', 'jumper_points'];
    } else if (count >= 1) {
      this.unlockedPool = ['time_cracker', 'topic_finder'];
    } else {
      this.unlockedPool = [];
    }

    if (unlockedIds && Array.isArray(unlockedIds) && unlockedIds.length > this.unlockedPool.length) {
      this.unlockedPool = Array.from(new Set([...this.unlockedPool, ...unlockedIds]));
    }

    this.saveState();
    this.renderCapsuleBadges();
    this.renderPowerupsUI();

    // Show rich unlock banner if new power-ups unlocked
    if (this.questionsSolved > prevSolved) {
      this.showUnlockBanner(this.questionsSolved);
    }
  }

  showUnlockBanner(solvedCount) {
    // Determine newly unlocked power-ups based on stage
    let newPowerups = [];
    let stageLabel = '';
    if (solvedCount === 1) {
      newPowerups = this.allPowerups.filter(p => ['time_cracker', 'topic_finder'].includes(p.id));
      stageLabel = 'Stage 1 Complete';
    } else if (solvedCount === 2) {
      newPowerups = this.allPowerups.filter(p => ['penalty_sweeper', 'jumper_points'].includes(p.id));
      stageLabel = 'Stage 2 Complete';
    } else {
      newPowerups = this.allPowerups.filter(p => p.id === 'sweet_sabotage');
      stageLabel = 'Stage 3 Complete – Full Pool Unlocked!';
    }

    // Remove any existing banner
    document.getElementById('powerup-unlock-banner')?.remove();

    const banner = document.createElement('div');
    banner.id = 'powerup-unlock-banner';
    banner.className = 'powerup-unlock-banner';
    banner.innerHTML = `
      <button class="pub-close" onclick="document.getElementById('powerup-unlock-banner')?.remove()" title="Dismiss">×</button>
      <div class="pub-header">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#facc15" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        <span class="pub-label">Power-Ups Unlocked!</span>
        <span class="pub-stage">${stageLabel} • ${this.unlockedPool.length}/5 Available</span>
      </div>
      <div class="pub-cards">
        ${newPowerups.map(p => `
          <div class="pub-card">
            <div class="pub-card-icon">${p.iconSvg}</div>
            <div>
              <div class="pub-card-name">${p.name}</div>
              <div class="pub-card-desc">${p.description}</div>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="pub-footer">
        These power-ups are now available in your pool. Select 2 to carry into Round 3!
      </div>
    `;
    document.body.appendChild(banner);

    // Animate in
    requestAnimationFrame(() => banner.classList.add('visible'));

    // Auto-dismiss after 7 seconds
    setTimeout(() => {
      banner.classList.remove('visible');
      setTimeout(() => banner.remove(), 450);
    }, 7000);

    // Also fire a toast for quick acknowledgment
    window.soundManager?.playFanfare();
  }

  renderCapsuleBadges() {
    const poolSize = this.unlockedPool.length;
    document.querySelectorAll('.live-powerup-pool-count').forEach(el => {
      el.textContent = `${poolSize}/5`;
    });
    document.querySelectorAll('.live-solved-count').forEach(el => {
      el.textContent = `${this.questionsSolved}/3`;
    });

    // Top navbar capsule
    const headerCapsule = document.getElementById('header-powerup-capsule');
    if (headerCapsule) {
      headerCapsule.style.display = 'inline-flex';
      const labelEl = headerCapsule.querySelector('.powerup-capsule-label');
      if (labelEl) {
        labelEl.textContent = poolSize > 0 ? `${poolSize} Unlocked:` : 'Power-Ups:';
      }
      if (poolSize > 0) {
        headerCapsule.classList.add('has-unlocked');
      } else {
        headerCapsule.classList.remove('has-unlocked');
      }

      const badgesContainer = document.getElementById('header-capsule-badges');
      if (badgesContainer) {
        badgesContainer.innerHTML = this.unlockedPool.map(id => {
          const item = this.allPowerups.find(p => p.id === id);
          return `<span class="header-capsule-chip" title="${item?.name || id}" style="margin-left: 3px; font-size: 0.85rem;">${id === 'time_cracker' ? '⚡' : (id === 'topic_finder' ? '🔍' : (id === 'penalty_sweeper' ? '🛡️' : (id === 'jumper_points' ? '🚀' : '💣')))}</span>`;
        }).join('');
      }
    }

    // Live Strip Real-Time Badges in Track 1 and Track 2
    document.querySelectorAll('.quiz-powerup-pool-strip').forEach(strip => {
      const titleBox = strip.querySelector('.qps-title');
      if (!titleBox) return;

      let rtBadge = titleBox.querySelector('.qps-realtime-badge');
      if (!rtBadge) {
        rtBadge = document.createElement('span');
        rtBadge.className = 'qps-realtime-badge';
        titleBox.appendChild(rtBadge);
      }

      if (poolSize >= 5) {
        rtBadge.className = 'qps-realtime-badge qps-realtime-ultimate';
        rtBadge.innerHTML = '💣 5/5 Full Pool: Sweet Sabotage Ready!';
        rtBadge.style.display = 'inline-flex';
      } else if (poolSize >= 4) {
        rtBadge.className = 'qps-realtime-badge';
        rtBadge.innerHTML = '✨ 4 Unlocked: +Penalty Sweeper 🛡️ + Jumper Points 🚀';
        rtBadge.style.display = 'inline-flex';
      } else if (poolSize >= 2) {
        rtBadge.className = 'qps-realtime-badge';
        rtBadge.innerHTML = '✨ 2 Unlocked: Time Cracker ⚡ + Topic Finder 🔍';
        rtBadge.style.display = 'inline-flex';
      } else {
        rtBadge.style.display = 'none';
      }
    });

    // Update live on-screen power-up chips on Track 1 and Track 2 portals
    document.querySelectorAll('.qps-chip').forEach(chip => {
      const pId = chip.getAttribute('data-powerup');
      const isUnlocked = this.unlockedPool.includes(pId);
      const badge = chip.querySelector('.qps-chip-badge');
      if (isUnlocked) {
        chip.classList.remove('chip-locked');
        chip.classList.add('chip-unlocked');
        chip.style.opacity = '1';
        chip.style.filter = 'none';
        chip.style.borderColor = (pId === 'sweet_sabotage') ? '#f43f5e' : '#facc15';
        if (badge) {
          badge.textContent = (pId === 'sweet_sabotage') ? '★ UNLOCKED' : '✓ UNLOCKED';
          badge.style.background = (pId === 'sweet_sabotage') ? 'rgba(244, 63, 94, 0.22)' : 'rgba(16, 185, 129, 0.2)';
          badge.style.color = (pId === 'sweet_sabotage') ? '#f43f5e' : '#10b981';
        }
      } else {
        chip.classList.add('chip-locked');
        chip.classList.remove('chip-unlocked');
        chip.style.opacity = '0.5';
        chip.style.filter = 'grayscale(0.5)';
        chip.style.borderColor = 'rgba(255, 255, 255, 0.08)';
        if (badge) {
          const reqStage = (pId === 'sweet_sabotage') ? 'Q3' : (['penalty_sweeper', 'jumper_points'].includes(pId) ? 'Q2' : 'Q1');
          badge.textContent = `🔒 ${reqStage}`;
          badge.style.background = 'rgba(255, 255, 255, 0.08)';
          badge.style.color = 'var(--text-tertiary, #a1a1aa)';
        }
      }
    });

    // Update on-screen stage reward cards in Track 1 and Track 2
    ['tr1', 'tr2'].forEach(prefix => {
      const s1 = document.getElementById(`${prefix}-stage1-powerup-status`);
      if (s1) {
        if (poolSize >= 2) {
          s1.className = 'live-stage-powerup-status lsp-unlocked';
          s1.innerHTML = '<span class="lsp-icon">✅</span><span><strong>2 Power-Ups Unlocked in Real-Time:</strong> Time Cracker ⚡ + Topic Finder 🔍</span>';
        } else {
          s1.className = 'live-stage-powerup-status';
          s1.innerHTML = '<span class="lsp-icon">⚡</span><span><strong>Reward on Solve:</strong> 2 Power-Ups Unlock into your Round 3 Pool (Time Cracker & Topic Finder)</span>';
        }
      }

      const s2 = document.getElementById(`${prefix}-stage2-powerup-status`);
      if (s2) {
        if (poolSize >= 4) {
          s2.className = 'live-stage-powerup-status lsp-unlocked';
          s2.innerHTML = '<span class="lsp-icon">✅</span><span><strong>4 Power-Ups Unlocked:</strong> Penalty Sweeper 🛡️ + Jumper Points 🚀 (4/5 in Pool)</span>';
        } else {
          s2.className = 'live-stage-powerup-status';
          s2.innerHTML = '<span class="lsp-icon">🛡️</span><span><strong>Reward on Solve:</strong> +2 Power-Ups Unlock (Penalty Sweeper & Jumper Points)</span>';
        }
      }

      const s3 = document.getElementById(`${prefix}-stage3-powerup-status`);
      if (s3) {
        if (poolSize >= 5) {
          s3.className = 'live-stage-powerup-status lsp-unlocked';
          s3.innerHTML = '<span class="lsp-icon">💣</span><span><strong>All 5 Power-Ups Unlocked:</strong> Sweet Sabotage Ultimate Ready!</span>';
        } else {
          s3.className = 'live-stage-powerup-status';
          s3.innerHTML = '<span class="lsp-icon">💣</span><span><strong>Reward on Solve:</strong> Final Ultimate Power-Up Unlocks: Sweet Sabotage (5/5 Pool)</span>';
        }
      }
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
