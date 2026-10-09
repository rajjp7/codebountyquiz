// Teacher / Room Administration Controller
class AdminControls {
  constructor() {
    this.powerupsData = [];
    this.init();
  }

  init() {
    this.loadAdminData();
    this.loadPowerupsData();
    this.bindDOM();
  }

  async loadAdminData() {
    try {
      const [roomRes, puzzlesRes] = await Promise.all([
        fetch('/api/room'),
        fetch('/api/puzzles')
      ]);

      const room = await roomRes.json();
      const puzzles = await puzzlesRes.json();

      this.populatePuzzlesSelect(puzzles, room.active_puzzle_id);

      const titleInput = document.getElementById('admin-quiz-title');
      if (titleInput) titleInput.value = room.quiz_title || '';

      const timeLimitSelect = document.getElementById('admin-time-limit');
      if (timeLimitSelect) timeLimitSelect.value = String(room.time_limit_seconds || 600);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    }
  }

  async loadPowerupsData() {
    try {
      const res = await fetch('/api/admin/powerups');
      const data = await res.json();
      this.powerupsData = data.records || [];
      this.renderPowerupsTable();
    } catch (err) {
      console.error('Failed to load powerups data:', err);
    }
  }

  renderPowerupsTable() {
    const tbody = document.getElementById('admin-powerups-tbody');
    if (!tbody) return;

    const filterLab = document.getElementById('admin-powerups-lab-filter')?.value || 'all';
    const filterTrack = document.getElementById('admin-powerups-track-filter')?.value || 'all';
    const searchQuery = (document.getElementById('admin-powerups-search')?.value || '').trim().toLowerCase();

    // Update export button link with filters
    const exportBtn = document.getElementById('btn-export-excel-admin');
    if (exportBtn) {
      exportBtn.href = `/api/admin/export/excel?track=${encodeURIComponent(filterTrack)}&lab=${encodeURIComponent(filterLab)}`;
    }

    let list = this.powerupsData;

    if (filterLab !== 'all') {
      list = list.filter(r => r.lab === filterLab);
    }

    if (filterTrack !== 'all') {
      list = list.filter(r => (r.track || 'track1').toLowerCase() === filterTrack.toLowerCase());
    }

    if (searchQuery) {
      list = list.filter(r =>
        (r.student_name && r.student_name.toLowerCase().includes(searchQuery)) ||
        (r.student_id && r.student_id.toLowerCase().includes(searchQuery)) ||
        (r.college && r.college.toLowerCase().includes(searchQuery))
      );
    }

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="11" style="text-align: center; color: var(--text-tertiary); padding: 1.5rem;">
            No participant records matched your filter criteria.
          </td>
        </tr>
      `;
      return;
    }

    const formatPowerup = (p) => {
      if (!p || p === 'None' || p === 'Not Selected') return `<span style="color: var(--text-tertiary);">-</span>`;
      const name = p.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      return `<span class="pill-batch" style="background: var(--bg-surface-elevated); color: var(--text-primary); border: 1px solid var(--border-hairline); font-size: 0.72rem;">${name}</span>`;
    };

    const formatUnlockedPills = (unlockedList) => {
      if (!Array.isArray(unlockedList) || unlockedList.length === 0) {
        return `<span style="color: var(--text-tertiary); font-size: 0.75rem;">None (0)</span>`;
      }
      return unlockedList.map(id => {
        const icons = {
          time_cracker: 'Time Cracker',
          topic_finder: 'Topic Finder',
          penalty_sweeper: 'Penalty Sweeper',
          jumper_points: 'Jumper Points',
          sweet_sabotage: 'Sweet Sabotage'
        };
        const label = icons[id] || id;
        const isSabotage = id === 'sweet_sabotage';
        return `<span class="pill-batch" style="font-size: 0.68rem; margin: 2px; display: inline-block; ${isSabotage ? 'background: rgba(239, 68, 68, 0.15); color: var(--rose-500); border-color: rgba(239, 68, 68, 0.3);' : ''}">${label}</span>`;
      }).join('');
    };

    tbody.innerHTML = list.map(item => `
      <tr>
        <td>
          <div style="font-weight: 600; color: var(--text-primary);">${item.student_name || item.participant_name || 'Participant'}</div>
          <div style="font-size: 0.72rem; color: var(--text-tertiary); font-family: var(--font-mono);">${item.student_id || item.participant_id || '-'}</div>
        </td>
        <td>
          <div style="font-size: 0.8rem; color: var(--text-secondary); max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.college || '-'}">
            ${item.college || '—'}
          </div>
        </td>
        <td>
          <span class="mono" style="font-size: 0.78rem; color: var(--text-primary); font-weight: 500;">
            ${item.track === 'track1' ? 'FY Track' : 'Track 2'}
          </span>
        </td>
        <td>
          <span class="mono" style="font-size: 0.78rem;">${item.lab || 'Lab 1'}</span>
        </td>
        <td style="text-align: center;">
          <strong class="mono" style="color: var(--text-primary); font-size: 0.95rem;">${item.questions_solved}</strong>/3
        </td>
        <td style="text-align: center;">
          <span class="mono" style="color: var(--text-secondary); font-weight: 600;">${item.pool_size}</span>/5
        </td>
        <td style="max-width: 200px;">
          ${formatUnlockedPills(item.unlocked_powerups)}
        </td>
        <td>${formatPowerup(item.powerup_1)}</td>
        <td>${formatPowerup(item.powerup_2)}</td>
        <td>
          <span class="mono" style="font-size: 0.72rem; color: ${item.sabotage_target && item.sabotage_target !== '-' ? 'var(--rose-500)' : 'var(--text-tertiary)'};">
            ${item.sabotage_target || '-'}
          </span>
        </td>
        <td>
          ${item.powerups_confirmed
            ? `<span style="color: var(--text-primary); font-size: 0.75rem; font-weight: 600; display: inline-flex; align-items: center; gap: 0.25rem;"><span class="status-dot-sm"></span>Confirmed</span>`
            : `<span style="color: var(--text-tertiary); font-size: 0.75rem;">Pending</span>`
          }
        </td>
      </tr>
    `).join('');
  }

  populatePuzzlesSelect(puzzles, activeId) {
    const select = document.getElementById('admin-puzzle-select');
    if (!select) return;

    select.innerHTML = puzzles.map(p => `
      <option value="${p.id}" ${p.id === activeId ? 'selected' : ''}>
        ${p.name} (${p.difficulty} • ${p.width}x${p.height} • ${p.islandsCount} islands)
      </option>
    `).join('');
  }

  bindDOM() {
    document.getElementById('admin-powerups-lab-filter')?.addEventListener('change', () => this.renderPowerupsTable());
    document.getElementById('admin-powerups-track-filter')?.addEventListener('change', () => this.renderPowerupsTable());
    document.getElementById('admin-powerups-search')?.addEventListener('input', () => this.renderPowerupsTable());

    const form = document.getElementById('form-admin-room');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const activePuzzleId = document.getElementById('admin-puzzle-select')?.value;
      const quizTitle = document.getElementById('admin-quiz-title')?.value;
      const timeLimitSeconds = parseInt(document.getElementById('admin-time-limit')?.value, 10);

      try {
        const res = await fetch('/api/room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            active_puzzle_id: activePuzzleId,
            quiz_title: quizTitle,
            time_limit_seconds: timeLimitSeconds
          })
        });

        const data = await res.json();
        if (data.success) {
          window.app?.showToast('Quiz room settings updated! Students will now get this contest puzzle.', 'success');
          // Update badge
          const badge = document.getElementById('active-quiz-badge');
          if (badge) badge.textContent = `${quizTitle} • Updated`;
        }
      } catch (err) {
        alert('Error saving room settings: ' + err.message);
      }
    });
  }
}

window.AdminControls = AdminControls;
