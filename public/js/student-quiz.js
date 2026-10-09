// Student Quiz Controller
class StudentQuiz {
  constructor() {
    this.engine = null;
    this.currentAttempt = null;
    this.timerInterval = null;
    this.heartbeatInterval = null;
    this.startTimeMs = null;
    this.elapsedSeconds = 0;
    this.tabSwitches = 0;
    this.isSubmitted = false;

    this.init();
  }

  init() {
    this.bindDOM();
    this.bindIntegrityCheck();
    this.loadActiveRoom();
  }

  bindDOM() {
    // Toolbar buttons
    document.getElementById('btn-undo')?.addEventListener('click', () => this.engine?.undo());
    document.getElementById('btn-redo')?.addEventListener('click', () => this.engine?.redo());
    document.getElementById('btn-reset')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all bridges and restart?')) {
        this.engine?.reset();
      }
    });

    document.getElementById('btn-check')?.addEventListener('click', () => this.checkProgress());
    document.getElementById('btn-submit-quiz')?.addEventListener('click', () => this.submitQuiz());

    document.getElementById('btn-toggle-guides')?.addEventListener('click', () => {
      if (this.engine) {
        this.engine.options.showGuides = !this.engine.options.showGuides;
        this.engine.updateVisualState();
        const dot = document.getElementById('guide-status-dot');
        if (dot) {
          dot.style.background = this.engine.options.showGuides ? 'var(--text-primary)' : 'var(--text-tertiary)';
        }
        window.app?.showToast(this.engine.options.showGuides ? 'Ray guides enabled' : 'Ray guides hidden', 'info');
      }
    });

    // Join / Register form modal
    const joinForm = document.getElementById('form-join-quiz');
    joinForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleStartQuiz();
    });

    // Start New / Change Student button
    document.getElementById('btn-new-attempt')?.addEventListener('click', () => {
      this.showJoinModal();
    });
  }

  bindIntegrityCheck() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.currentAttempt && !this.isSubmitted) {
        this.tabSwitches++;
        window.app?.showToast(`Tab switch detected (${this.tabSwitches})! Quiz focus monitored.`, 'error');
        this.updateTelemetryDisplay();
      }
    });
  }

  async loadActiveRoom() {
    try {
      const res = await fetch('/api/room');
      const data = await res.json();
      this.room = data;

      // Update quiz title badge
      const roomBadge = document.getElementById('active-quiz-badge');
      if (roomBadge && data.puzzle) {
        roomBadge.textContent = `${data.quiz_title} • ${data.puzzle.name} (${data.puzzle.difficulty})`;
      }

      // Check if student has an existing session in localStorage
      const savedAttempt = localStorage.getItem('hashi_current_attempt');
      if (savedAttempt) {
        try {
          const attemptData = JSON.parse(savedAttempt);
          // Restore attempt if puzzle still matches
          if (attemptData.puzzle_id === data.active_puzzle_id) {
            this.resumeAttempt(attemptData);
            return;
          }
        } catch (e) {}
      }

      // If no active session, show join modal
      this.showJoinModal();
    } catch (err) {
      console.error('Failed to load room config:', err);
    }
  }

  showJoinModal() {
    if (window.app?.openAuthModal) {
      window.app.openAuthModal();
      return;
    }
    const modal = document.getElementById('modal-join-quiz');
    if (modal) modal.classList.add('open');
  }

  hideJoinModal() {
    if (window.app?.closeAuthModal) {
      window.app.closeAuthModal();
      return;
    }
    const modal = document.getElementById('modal-join-quiz');
    if (modal) modal.classList.remove('open');
  }

  async handleStartQuiz() {
    const batch = document.getElementById('input-batch')?.value?.trim();
    const studentId = document.getElementById('input-student-id')?.value?.trim();
    const studentName = document.getElementById('input-student-name')?.value?.trim();
    const track = document.getElementById('input-track')?.value || 'track2';
    const lab = document.getElementById('input-lab')?.value || 'Lab 1';

    if (!batch || !studentId || !studentName) {
      alert('Please fill in your Batch, Student ID, and Full Name.');
      return;
    }

    try {
      const res = await fetch('/api/round2/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch,
          student_id: studentId,
          student_name: studentName,
          track,
          lab
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start quiz');

      this.currentAttempt = {
        id: data.attempt_id,
        batch,
        student_id: studentId,
        student_name: studentName,
        track,
        lab,
        start_time: data.start_time,
        time_limit_seconds: data.time_limit_seconds
      };

      localStorage.setItem('hashi_current_attempt', JSON.stringify(this.currentAttempt));
      this.hideJoinModal();

      // Launch corresponding Track manager
      if (track === 'track1') {
        window.app?.switchTrack('track1');
        window.track1Manager?.startNewAttempt(studentName, studentId, batch, lab, data.attempt_id);
      } else {
        window.app?.switchTrack('track2');
        window.track2Manager?.startNewAttempt(studentName, studentId, batch, lab, data.attempt_id);
      }

      window.app?.showToast(`Welcome ${studentName}! 30-minute timer started for ${track === 'track1' ? 'FY Track' : 'Track 2'}.`, 'success');
    } catch (err) {
      alert('Error starting quiz: ' + err.message);
    }
  }

  resumeAttempt(attempt) {
    this.currentAttempt = attempt;
    fetch(`/api/puzzles/${attempt.puzzle_id}`)
      .then(r => r.json())
      .then(puzzle => {
        this.startQuizSession(puzzle, false);
        window.app?.showToast(`Resumed quiz for ${attempt.student_name} (${attempt.student_id})`, 'info');
      })
      .catch(() => this.showJoinModal());
  }

  startQuizSession(puzzle, isNew = true) {
    this.isSubmitted = false;
    this.tabSwitches = 0;
    this.startTimeMs = Date.now();
    this.elapsedSeconds = 0;

    // Update Student Header Card
    document.getElementById('display-student-name').textContent = this.currentAttempt.student_name;
    document.getElementById('display-student-id').textContent = this.currentAttempt.student_id;
    document.getElementById('display-batch').textContent = this.currentAttempt.batch;
    document.getElementById('display-avatar').textContent = this.currentAttempt.student_name.charAt(0).toUpperCase();

    // Initialize Game Engine
    const boardEl = document.getElementById('game-board-container');
    this.engine = new BridgesEngine({
      cellSize: puzzle.width <= 7 ? 68 : puzzle.width <= 10 ? 54 : 44,
      onMove: () => this.updateTelemetryDisplay(),
      onMistake: (err) => {
        this.updateTelemetryDisplay();
        window.app?.showToast(err.message, 'error');
      },
      onProgressUpdate: (state) => this.updateProgressBar(state),
      onSolved: (solution) => this.handleBoardSolved(solution)
    });

    this.engine.loadPuzzle(puzzle, boardEl);

    // Start Realtime Stopwatch
    this.startTimer();
    this.startHeartbeat();
    this.updateTelemetryDisplay();
  }

  startTimer() {
    clearInterval(this.timerInterval);
    const clockEl = document.getElementById('quiz-timer-clock');

    this.timerInterval = setInterval(() => {
      if (this.isSubmitted) return;
      this.elapsedSeconds = (Date.now() - this.startTimeMs) / 1000;
      const m = Math.floor(this.elapsedSeconds / 60);
      const s = Math.floor(this.elapsedSeconds % 60);
      const tenths = Math.floor((this.elapsedSeconds % 1) * 10);
      if (clockEl) {
        clockEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${tenths}`;
      }
    }, 100);
  }

  startHeartbeat() {
    clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(async () => {
      if (!this.currentAttempt || this.isSubmitted) return;
      const state = this.engine?.evaluateState();
      try {
        await fetch('/api/student/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attempt_id: this.currentAttempt.id,
            moves_count: this.engine?.movesCount || 0,
            mistakes_count: this.engine?.mistakesCount || 0,
            undos_count: this.engine?.undosCount || 0,
            tab_switches: this.tabSwitches,
            islands_completed: state?.completedCount || 0,
            elapsed_seconds: this.elapsedSeconds
          })
        });
      } catch (e) {}
    }, 8000);
  }

  updateTelemetryDisplay() {
    document.getElementById('stat-moves').textContent = this.engine?.movesCount || 0;
    document.getElementById('stat-mistakes').textContent = this.engine?.mistakesCount || 0;
    document.getElementById('stat-undos').textContent = this.engine?.undosCount || 0;
    document.getElementById('stat-tab-switches').textContent = this.tabSwitches;
  }

  updateProgressBar(state) {
    const percent = Math.round((state.completedCount / state.totalIslands) * 100);
    const fill = document.getElementById('quiz-progress-fill');
    const label = document.getElementById('quiz-progress-text');
    if (fill) fill.style.width = `${percent}%`;
    if (label) label.textContent = `${state.completedCount} / ${state.totalIslands} Islands Completed (${percent}%)`;
  }

  checkProgress() {
    const state = this.engine?.evaluateState();
    if (!state) return;

    if (state.isSolved) {
      window.app?.showToast('All bridges placed correctly! Graph is fully connected.', 'success');
    } else if (state.completedCount === state.totalIslands && !state.isFullyConnected) {
      window.app?.showToast('Degree counts match, but network is split into disconnected groups.', 'error');
    } else {
      window.app?.showToast(`Progress: ${state.completedCount} of ${state.totalIslands} islands satisfied.`, 'info');
    }
  }

  async handleBoardSolved(solution) {
    if (this.isSubmitted) return;
    window.app?.showToast('All islands connected! Submitting quiz...', 'success');
    this.submitQuiz();
  }

  async submitQuiz() {
    if (!this.currentAttempt || this.isSubmitted) return;

    const solution = this.engine?.serializeSolution() || [];
    const state = this.engine?.evaluateState();

    if (!state?.isSolved) {
      const confirmSubmit = confirm(
        `Warning: Your puzzle is not fully solved yet!\n\n` +
        `• Satisfied Islands: ${state?.completedCount || 0}/${state?.totalIslands || 0}\n` +
        `• Connected: ${state?.isFullyConnected ? 'Yes' : 'No'}\n\n` +
        `Do you still want to submit your final attempt?`
      );
      if (!confirmSubmit) return;
    }

    clearInterval(this.timerInterval);
    clearInterval(this.heartbeatInterval);
    this.isSubmitted = true;

    try {
      const res = await fetch('/api/student/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attempt_id: this.currentAttempt.id,
          bridges: solution,
          duration_seconds: this.elapsedSeconds,
          moves_count: this.engine?.movesCount || 0,
          mistakes_count: this.engine?.mistakesCount || 0,
          undos_count: this.engine?.undosCount || 0,
          tab_switches: this.tabSwitches
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Submission failed');

      // Clear localStorage
      localStorage.removeItem('hashi_current_attempt');

      // Show Results Modal
      this.showResultsModal(result);

      // Trigger Confetti if solved!
      if (result.valid) {
        window.app?.triggerConfetti();
        if (window.soundManager) window.soundManager.playVictory();
      }
    } catch (err) {
      alert('Error submitting quiz: ' + err.message);
      this.isSubmitted = false;
    }
  }

  showResultsModal(result) {
    const modal = document.getElementById('modal-results');
    if (!modal) return;

    document.getElementById('res-student-name').textContent = result.attempt.student_name;
    document.getElementById('res-time').textContent = result.attempt.formatted_time;
    document.getElementById('res-score').textContent = `${result.attempt.score} pts`;
    document.getElementById('res-rank').textContent = result.rank ? `#${result.rank} in ${result.attempt.batch}` : 'Completed';
    document.getElementById('res-mistakes').textContent = result.attempt.mistakes_count;
    document.getElementById('res-accuracy').textContent = result.valid ? '100% Perfect' : 'Incomplete';

    modal.classList.add('open');
  }
}

window.StudentQuiz = StudentQuiz;
