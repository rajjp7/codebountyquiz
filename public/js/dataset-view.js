// Dataset & Cohort Analytics Controller
class DatasetManager {
  constructor() {
    this.currentBatch = 'all';
    this.currentTrack = 'all';
    this.currentSearch = '';
    this.init();
  }

  init() {
    this.bindDOM();
    this.loadDataset();
  }

  bindDOM() {
    // Search input with debounce
    const searchInput = document.getElementById('dataset-search-input');
    let searchTimeout = null;
    searchInput?.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.currentSearch = e.target.value.trim();
        this.loadDataset();
      }, 250);
    });

    // Batch Filter Select
    const batchSelect = document.getElementById('dataset-batch-select');
    batchSelect?.addEventListener('change', (e) => {
      this.currentBatch = e.target.value;
      this.loadDataset();
    });

    // Track Filter Select
    const trackSelect = document.getElementById('dataset-track-select');
    trackSelect?.addEventListener('change', (e) => {
      this.currentTrack = e.target.value;
      this.loadDataset();
    });

    // Export Buttons
    document.getElementById('btn-export-csv')?.addEventListener('click', () => {
      const url = `/api/dataset/export/csv?batch=${encodeURIComponent(this.currentBatch)}&track=${encodeURIComponent(this.currentTrack)}`;
      window.location.href = url;
      window.app?.showToast('Downloading CSV dataset...', 'info');
    });

    document.getElementById('btn-export-json')?.addEventListener('click', () => {
      const url = `/api/dataset/export/json?batch=${encodeURIComponent(this.currentBatch)}&track=${encodeURIComponent(this.currentTrack)}`;
      window.location.href = url;
      window.app?.showToast('Downloading JSON dataset...', 'info');
    });

    // Seed Buttons
    document.getElementById('btn-seed-batch-a')?.addEventListener('click', () => this.seedCohort('Batch A'));
    document.getElementById('btn-seed-batch-b')?.addEventListener('click', () => this.seedCohort('Batch B'));

    // Clear Dataset Button
    document.getElementById('btn-clear-dataset')?.addEventListener('click', () => this.clearDataset());
  }

  async loadDataset() {
    try {
      const params = new URLSearchParams();
      if (this.currentBatch !== 'all') params.append('batch', this.currentBatch);
      if (this.currentTrack !== 'all') params.append('track', this.currentTrack);
      if (this.currentSearch) params.append('search', this.currentSearch);

      const res = await fetch(`/api/dataset?${params.toString()}`);
      const data = await res.json();

      this.renderKPIs(data.summary);
      this.renderTable(data.records);
    } catch (err) {
      console.error('Failed to load dataset:', err);
    }
  }

  renderKPIs(summary) {
    if (!summary) return;
    document.getElementById('kpi-total-students').textContent = summary.total_students || 0;
    document.getElementById('kpi-completion-rate').textContent = `${summary.completion_rate || 0}%`;
    document.getElementById('kpi-avg-time').textContent = summary.avg_formatted_time || '--:--';
    document.getElementById('kpi-fastest-time').textContent = summary.fastest_formatted_time || '--:--';
  }

  renderTable(records) {
    const tbody = document.getElementById('dataset-tbody');
    const countLabel = document.getElementById('dataset-records-count');
    if (countLabel) countLabel.textContent = `Showing ${records.length} records`;

    if (!tbody) return;

    if (!records || records.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; padding: 2.5rem; color: var(--text-dim);">
            No dataset records match current query.
          </td>
        </tr>
      `;
      return;
    }

    let rowsHtml = '';
    records.forEach((r, idx) => {
      const isCompleted = r.status === 'COMPLETED';
      rowsHtml += `
        <tr>
          <td class="mono" style="font-size: 0.75rem; color: var(--text-tertiary);">${idx + 1}</td>
          <td>
            <div style="font-weight: 600;">${this.escape(r.student_name)}</div>
            <div class="mono" style="font-size: 0.72rem; color: var(--text-secondary);">${this.escape(r.student_id)}</div>
          </td>
          <td><span class="pill-batch">${this.escape(r.batch)}</span></td>
          <td style="font-size: 0.78rem; color: var(--text-secondary);">
            ${r.track === 'track2' ? '<span class="pill-batch" style="margin-right: 4px;">Track 2</span>' : '<span class="pill-batch" style="margin-right: 4px;">FY Track</span>'}
            ${this.escape(r.puzzle_name || 'Hashi')}
          </td>
          <td>
            <span class="status-pill ${isCompleted ? 'status-completed' : 'status-inprogress'}">
              ${isCompleted ? 'Completed' : 'Solving'}
            </span>
          </td>
          <td class="mono" style="font-weight: 600;">
            ${r.formatted_time || '--:--'}
          </td>
          <td class="mono">${r.moves_count || 0}</td>
          <td class="mono" style="color: ${r.mistakes_count > 0 ? 'var(--rose-500)' : 'var(--text-secondary)'};">
            ${r.mistakes_count || 0}
          </td>
          <td class="mono" style="color: ${r.tab_switches > 0 ? 'var(--rose-500)' : 'var(--text-secondary)'}; font-weight: ${r.tab_switches > 0 ? '600' : 'normal'};">
            ${r.tab_switches || 0}
          </td>
          <td class="mono" style="font-weight: 600;">${r.score || 0}</td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;
  }

  async seedCohort(batchName) {
    try {
      const res = await fetch('/api/dataset/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch: batchName, count: 30 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      window.app?.showToast(`Successfully seeded 30 students for ${batchName}!`, 'success');
      this.loadDataset();
      window.leaderboardManager?.loadLeaderboard();
    } catch (err) {
      alert('Error seeding batch: ' + err.message);
    }
  }

  async clearDataset() {
    if (!confirm('Are you sure you want to clear all student records? This cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(`/api/dataset?batch=${encodeURIComponent(this.currentBatch)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      window.app?.showToast('Dataset records cleared', 'info');
      this.loadDataset();
      window.leaderboardManager?.loadLeaderboard();
    } catch (err) {
      alert('Error clearing dataset: ' + err.message);
    }
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

window.DatasetManager = DatasetManager;
