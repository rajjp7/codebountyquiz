// Main Application Orchestrator
class App {
  constructor() {
    this.currentTheme = localStorage.getItem('hashi_theme') || 'dark';
    this.activeTrack = localStorage.getItem('hashi_active_track') || 'track2';
    this.currentRole = null; // 'contestant' | 'admin'
    this.contestantProfile = null;
    this.init();
  }

  init() {
    this.applyTheme(this.currentTheme);
    this.bindNavigation();
    this.bindTrackSwitcher();
    this.bindThemeToggle();
    this.bindSoundToggle();
    this.initConfetti();
    this.initAuthGateway();
  }

  initAuthGateway() {
    // 1. Auth tabs switcher inside modal
    const tabContestant = document.getElementById('tab-btn-auth-contestant');
    const tabAdmin = document.getElementById('tab-btn-auth-admin');
    const formContestant = document.getElementById('form-contestant-login');
    const formAdmin = document.getElementById('form-admin-login');

    tabContestant?.addEventListener('click', () => {
      tabContestant.classList.add('active');
      tabAdmin?.classList.remove('active');
      formContestant.style.display = 'block';
      formAdmin.style.display = 'none';
      document.getElementById('input-contestant-name')?.focus();
    });

    tabAdmin?.addEventListener('click', () => {
      tabAdmin.classList.add('active');
      tabContestant?.classList.remove('active');
      formAdmin.style.display = 'block';
      formContestant.style.display = 'none';
      document.getElementById('input-admin-password')?.focus();
    });

    // 2. Track selection cards inside contestant form
    const cardTrack1 = document.getElementById('card-track-1');
    const cardTrack2 = document.getElementById('card-track-2');

    cardTrack1?.addEventListener('click', () => {
      cardTrack1.classList.add('active');
      cardTrack2?.classList.remove('active');
      const radio = cardTrack1.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });

    cardTrack2?.addEventListener('click', () => {
      cardTrack2.classList.add('active');
      cardTrack1?.classList.remove('active');
      const radio = cardTrack2.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });

    // 3. Contestant Login Form Submit
    formContestant?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('input-contestant-name')?.value?.trim();
      const college = document.getElementById('input-contestant-college')?.value?.trim();
      const lab = document.getElementById('input-contestant-lab')?.value || 'Lab 1';
      const trackRadio = document.querySelector('input[name="contestant_track"]:checked');
      const track = trackRadio ? trackRadio.value : 'track1';

      if (!name || !college) {
        alert('Please fill in both Team/Contestant Name and College.');
        return;
      }

      try {
        const res = await fetch('/api/round2/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_name: name,
            college,
            lab,
            track
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to start session');

        const profile = {
          role: 'contestant',
          name,
          college,
          lab,
          track,
          student_id: data.student_id,
          attempt_id: data.attempt_id
        };

        localStorage.setItem('round2_auth', JSON.stringify(profile));
        this.applyContestantSession(profile);
        this.showToast(`Welcome ${name}! Track locked to ${track === 'track1' ? 'FY Track' : 'Track 2'}.`, 'success');
      } catch (err) {
        console.warn('Network issue during round2 start, activating offline session:', err);
        const fallbackAttemptId = `att_offline_${Date.now()}`;
        const fallbackStudentId = `stu_offline_${Date.now()}`;
        const profile = {
          role: 'contestant',
          name,
          college,
          lab,
          track,
          student_id: fallbackStudentId,
          attempt_id: fallbackAttemptId
        };
        localStorage.setItem('round2_auth', JSON.stringify(profile));
        this.applyContestantSession(profile);
        this.showToast(`Welcome ${name}! Session active (Progress auto-saved in browser).`, 'info');
      }
    });

    // 4. Admin Login Form Submit
    formAdmin?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = document.getElementById('input-admin-password')?.value;
      const errorDiv = document.getElementById('admin-login-error');

      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });

        const data = await res.json();
        if (data.success) {
          if (errorDiv) errorDiv.style.display = 'none';
          const auth = { role: 'admin' };
          localStorage.setItem('round2_auth', JSON.stringify(auth));
          this.applyAdminSession();
          this.showToast('Administrator authenticated. Full evaluation access unlocked.', 'success');
        } else {
          if (errorDiv) {
            errorDiv.style.display = 'block';
            errorDiv.textContent = data.error || 'Incorrect password.';
          }
        }
      } catch (err) {
        if (errorDiv) {
          errorDiv.style.display = 'block';
          errorDiv.textContent = 'Server connection error.';
        }
      }
    });

    // 5. Header Action Button (Login / Switch / Exit)
    document.getElementById('btn-auth-action')?.addEventListener('click', () => {
      this.promptSwitchOrLogout();
    });

    // 6. Check existing session on load
    const savedAuth = localStorage.getItem('round2_auth');
    if (savedAuth) {
      try {
        const auth = JSON.parse(savedAuth);
        if (auth.role === 'admin') {
          this.applyAdminSession();
          return;
        } else if (auth.role === 'contestant') {
          this.applyContestantSession(auth);
          return;
        }
      } catch (e) {}
    }

    // Default: Show Login Gateway Modal
    this.openAuthModal();
  }

  openAuthModal(force = false) {
    if (!force && localStorage.getItem('round2_auth')) {
      return;
    }
    const modal = document.getElementById('modal-auth-gateway');
    if (modal) modal.classList.add('open');
  }

  closeAuthModal() {
    const modal = document.getElementById('modal-auth-gateway');
    if (modal) modal.classList.remove('open');
  }

  applyContestantSession(profile) {
    this.currentRole = 'contestant';
    this.contestantProfile = profile;

    // 1. Permanently lock track: Hide switcher, show static locked pill
    const trackSwitcher = document.getElementById('main-track-switcher');
    const lockedPill = document.getElementById('contestant-locked-track-pill');
    const lockedText = document.getElementById('contestant-locked-track-name');

    if (trackSwitcher) trackSwitcher.style.display = 'none';
    if (lockedPill) lockedPill.style.display = 'inline-flex';
    if (lockedText) {
      lockedText.textContent = (profile.track === 'track1') ? 'FY Track' : 'Track 2';
    }

    // Lock and switch to their chosen track
    this.switchTrack(profile.track, true);

    // 2. Hide prohibited tabs: Contestant can ONLY see Challenges, Power-Ups, Leaderboard
    const navQuiz = document.getElementById('nav-btn-quiz');
    const navPowerups = document.getElementById('nav-btn-powerups');
    const navLeaderboard = document.getElementById('nav-btn-leaderboard');
    const navDataset = document.getElementById('nav-btn-dataset');
    const navAdmin = document.getElementById('nav-btn-admin');
    const navRules = document.getElementById('nav-btn-rules');

    if (navQuiz) navQuiz.style.display = 'inline-flex';
    if (navPowerups) navPowerups.style.display = 'inline-flex';
    if (navLeaderboard) navLeaderboard.style.display = 'none';

    if (navDataset) navDataset.style.display = 'none';
    if (navAdmin) navAdmin.style.display = 'none';
    if (navRules) navRules.style.display = 'none';

    // 3. Update header profile badge & show clean timer
    const headerUserBadge = document.getElementById('header-user-badge');
    const headerUserText = document.getElementById('header-user-text');
    const btnAuth = document.getElementById('btn-auth-action');
    const headerTimer = document.getElementById('header-global-timer');
    const headerCapsule = document.getElementById('header-powerup-capsule');

    if (headerTimer) headerTimer.style.display = 'inline-flex';
    if (headerCapsule) headerCapsule.style.display = 'inline-flex';
    if (headerUserBadge) headerUserBadge.style.display = 'inline-flex';
    if (headerUserText) {
      headerUserText.innerHTML = `<span class="user-name-label">${profile.name}</span> <span class="user-meta-sub">• ${profile.lab || 'Lab'}</span>`;
    }
    if (btnAuth) btnAuth.textContent = 'Exit';

    // 4. Close modal and open challenges tab
    this.closeAuthModal();
    this.switchTab('quiz');

    // 5. Initialize or Resume chosen track attempt with async polling resilience
    const initAttempt = (retries = 20) => {
      if (window.powerupsManager) {
        window.powerupsManager.attemptId = profile.attempt_id;
        window.powerupsManager.restoreState(profile.attempt_id);
      }

      if (profile.track === 'track1') {
        if (window.track1Manager) {
          window.track1Manager.startOrResumeAttempt(profile.name, profile.student_id, profile.college, profile.lab, profile.attempt_id);
          if (window.track2Manager?.resetForNewAttempt) {
            window.track2Manager.resetForNewAttempt('', '', '', '', null);
          }
        } else if (retries > 0) {
          setTimeout(() => initAttempt(retries - 1), 50);
        }
      } else {
        if (window.track2Manager) {
          window.track2Manager.startOrResumeAttempt(profile.name, profile.student_id, profile.college, profile.lab, profile.attempt_id);
          if (window.track1Manager?.resetForNewAttempt) {
            window.track1Manager.resetForNewAttempt('', '', '', '', null);
          }
        } else if (retries > 0) {
          setTimeout(() => initAttempt(retries - 1), 50);
        }
      }
    };
    initAttempt();
  }

  applyAdminSession() {
    this.currentRole = 'admin';
    this.contestantProfile = null;

    // 1. Enable track switcher for Admin inspection
    const trackSwitcher = document.getElementById('main-track-switcher');
    const lockedPill = document.getElementById('contestant-locked-track-pill');
    const headerTimer = document.getElementById('header-global-timer');
    const headerCapsule = document.getElementById('header-powerup-capsule');

    if (headerTimer) headerTimer.style.display = 'none';
    if (headerCapsule) headerCapsule.style.display = 'none';
    if (trackSwitcher) trackSwitcher.style.display = 'inline-flex';
    if (lockedPill) lockedPill.style.display = 'none';

    // 2. Show all administrative and audit tabs
    const navQuiz = document.getElementById('nav-btn-quiz');
    const navPowerups = document.getElementById('nav-btn-powerups');
    const navLeaderboard = document.getElementById('nav-btn-leaderboard');
    const navDataset = document.getElementById('nav-btn-dataset');
    const navAdmin = document.getElementById('nav-btn-admin');
    const navRules = document.getElementById('nav-btn-rules');

    if (navAdmin) navAdmin.style.display = 'inline-flex';
    if (navLeaderboard) navLeaderboard.style.display = 'inline-flex';
    if (navDataset) navDataset.style.display = 'inline-flex';
    if (navQuiz) navQuiz.style.display = 'inline-flex';
    if (navPowerups) navPowerups.style.display = 'inline-flex';
    if (navRules) navRules.style.display = 'inline-flex';

    // 3. Update header badge
    const headerUserBadge = document.getElementById('header-user-badge');
    const headerUserText = document.getElementById('header-user-text');
    const btnAuth = document.getElementById('btn-auth-action');

    if (headerUserBadge) {
      headerUserBadge.style.display = 'inline-flex';
      headerUserBadge.style.borderColor = 'var(--border-subtle)';
    }
    if (headerUserText) {
      headerUserText.innerHTML = '<span class="status-dot"></span><span style="font-weight: 600; color: var(--text-primary);">Administrator</span>';
    }
    if (btnAuth) btnAuth.textContent = 'Logout';

    // 4. Close modal, open Admin Hub, and load fresh telemetry
    this.closeAuthModal();
    this.switchTab('admin');
    window.adminControls?.loadPowerupsData();

    // 5. Unlock all stages for admin — admin can freely inspect any question
    this._unlockAllStagesForAdmin();
  }

  _unlockAllStagesForAdmin() {
    const allUnlocked = { 1: true, 2: true, 3: true, 4: true };
    const allCompleted = { 1: false, 2: false, 3: false };

    if (window.track1Manager) {
      window.track1Manager.stagesUnlocked = { ...allUnlocked };
      window.track1Manager.stagesCompleted = { ...allCompleted };
      window.track1Manager.updateStepperUI?.();
    }

    if (window.track2Manager) {
      window.track2Manager.stagesUnlocked = { ...allUnlocked };
      window.track2Manager.stagesCompleted = { ...allCompleted };
      window.track2Manager.updateStepperUI?.();
    }
  }

  promptSwitchOrLogout() {
    if (window.track1Manager?.timerInterval) {
      clearInterval(window.track1Manager.timerInterval);
      window.track1Manager.timerInterval = null;
    }
    if (window.track2Manager?.timerInterval) {
      clearInterval(window.track2Manager.timerInterval);
      window.track2Manager.timerInterval = null;
    }
    const headerTimer = document.getElementById('header-global-timer');
    const headerCapsule = document.getElementById('header-powerup-capsule');
    if (headerTimer) headerTimer.style.display = 'none';
    if (headerCapsule) headerCapsule.style.display = 'none';

    localStorage.removeItem('round2_auth');
    this.currentRole = null;
    this.contestantProfile = null;

    // Reset boards and state so previous user's bridges or answers do not persist
    if (window.track1Manager?.resetForNewAttempt) {
      window.track1Manager.resetForNewAttempt('', '', '', '', null);
    }
    if (window.track2Manager?.resetForNewAttempt) {
      window.track2Manager.resetForNewAttempt('', '', '', '', null);
    }
    if (window.powerupsManager?.resetForNewAttempt) {
      window.powerupsManager.resetForNewAttempt(null);
    }

    this.openAuthModal(true);
  }

  bindTrackSwitcher() {
    const btnT1 = document.getElementById('btn-track-1');
    const btnT2 = document.getElementById('btn-track-2');

    btnT1?.addEventListener('click', () => this.switchTrack('track1'));
    btnT2?.addEventListener('click', () => this.switchTrack('track2'));

    this.switchTrack(this.activeTrack);
  }

  switchTrack(trackId, force = false) {
    if (this.currentRole === 'contestant' && !force) {
      this.showToast('Your competition track is permanently locked!', 'warning');
      return;
    }

    this.activeTrack = trackId;
    localStorage.setItem('hashi_active_track', trackId);

    const btnT1 = document.getElementById('btn-track-1');
    const btnT2 = document.getElementById('btn-track-2');
    btnT1?.classList.toggle('active', trackId === 'track1');
    btnT2?.classList.toggle('active', trackId === 'track2');

    const portal1 = document.getElementById('track1-portal');
    const portal2 = document.getElementById('track2-portal');
    const badge = document.getElementById('active-quiz-badge');

    if (trackId === 'track1') {
      if (portal1) portal1.style.display = 'block';
      if (portal2) portal2.style.display = 'none';
      if (badge) badge.textContent = 'FY Track (1st Years)';
      if (window.track1Manager) {
        if (!window.track1Manager.hashiEngine?.svg || !document.contains(window.track1Manager.hashiEngine.svg)) {
          window.track1Manager.initStage1Board();
        } else {
          setTimeout(() => window.track1Manager.hashiEngine?.updateVisualState(), 50);
        }
      }
    } else {
      if (portal1) portal1.style.display = 'none';
      if (portal2) portal2.style.display = 'block';
      if (badge) badge.textContent = 'Track 2 (All Other Years)';
      if (window.track2Manager) {
        if (!window.track2Manager.hashiEngine?.svg || !document.contains(window.track2Manager.hashiEngine.svg)) {
          window.track2Manager.initHashiBoard();
        } else {
          setTimeout(() => window.track2Manager.hashiEngine?.updateVisualState(), 50);
        }
      }
    }
  }

  bindNavigation() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        this.switchTab(targetTab);
      });
    });

    // Handle hash in URL if present
    const hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById(`tab-${hash}`)) {
      this.switchTab(hash);
    }
  }

  switchTab(tabId) {
    // Guard: contestant can only view quiz and powerups (Leaderboard is admin-only)
    if (this.currentRole === 'contestant') {
      if (!['quiz', 'powerups'].includes(tabId)) {
        this.showToast('Leaderboard is hidden during competition.', 'warning');
        return;
      }
    }

    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
    });

    document.querySelectorAll('.tab-pane').forEach(p => {
      p.classList.toggle('active', p.id === `tab-${tabId}`);
    });

    // Refresh data when navigating into Leaderboard, Dataset, Powerups, or Admin
    if (tabId === 'leaderboard' && window.leaderboardManager) {
      window.leaderboardManager.loadLeaderboard();
    } else if (tabId === 'dataset' && window.datasetManager) {
      window.datasetManager.loadDataset();
    } else if (tabId === 'powerups' && window.powerupsManager) {
      window.powerupsManager.renderPowerupsUI();
    } else if (tabId === 'admin' && window.adminControls) {
      window.adminControls.loadPowerupsData();
    } else if (tabId === 'quiz' && this.currentRole === 'admin') {
      // Re-apply admin unlock every time admin visits the Quiz tab
      this._unlockAllStagesForAdmin();
    }
  }

  bindThemeToggle() {
    const btn = document.getElementById('btn-toggle-theme');
    btn?.addEventListener('click', () => {
      this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
      this.applyTheme(this.currentTheme);
      localStorage.setItem('hashi_theme', this.currentTheme);
    });
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.getElementById('theme-icon');
    if (icon) {
      icon.innerHTML = theme === 'dark'
        ? '<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />'
        : '<path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />';
    }
  }

  bindSoundToggle() {
    const btn = document.getElementById('btn-toggle-sound');
    btn?.addEventListener('click', () => {
      if (window.soundManager) {
        const isMuted = window.soundManager.toggleMute();
        const icon = document.getElementById('sound-icon');
        if (icon) {
          icon.innerHTML = isMuted
            ? '<path d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" stroke="currentColor" fill="none" stroke-width="2" /><path d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" />'
            : '<path d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />';
        }
        this.showToast(isMuted ? 'Sound muted' : 'Sound unmuted', 'info');
      }
    });
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-dot"></div>
      <div style="font-size: 0.8125rem; font-weight: 500; color: var(--text-primary); line-height: 1.4;">${message}</div>
    `;

    container.appendChild(toast);
    const duration = type === 'accepted' ? 5200 : 3400;
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(6px)';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }

  showAcceptedToast(stageNumber, powerupNames = [], poolSize = '') {
    const pStr = Array.isArray(powerupNames) && powerupNames.length > 0 ? powerupNames.join(' & ') : '';
    const isLast = stageNumber === 3;
    const msg = `
      <div style="display: flex; flex-direction: column; gap: 3px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="background: #10b981; color: #022c22; font-weight: 800; font-size: 0.6875rem; padding: 2px 7px; border-radius: 4px; letter-spacing: 0.06em; text-transform: uppercase;">ACCEPTED</span>
          <strong style="color: #10b981; font-size: 0.875rem;">Stage ${stageNumber} Verified!</strong>
        </div>
        ${pStr ? `<div style="font-size: 0.775rem; color: var(--text-secondary); margin-top: 1px;">
          ${window.powerupsManager?.getIconSvg(isLast ? 'sweet_sabotage' : 'time_cracker') || ''} Unlocked: <strong style="color: #facc15;">${pStr}</strong> (${poolSize} in pool)
        </div>` : ''}
      </div>
    `;
    this.showToast(msg, 'accepted');
  }

  showStageConfirmation({ isCorrect, title, message, reward, stageNumber, unlockedPowerups, poolSize, buttonText, onAction }) {
    const modal = document.getElementById('modal-stage-confirmation');
    const badgePill = document.getElementById('stage-conf-badge-pill');
    const iconBox = document.getElementById('stage-conf-icon-box');
    const titleEl = document.getElementById('stage-conf-title');
    const msgEl = document.getElementById('stage-conf-message');
    const rewardEl = document.getElementById('stage-conf-reward-box');
    const actionBtn = document.getElementById('stage-conf-action-btn');
    if (!modal) return;

    if (isCorrect) {
      if (badgePill) {
        badgePill.style.display = 'inline-flex';
        badgePill.className = 'accepted-status-badge';
        badgePill.innerHTML = '<span class="asb-dot"></span><span>ACCEPTED • 100% CORRECT</span>';
      }
      iconBox.style.background = 'rgba(16, 185, 129, 0.15)';
      iconBox.style.color = '#10b981';
      iconBox.style.border = '1px solid rgba(16, 185, 129, 0.3)';
      iconBox.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      titleEl.innerHTML = `<span style="color: #10b981; font-weight: 800;">ACCEPTED:</span> ${title || `Stage ${stageNumber} Verified`}`;
      titleEl.style.color = 'var(--text-primary)';
      msgEl.textContent = message || 'Challenge successfully verified.';

      const powerupMeta = {
        time_cracker: { name: 'Time Cracker', icon: window.powerupsManager?.getIconSvg('time_cracker') || '', tag: 'TIME', desc: 'Deducts 20% of your total solve time in Round 3.' },
        topic_finder: { name: 'Topic Finder', icon: window.powerupsManager?.getIconSvg('topic_finder') || '', tag: 'INTEL', desc: 'Reveals the concept and algorithm needed for the question.' },
        penalty_sweeper: { name: 'Penalty Sweeper', icon: window.powerupsManager?.getIconSvg('penalty_sweeper') || '', tag: 'SHIELD', desc: 'Removes all penalty points on a question in the next round.' },
        jumper_points: { name: 'Jumper Points', icon: window.powerupsManager?.getIconSvg('jumper_points') || '', tag: 'BOOST', desc: 'Multiplies points for the selected question by 1.5x.' },
        sweet_sabotage: { name: 'Sweet Sabotage', icon: window.powerupsManager?.getIconSvg('sweet_sabotage') || '', tag: 'ULTIMATE', desc: 'Use on any one participant sitting in your lab. Reduces their points by 10%!' }
      };

      const pList = unlockedPowerups || (stageNumber === 1 ? ['time_cracker', 'topic_finder'] : (stageNumber === 2 ? ['penalty_sweeper', 'jumper_points'] : (stageNumber === 3 ? ['sweet_sabotage'] : [])));
      const pCount = poolSize || (stageNumber === 1 ? '2/5' : (stageNumber === 2 ? '4/5' : (stageNumber === 3 ? '5/5 (Full Pool)' : '')));

      let powerupsHtml = '';
      if (pList.length > 0) {
        const headline = (stageNumber === 3) ? `${window.powerupsManager?.getIconSvg('sweet_sabotage') || ''} Ultimate Power-Up Unlocked!` : `✨ ${pList.length} Power-Ups Unlocked for Round 3!`;
        powerupsHtml = `
          <div class="modal-powerups-unlock-block">
            <div class="mpu-headline">
              <span class="mpu-title">${headline}</span>
              ${pCount ? `<span class="mpu-count">${pCount} in Pool</span>` : ''}
            </div>
            <div class="mpu-cards">
              ${pList.map(pid => {
                const info = powerupMeta[pid];
                if (!info) return '';
                const isUlt = pid === 'sweet_sabotage';
                return `
                  <div class="mpu-card ${isUlt ? 'mpu-card-ultimate' : ''}">
                    <span class="mpu-icon">${info.icon}</span>
                    <div class="mpu-details">
                      <div class="mpu-name">${info.name} <span class="mpu-badge ${isUlt ? 'mpu-badge-ultimate' : ''}">${info.tag}</span></div>
                      <div class="mpu-desc">${info.desc}</div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }

      if (reward || powerupsHtml) {
        rewardEl.style.display = 'block';
        rewardEl.innerHTML = (reward ? `<div style="margin-bottom: 0.35rem;">${reward}</div>` : '') + powerupsHtml;
      } else {
        rewardEl.style.display = 'none';
      }
      actionBtn.className = 'btn-primary';
      const btnSpan = actionBtn.querySelector('span');
      if (btnSpan) btnSpan.textContent = buttonText || 'Continue to Next Stage →';
      else actionBtn.textContent = buttonText || 'Continue to Next Stage →';
    } else {
      if (badgePill) {
        badgePill.style.display = 'none';
      }
      iconBox.style.background = 'rgba(239, 68, 68, 0.15)';
      iconBox.style.color = '#ef4444';
      iconBox.style.border = '1px solid rgba(239, 68, 68, 0.3)';
      iconBox.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      titleEl.textContent = title || 'Incorrect Answer';
      titleEl.style.color = 'var(--rose-500, #ef4444)';
      msgEl.textContent = message || 'Your solution does not satisfy all challenge rules.';
      rewardEl.style.display = 'none';
      actionBtn.className = 'btn-secondary';
      const btnSpan = actionBtn.querySelector('span');
      if (btnSpan) btnSpan.textContent = buttonText || 'Review & Try Again';
      else actionBtn.textContent = buttonText || 'Review & Try Again';
    }

    actionBtn.onclick = () => {
      modal.classList.remove('open');
      modal.style.display = 'none';
      if (typeof onAction === 'function') onAction();
    };

    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('open'));
  }

  showTimeUpModal() {
    const modal = document.getElementById('modal-time-up');
    if (modal) {
      modal.style.display = 'flex';
      requestAnimationFrame(() => modal.classList.add('open'));
    }
  }

  closeTimeUpModalAndGoPowerups() {
    const modal = document.getElementById('modal-time-up');
    if (modal) {
      modal.classList.remove('open');
      modal.style.display = 'none';
    }
    this.switchTab('powerups');
  }

  initConfetti() {
    const canvas = document.createElement('canvas');
    canvas.className = 'confetti-canvas';
    canvas.style.display = 'none';
    document.body.appendChild(canvas);
    this.confettiCanvas = canvas;
  }

  triggerConfetti() {
    const canvas = this.confettiCanvas;
    if (!canvas) return;
    canvas.style.display = 'block';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');

    const particles = [];
    const colors = ['#f59e0b', '#fbbf24', '#f4f4f6', '#10b981', '#a1a1aa'];

    for (let i = 0; i < 120; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height * 0.4,
        vx: (Math.random() - 0.5) * 14,
        vy: (Math.random() - 1.5) * 12,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        vr: (Math.random() - 0.5) * 10
      });
    }

    let frames = 0;
    const animate = () => {
      frames++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35; // gravity
        p.rotation += p.vr;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      });

      if (frames < 140) {
        requestAnimationFrame(animate);
      } else {
        canvas.style.display = 'none';
      }
    };

    requestAnimationFrame(animate);
  }
}

// Bootstrap reliably once DOM is ready
function bootstrapApp() {
  if (!window.app) window.app = new App();
  if (!window.studentQuiz) window.studentQuiz = new StudentQuiz();
  if (!window.leaderboardManager) window.leaderboardManager = new LeaderboardManager();
  if (!window.datasetManager) window.datasetManager = new DatasetManager();
  if (!window.adminControls) window.adminControls = new AdminControls();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapApp);
} else {
  bootstrapApp();
}
