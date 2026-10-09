// Leaderboard Controller (Minimal & Aesthetic)
class LeaderboardManager {
  constructor() {
    this.currentBatch = 'all';
    this.currentTrack = 'all';
    this.refreshInterval = null;
    this.autoRefreshEnabled = true;

    this.init();
  }

  init() {
    this.bindDOM();
    this.loadLeaderboard();
    this.startAutoRefresh();
  }

  bindDOM() {
    // Cohort filter pills
    const filterPills = document.querySelectorAll('.leaderboard-filter-pill');
    filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        filterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.currentBatch = pill.getAttribute('data-batch');
        this.loadLeaderboard();
      });
    });

    // Track filter pills
    const trackPills = document.querySelectorAll('.leaderboard-track-pill');
    trackPills.forEach(pill => {
      pill.addEventListener('click', () => {
        trackPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.currentTrack = pill.getAttribute('data-track');
        this.loadLeaderboard();
      });
    });

    // Auto-refresh toggle
    const refreshToggle = document.getElementById('toggle-auto-refresh');
    refreshToggle?.addEventListener('change', (e) => {
      this.autoRefreshEnabled = e.target.checked;
      if (this.autoRefreshEnabled) {
        this.startAutoRefresh();
        window.app?.showToast('Live stream enabled', 'info');
      } else {
        clearInterval(this.refreshInterval);
        window.app?.showToast('Live stream paused', 'info');
      }
    });

    // Manual refresh
    document.getElementById('btn-refresh-leaderboard')?.addEventListener('click', () => {
      this.loadLeaderboard(true);
    });
  }

  startAutoRefresh() {
    clearInterval(this.refreshInterval);
    this.refreshInterval = setInterval(() => {
      if (this.autoRefreshEnabled) {
        this.loadLeaderboard(false);
      }
    }, 3500);
  }

  async loadLeaderboard(showToast = false) {
    try {
      const url = `/api/leaderboard?batch=${encodeURIComponent(this.currentBatch)}&track=${encodeURIComponent(this.currentTrack)}`;
      const res = await fetch(url);
      const data = await res.json();

      this.renderPodium(data.leaderboard);
      this.renderTable(data.leaderboard);

      if (showToast) {
        window.app?.showToast('Leaderboard updated', 'info');
      }
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    }
  }

  renderPodium(records) {
    const podiumEl = document.getElementById('leaderboard-podium');
    if (!podiumEl) return;

    const completed = records.filter(r => r.status === 'COMPLETED');

    if (completed.length === 0) {
      podiumEl.innerHTML = '';
      return;
    }

    if (completed.length < 3) {
      podiumEl.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 1.5rem; color: var(--text-tertiary); font-size: 0.8125rem;">
          ${completed.length} participant(s) finished so far. Top 3 finishers will appear on the podium.
        </div>
      `;
      return;
    }

    const first = completed[0];
    const second = completed[1];
    const third = completed[2];

    podiumEl.innerHTML = `
      <!-- Rank 2 (Silver) -->
      <div class="podium-box podium-silver">
        <div class="podium-rank-tag">2</div>
        <div class="podium-name">${this.escape(second.student_name)}</div>
        <div class="podium-id mono">${second.student_id} • ${second.batch}</div>
        <div class="podium-time">${second.formatted_time}</div>
        <div class="podium-score">${second.score} pts • ${second.mistakes_count} errors</div>
      </div>

      <!-- Rank 1 (Gold) -->
      <div class="podium-box podium-gold" style="border-color: rgba(245, 158, 11, 0.35);">
        <div class="podium-rank-tag">1</div>
        <div class="podium-name" style="font-weight: 700;">${this.escape(first.student_name)}</div>
        <div class="podium-id mono">${first.student_id} • ${first.batch}</div>
        <div class="podium-time" style="color: var(--amber-500);">${first.formatted_time}</div>
        <div class="podium-score"><b>${first.score} pts</b> • ${first.mistakes_count} errors</div>
      </div>

      <!-- Rank 3 (Bronze) -->
      <div class="podium-box podium-bronze">
        <div class="podium-rank-tag">3</div>
        <div class="podium-name">${this.escape(third.student_name)}</div>
        <div class="podium-id mono">${third.student_id} • ${third.batch}</div>
        <div class="podium-time">${third.formatted_time}</div>
        <div class="podium-score">${third.score} pts • ${third.mistakes_count} errors</div>
      </div>
    `;
  }

  renderTable(records) {
    const tbody = document.getElementById('leaderboard-tbody');
    if (!tbody) return;

    if (!records || records.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 3rem; color: var(--text-tertiary);">
            No contestant attempts recorded yet. Results will appear here live.
          </td>
        </tr>
      `;
      return;
    }

    let rowsHtml = '';
    records.forEach((r, idx) => {
      let rankDisplay = '';
      if (r.status === 'COMPLETED') {
        if (r.rank === 1) rankDisplay = `<span class="rank-pill rank-gold">1</span>`;
        else if (r.rank === 2) rankDisplay = `<span class="rank-pill rank-silver">2</span>`;
        else if (r.rank === 3) rankDisplay = `<span class="rank-pill rank-bronze">3</span>`;
        else rankDisplay = `<span class="rank-pill">${r.rank}</span>`;
      } else {
        rankDisplay = `<span style="color: var(--text-tertiary); font-size: 0.75rem;">—</span>`;
      }

      let statusBadge = '';
      if (r.status === 'COMPLETED') {
        statusBadge = `<span class="status-pill status-completed">Completed</span>`;
      } else if (r.status === 'IN_PROGRESS') {
        statusBadge = `<span class="status-pill status-inprogress">Solving (${r.islands_completed}/${r.total_islands || '?'})</span>`;
      } else {
        statusBadge = `<span class="status-pill" style="color: var(--rose-500);">Failed</span>`;
      }

      rowsHtml += `
        <tr>
          <td>${rankDisplay}</td>
          <td>
            <div style="font-weight: 600;">${this.escape(r.student_name)}</div>
          </td>
          <td class="mono" style="font-size: 0.75rem; color: var(--text-secondary);">${this.escape(r.student_id)}</td>
          <td><span class="pill-batch">${this.escape(r.batch)}</span></td>
          <td class="mono" style="font-weight: 600;">${r.formatted_time || '--:--'}</td>
          <td class="mono" style="font-weight: 500;">${r.score || 0}</td>
          <td class="mono">${r.moves_count || 0}</td>
          <td class="mono" style="color: ${r.mistakes_count > 0 ? 'var(--rose-500)' : 'var(--text-secondary)'};">
            ${r.mistakes_count || 0}
          </td>
          <td>${statusBadge}</td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;
  }

  escape(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }
}

window.LeaderboardManager = LeaderboardManager;
