// High-Fidelity Minimalist Hashi (Bridges) Game Engine
class BridgesEngine {
  constructor(arg1 = {}, arg2 = null, arg3 = {}) {
    let options = {};
    let initialContainer = null;
    let initialPuzzle = null;

    if (arg1 && (arg1.nodeType || typeof arg1 === 'string' || (arg2 && typeof arg2 === 'object' && arg2.islands))) {
      // Called as: new BridgesEngine(container, puzzle, options)
      initialContainer = typeof arg1 === 'string' ? document.getElementById(arg1) : arg1;
      initialPuzzle = arg2;
      options = arg3 || {};
    } else {
      // Called as: new BridgesEngine(options)
      options = arg1 || {};
    }

    this.container = initialContainer;
    this.puzzle = initialPuzzle;
    this.options = {
      readOnly: false,
      showGuides: true,
      groupTint: false,
      autoMarkSatisfied: true,
      interactive: true,
      soundEnabled: true,
      ...options
    };

    // Graph Data
    this.islands = [];
    this.islandMap = new Map();
    this.validEdges = [];
    this.edgeMap = new Map();
    this.bridgeState = new Map(); // key -> 0, 1, 2

    // History
    this.undoStack = [];
    this.redoStack = [];

    // Interaction State
    this.selectedIsland = null;
    this.hoveredIsland = null;
    this.hoveredEdge = null;
    this.dragStartIsland = null;
    this.isDragging = false;

    // Telemetry
    this.movesCount = 0;
    this.mistakesCount = 0;
    this.undosCount = 0;

    // Callbacks
    this.onMove = options.onMove || options.onStateChange || (() => {});
    this.onMistake = options.onMistake || (() => {});
    this.onSolved = options.onSolved || (() => {});
    this.onProgressUpdate = options.onProgressUpdate || options.onStateChange || (() => {});

    if (this.puzzle && this.container) {
      this.loadPuzzle(this.puzzle, this.container);
    }
  }

  loadPuzzle(puzzle, containerEl) {
    this.puzzle = puzzle;
    this.container = containerEl;
    this.islands = puzzle.islands || [];
    this.islandMap.clear();
    this.islands.forEach(isl => this.islandMap.set(isl.id, isl));

    this.bridgeState.clear();
    this.undoStack = [];
    this.redoStack = [];
    this.selectedIsland = null;
    this.hoveredIsland = null;
    this.hoveredEdge = null;
    this.dragStartIsland = null;
    this.isDragging = false;
    this.movesCount = 0;
    this.mistakesCount = 0;
    this.undosCount = 0;

    this.calculateValidEdges();
    this.render();
  }

  // Precompute orthogonal line-of-sight neighbors and crossings
  calculateValidEdges() {
    this.validEdges = [];
    this.edgeMap.clear();

    const islands = this.islands;
    const n = islands.length;

    for (let i = 0; i < n; i++) {
      const u = islands[i];

      // 1. Rightward neighbor
      let closestRight = null;
      for (let j = 0; j < n; j++) {
        const v = islands[j];
        if (v.r === u.r && v.c > u.c) {
          if (!closestRight || v.c < closestRight.c) {
            closestRight = v;
          }
        }
      }

      if (closestRight) {
        const key = `${Math.min(u.id, closestRight.id)}-${Math.max(u.id, closestRight.id)}`;
        if (!this.edgeMap.has(key)) {
          const edge = {
            key,
            u: Math.min(u.id, closestRight.id),
            v: Math.max(u.id, closestRight.id),
            isHorizontal: true,
            uIsl: u.id < closestRight.id ? u : closestRight,
            vIsl: u.id < closestRight.id ? closestRight : u,
            crossesWith: []
          };
          this.validEdges.push(edge);
          this.edgeMap.set(key, edge);
        }
      }

      // 2. Downward neighbor
      let closestDown = null;
      for (let j = 0; j < n; j++) {
        const v = islands[j];
        if (v.c === u.c && v.r > u.r) {
          if (!closestDown || v.r < closestDown.r) {
            closestDown = v;
          }
        }
      }

      if (closestDown) {
        const key = `${Math.min(u.id, closestDown.id)}-${Math.max(u.id, closestDown.id)}`;
        if (!this.edgeMap.has(key)) {
          const edge = {
            key,
            u: Math.min(u.id, closestDown.id),
            v: Math.max(u.id, closestDown.id),
            isHorizontal: false,
            uIsl: u.id < closestDown.id ? u : closestDown,
            vIsl: u.id < closestDown.id ? closestDown : u,
            crossesWith: []
          };
          this.validEdges.push(edge);
          this.edgeMap.set(key, edge);
        }
      }
    }

    // Precalculate crossing pairs
    for (let i = 0; i < this.validEdges.length; i++) {
      for (let j = i + 1; j < this.validEdges.length; j++) {
        const e1 = this.validEdges[i];
        const e2 = this.validEdges[j];

        if (e1.isHorizontal && !e2.isHorizontal) {
          const minC1 = Math.min(e1.uIsl.c, e1.vIsl.c), maxC1 = Math.max(e1.uIsl.c, e1.vIsl.c);
          const minR2 = Math.min(e2.uIsl.r, e2.vIsl.r), maxR2 = Math.max(e2.uIsl.r, e2.vIsl.r);
          if (minC1 < e2.uIsl.c && e2.uIsl.c < maxC1 && minR2 < e1.uIsl.r && e1.uIsl.r < maxR2) {
            e1.crossesWith.push(e2.key);
            e2.crossesWith.push(e1.key);
          }
        } else if (!e1.isHorizontal && e2.isHorizontal) {
          const minR1 = Math.min(e1.uIsl.r, e1.vIsl.r), maxR1 = Math.max(e1.uIsl.r, e1.vIsl.r);
          const minC2 = Math.min(e2.uIsl.c, e2.vIsl.c), maxC2 = Math.max(e2.uIsl.c, e2.vIsl.c);
          if (minR1 < e2.uIsl.r && e2.uIsl.r < maxR1 && minC2 < e1.uIsl.c && e1.uIsl.c < maxC2) {
            e1.crossesWith.push(e2.key);
            e2.crossesWith.push(e1.key);
          }
        }
      }
    }
  }

  getEdgeBetween(uId, vId) {
    const key = `${Math.min(uId, vId)}-${Math.max(uId, vId)}`;
    return this.edgeMap.get(key) || null;
  }

  getBridgeCount(key) {
    return this.bridgeState.get(key) || 0;
  }

  getIslandDegree(islandId) {
    let count = 0;
    for (const [key, cnt] of this.bridgeState.entries()) {
      if (cnt > 0) {
        const edge = this.edgeMap.get(key);
        if (edge && (edge.u === islandId || edge.v === islandId)) {
          count += cnt;
        }
      }
    }
    return count;
  }

  cycleBridge(uId, vId, delta = 1) {
    if (this.options.readOnly) return false;

    const edge = this.getEdgeBetween(uId, vId);
    if (!edge) {
      if (window.soundManager) window.soundManager.playError();
      return false;
    }

    const current = this.getBridgeCount(edge.key);
    let next;
    if (delta > 0) {
      next = (current + 1) % 3;
    } else {
      next = current > 0 ? current - 1 : 0;
    }

    return this.setBridgeCount(edge.key, next);
  }

  setBridgeCount(key, nextCount, recordHistory = true) {
    const edge = this.edgeMap.get(key);
    if (!edge) return false;

    const currentCount = this.getBridgeCount(key);
    if (currentCount === nextCount) return true;

    // Check crossing collision
    if (nextCount > 0) {
      for (const crossKey of edge.crossesWith) {
        if (this.getBridgeCount(crossKey) > 0) {
          this.mistakesCount++;
          if (window.soundManager) window.soundManager.playError();
          this.flashCrossingConflict(key, crossKey);
          this.onMistake({
            type: 'CROSSING_ERROR',
            message: 'Bridges cannot cross existing bridges.'
          });
          return false;
        }
      }
    }

    if (recordHistory) {
      this.undoStack.push({ key, prev: currentCount, next: nextCount });
      this.redoStack = [];
      this.movesCount++;
    }

    if (nextCount === 0) {
      this.bridgeState.delete(key);
      if (window.soundManager) window.soundManager.playBridgeRemove();
    } else {
      this.bridgeState.set(key, nextCount);
      if (window.soundManager) window.soundManager.playBridgeAdd(nextCount);
    }

    const uDeg = this.getIslandDegree(edge.u);
    const vDeg = this.getIslandDegree(edge.v);
    const uReq = this.islandMap.get(edge.u).number;
    const vReq = this.islandMap.get(edge.v).number;

    if (uDeg > uReq || vDeg > vReq) {
      this.mistakesCount++;
      this.onMistake({
        type: 'DEGREE_OVERFLOW',
        message: 'Island degree exceeds target count.'
      });
    }

    this.updateVisualState();
    this.checkCompletion();
    return true;
  }

  undo() {
    if (this.undoStack.length === 0 || this.options.readOnly) return false;
    const item = this.undoStack.pop();
    this.redoStack.push(item);
    this.undosCount++;

    if (item.prev === 0) {
      this.bridgeState.delete(item.key);
    } else {
      this.bridgeState.set(item.key, item.prev);
    }

    if (window.soundManager) window.soundManager.playBridgeRemove();
    this.updateVisualState();
    this.checkCompletion();
    return true;
  }

  redo() {
    if (this.redoStack.length === 0 || this.options.readOnly) return false;
    const item = this.redoStack.pop();
    this.undoStack.push(item);

    if (item.next === 0) {
      this.bridgeState.delete(item.key);
    } else {
      this.bridgeState.set(item.key, item.next);
    }

    if (window.soundManager) window.soundManager.playBridgeAdd(item.next);
    this.updateVisualState();
    this.checkCompletion();
    return true;
  }

  reset() {
    if (this.options.readOnly) return;
    this.bridgeState.clear();
    this.undoStack = [];
    this.redoStack = [];
    this.selectedIsland = null;
    this.updateVisualState();
    if (window.soundManager) window.soundManager.playBridgeRemove();
  }

  flashCrossingConflict(key1, key2) {
    const el2 = this.container.querySelector(`.bridge-path[data-key="${key2}"]`);
    if (el2) {
      el2.classList.add('bridge-conflict-pulse');
      setTimeout(() => el2.classList.remove('bridge-conflict-pulse'), 400);
    }
  }

  evaluateState() {
    let completedCount = 0;
    let overflowCount = 0;
    let underCount = 0;

    for (const isl of this.islands) {
      const deg = this.getIslandDegree(isl.id);
      if (deg === isl.number) {
        completedCount++;
      } else if (deg > isl.number) {
        overflowCount++;
      } else {
        underCount++;
      }
    }

    // Connected components check via BFS
    const visited = new Set();
    let isFullyConnected = false;

    if (this.islands.length > 0) {
      const adj = new Map();
      this.islands.forEach(i => adj.set(i.id, []));

      for (const [key, count] of this.bridgeState.entries()) {
        if (count > 0) {
          const edge = this.edgeMap.get(key);
          if (edge) {
            adj.get(edge.u).push(edge.v);
            adj.get(edge.v).push(edge.u);
          }
        }
      }

      const start = this.islands[0].id;
      const q = [start];
      visited.add(start);

      while (q.length > 0) {
        const curr = q.shift();
        for (const nxt of adj.get(curr)) {
          if (!visited.has(nxt)) {
            visited.add(nxt);
            q.push(nxt);
          }
        }
      }

      isFullyConnected = visited.size === this.islands.length;
    }

    const isSolved = (completedCount === this.islands.length) && isFullyConnected;

    return {
      completedCount,
      satisfiedCount: completedCount,
      totalCount: this.islands.length,
      overflowCount,
      underCount,
      totalIslands: this.islands.length,
      isFullyConnected,
      connectedIslandsCount: visited.size,
      isSolved
    };
  }

  getStats() {
    const state = this.evaluateState();
    let bridgesCount = 0;
    for (const count of this.bridgeState.values()) {
      bridgesCount += count;
    }
    return {
      satisfied: state.completedCount,
      completed: state.completedCount,
      total: this.islands.length,
      bridgesCount,
      isFullyConnected: state.isFullyConnected,
      isSolved: state.isSolved
    };
  }

  exportBridges() {
    return this.serializeSolution();
  }

  checkCompletion() {
    const state = this.evaluateState();
    this.onProgressUpdate(state);
    if (this.options.onStateChange) this.options.onStateChange(state);

    if (state.isSolved) {
      if (window.soundManager) window.soundManager.playVictory();
      this.onSolved(this.serializeSolution());
    }
  }

  serializeSolution() {
    const list = [];
    for (const [key, count] of this.bridgeState.entries()) {
      if (count > 0) {
        const edge = this.edgeMap.get(key);
        if (edge) {
          list.push({ u: edge.u, v: edge.v, count });
        }
      }
    }
    return list;
  }

  loadBridges(bridgeList) {
    if (!Array.isArray(bridgeList)) return;
    this.bridgeState.clear();
    for (const b of bridgeList) {
      if (!b || !b.count) continue;
      const key = `${Math.min(b.u, b.v)}-${Math.max(b.u, b.v)}`;
      if (this.edgeMap.has(key)) {
        this.bridgeState.set(key, b.count);
      }
    }
    this.updateVisualState();
    this.checkCompletion();
  }

  // Calculate connected components for group tinting
  getConnectedComponents() {
    const adj = new Map();
    this.islands.forEach(i => adj.set(i.id, []));

    for (const [key, count] of this.bridgeState.entries()) {
      if (count > 0) {
        const edge = this.edgeMap.get(key);
        if (edge) {
          adj.get(edge.u).push(edge.v);
          adj.get(edge.v).push(edge.u);
        }
      }
    }

    const visited = new Set();
    const components = [];

    for (const isl of this.islands) {
      if (!visited.has(isl.id)) {
        const comp = [];
        const q = [isl.id];
        visited.add(isl.id);
        while (q.length > 0) {
          const curr = q.shift();
          comp.push(curr);
          for (const nxt of adj.get(curr)) {
            if (!visited.has(nxt)) {
              visited.add(nxt);
              q.push(nxt);
            }
          }
        }
        components.push(comp);
      }
    }
    return components;
  }

  // ----------------------------------------------------
  // RENDERING & INTERACTION (Crisp Architectural SVG)
  // ----------------------------------------------------
  render() {
    if (!this.container || !this.puzzle) return;
    const { width, height } = this.puzzle;

    // Adaptive auto-fit cell sizing
    const rawW = this.container.clientWidth;
    const containerW = (rawW && rawW > 180) ? rawW : 620;
    const maxDimension = Math.max(width, height);
    const cellSize = this.options.cellSize || Math.max(46, Math.min(62, Math.floor((containerW - 60) / maxDimension)));

    const padding = this.options.padding || (cellSize * 0.72);
    const svgWidth = (width - 1) * cellSize + padding * 2;
    const svgHeight = (height - 1) * cellSize + padding * 2;

    this.cellSize = cellSize;
    this.padding = padding;

    this.container.innerHTML = `
      <div class="hashi-board-wrapper" style="position: relative; touch-action: none; width: 100%; display: flex; justify-content: center; padding: 0.5rem 0;">
        <svg class="hashi-svg-layer" viewBox="0 0 ${svgWidth} ${svgHeight}" style="width: 100%; height: auto; max-width: ${svgWidth}px; min-height: ${Math.min(svgHeight, 460)}px; display: block; shape-rendering: geometricPrecision; background: var(--board-bg, #0c0d12); border-radius: var(--radius-lg, 16px); border: 1px solid var(--border-subtle, rgba(255,255,255,0.08)); box-shadow: 0 4px 24px rgba(0,0,0,0.4);">
          <!-- Grid dots -->
          <g class="hashi-grid-dots"></g>

          <!-- Alignment & Line-of-sight Ray Guides -->
          <g class="hashi-guides"></g>

          <!-- Ghost hover preview bridge -->
          <g class="hashi-ghost-bridge"></g>

          <!-- Clickable Corridors -->
          <g class="hashi-corridors"></g>

          <!-- Rendered Solid Bridges -->
          <g class="hashi-bridges"></g>

          <!-- Dragging Drafting Preview -->
          <line id="drag-preview-line" class="drag-preview" x1="0" y1="0" x2="0" y2="0" style="display: none; stroke: var(--text-secondary); stroke-width: 2px; stroke-dasharray: 4 4; pointer-events: none;" />

          <!-- Islands -->
          <g class="hashi-islands"></g>
        </svg>
      </div>
    `;

    this.svg = this.container.querySelector('.hashi-svg-layer');

    this.renderGridDots(width, height);
    this.renderCorridors();
    this.renderIslands();
    this.updateVisualState();
    this.bindEvents();
  }

  getIslandCenter(isl) {
    return {
      x: this.padding + isl.c * this.cellSize,
      y: this.padding + isl.r * this.cellSize
    };
  }

  renderGridDots(w, h) {
    const g = this.svg.querySelector('.hashi-grid-dots');
    let dots = '';
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const x = this.padding + c * this.cellSize;
        const y = this.padding + r * this.cellSize;
        dots += `<circle cx="${x}" cy="${y}" r="1.5" fill="var(--grid-dot-color)" />`;
      }
    }
    g.innerHTML = dots;
  }

  renderCorridors() {
    const g = this.svg.querySelector('.hashi-corridors');
    let html = '';

    for (const edge of this.validEdges) {
      const uCenter = this.getIslandCenter(edge.uIsl);
      const vCenter = this.getIslandCenter(edge.vIsl);

      html += `
        <line
          class="corridor-hitbox"
          data-key="${edge.key}"
          x1="${uCenter.x}" y1="${uCenter.y}"
          x2="${vCenter.x}" y2="${vCenter.y}"
          stroke="transparent"
          stroke-width="34"
          cursor="pointer"
        />
      `;
    }

    g.innerHTML = html;
  }

  renderIslands() {
    const g = this.svg.querySelector('.hashi-islands');
    let html = '';
    const radius = Math.min(24, Math.max(16, this.cellSize * 0.36));
    this.islandRadius = radius;

    for (const isl of this.islands) {
      const center = this.getIslandCenter(isl);
      html += `
        <g class="island-group" data-id="${isl.id}" transform="translate(${center.x}, ${center.y})" cursor="pointer">
          <!-- Selection Rim -->
          <circle class="island-ring" r="${radius + 4}" fill="none" stroke="transparent" stroke-width="1.5" stroke-dasharray="3 3" />

          <!-- Main Island Body -->
          <circle class="island-body" r="${radius}" fill="var(--island-bg)" stroke="var(--island-border)" stroke-width="1.5" />

          <!-- Numerals -->
          <text class="island-num" y="0.5" text-anchor="middle" dominant-baseline="central" font-family="var(--font-sans)" font-weight="600" font-size="${radius * 1.05}px" fill="var(--island-text)">${isl.number}</text>

          <!-- Degree Status Sub-Indicator Dot -->
          <circle class="degree-badge" cx="${radius * 0.72}" cy="-${radius * 0.72}" r="3.5" fill="var(--island-satisfied-border, #10b981)" stroke="var(--board-bg, #0f121a)" stroke-width="1.5" style="display: none;" />
        </g>
      `;
    }

    g.innerHTML = html;
  }

  updateVisualState() {
    // 1. Render Solid Bridges
    const bridgeGroup = this.svg.querySelector('.hashi-bridges');
    let bridgeHtml = '';

    for (const edge of this.validEdges) {
      const count = this.getBridgeCount(edge.key);
      if (count === 0) continue;

      const uCenter = this.getIslandCenter(edge.uIsl);
      const vCenter = this.getIslandCenter(edge.vIsl);
      const offset = 4;

      if (count === 1) {
        bridgeHtml += `
          <g class="bridge-path" data-key="${edge.key}">
            <line class="bridge-core single" x1="${uCenter.x}" y1="${uCenter.y}" x2="${vCenter.x}" y2="${vCenter.y}" stroke="var(--bridge-color)" stroke-width="2.5" stroke-linecap="round" />
          </g>
        `;
      } else if (count === 2) {
        if (edge.isHorizontal) {
          bridgeHtml += `
            <g class="bridge-path double" data-key="${edge.key}">
              <line class="bridge-core" x1="${uCenter.x}" y1="${uCenter.y - offset}" x2="${vCenter.x}" y2="${vCenter.y - offset}" stroke="var(--bridge-color)" stroke-width="2" stroke-linecap="round" />
              <line class="bridge-core" x1="${uCenter.x}" y1="${uCenter.y + offset}" x2="${vCenter.x}" y2="${vCenter.y + offset}" stroke="var(--bridge-color)" stroke-width="2" stroke-linecap="round" />
            </g>
          `;
        } else {
          bridgeHtml += `
            <g class="bridge-path double" data-key="${edge.key}">
              <line class="bridge-core" x1="${uCenter.x - offset}" y1="${uCenter.y}" x2="${vCenter.x - offset}" y2="${vCenter.y}" stroke="var(--bridge-color)" stroke-width="2" stroke-linecap="round" />
              <line class="bridge-core" x1="${uCenter.x + offset}" y1="${uCenter.y}" x2="${vCenter.x + offset}" y2="${vCenter.y}" stroke="var(--bridge-color)" stroke-width="2" stroke-linecap="round" />
            </g>
          `;
        }
      }
    }
    bridgeGroup.innerHTML = bridgeHtml;

    // 2. Render Line-of-sight Guides (when an island is hovered or selected)
    this.renderGuides();

    // 3. Render Ghost Hover Preview
    this.renderGhostBridge();

    // 4. Update Island States
    const activeTarget = this.selectedIsland || this.hoveredIsland;

    for (const isl of this.islands) {
      const g = this.svg.querySelector(`.island-group[data-id="${isl.id}"]`);
      if (!g) continue;

      const body = g.querySelector('.island-body');
      const ring = g.querySelector('.island-ring');
      const text = g.querySelector('.island-num');
      const badge = g.querySelector('.degree-badge');

      const deg = this.getIslandDegree(isl.id);
      const isSelected = this.selectedIsland && this.selectedIsland.id === isl.id;
      const isNeighbor = activeTarget && this.getEdgeBetween(activeTarget.id, isl.id);

      // Selection & Neighbor Rim
      if (isSelected) {
        ring.setAttribute('stroke', 'var(--text-primary)');
        ring.setAttribute('stroke-width', '2');
      } else if (isNeighbor) {
        ring.setAttribute('stroke', 'var(--border-subtle)');
        ring.setAttribute('stroke-width', '1.5');
      } else {
        ring.setAttribute('stroke', 'transparent');
      }

      // Degree satisfaction states: Clean, Vibrant Emerald Green UI
      g.classList.remove('satisfied', 'overflow', 'unsatisfied');

      if (deg === isl.number) {
        g.classList.add('satisfied');
        body.setAttribute('fill', 'var(--island-satisfied-bg)');
        body.setAttribute('stroke', 'var(--island-satisfied-border, #10b981)');
        body.setAttribute('stroke-width', '2.5');
        body.style.filter = 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.55))';
        text.setAttribute('fill', 'var(--island-satisfied-text, #34d399)');
        text.style.fontWeight = '700';
        if (badge) {
          badge.setAttribute('fill', 'var(--island-satisfied-border, #10b981)');
          badge.style.display = 'block';
        }
      } else if (deg > isl.number) {
        g.classList.add('overflow');
        body.setAttribute('fill', 'var(--island-overflow-bg)');
        body.setAttribute('stroke', 'var(--island-overflow-border, #ef4444)');
        body.setAttribute('stroke-width', '2.5');
        body.style.filter = 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.55))';
        text.setAttribute('fill', 'var(--island-overflow-text, #f87171)');
        text.style.fontWeight = '700';
        if (badge) badge.style.display = 'none';
      } else {
        g.classList.add('unsatisfied');
        body.setAttribute('fill', 'var(--island-bg)');
        body.setAttribute('stroke', 'var(--island-border)');
        body.setAttribute('stroke-width', '1.5');
        body.style.filter = 'none';
        text.setAttribute('fill', 'var(--island-text)');
        text.style.fontWeight = '600';
        if (badge) badge.style.display = 'none';
      }
    }
  }

  // Draw faint dashed rays connecting connectable neighbors
  renderGuides() {
    const g = this.svg.querySelector('.hashi-guides');
    const target = this.selectedIsland || this.hoveredIsland;
    if (!target || !this.options.showGuides) {
      g.innerHTML = '';
      return;
    }

    let guidesHtml = '';
    const uCenter = this.getIslandCenter(target);

    for (const edge of this.validEdges) {
      if (edge.u === target.id || edge.v === target.id) {
        const otherId = edge.u === target.id ? edge.v : edge.u;
        const otherIsl = this.islandMap.get(otherId);
        const vCenter = this.getIslandCenter(otherIsl);

        // Only show if not fully blocked by 2 bridges
        const currentCount = this.getBridgeCount(edge.key);
        if (currentCount < 2) {
          guidesHtml += `
            <line
              x1="${uCenter.x}" y1="${uCenter.y}"
              x2="${vCenter.x}" y2="${vCenter.y}"
              stroke="var(--border-subtle)"
              stroke-width="1.5"
              stroke-dasharray="2 4"
              pointer-events="none"
            />
          `;
        }
      }
    }
    g.innerHTML = guidesHtml;
  }

  // Draw faint preview line on hovered corridor
  renderGhostBridge() {
    const g = this.svg.querySelector('.hashi-ghost-bridge');
    if (!this.hoveredEdge) {
      g.innerHTML = '';
      return;
    }

    const currentCount = this.getBridgeCount(this.hoveredEdge.key);
    if (currentCount === 2) {
      g.innerHTML = '';
      return;
    }

    const uCenter = this.getIslandCenter(this.hoveredEdge.uIsl);
    const vCenter = this.getIslandCenter(this.hoveredEdge.vIsl);

    g.innerHTML = `
      <line
        x1="${uCenter.x}" y1="${uCenter.y}"
        x2="${vCenter.x}" y2="${vCenter.y}"
        stroke="var(--text-tertiary)"
        stroke-width="2"
        stroke-dasharray="3 3"
        stroke-linecap="round"
        opacity="0.45"
        pointer-events="none"
      />
    `;
  }

  // Bind mouse, pointer, touch, and keyboard interactions
  bindEvents() {
    const svg = this.svg;

    // 1. Island Interactions
    const islandGroups = svg.querySelectorAll('.island-group');
    islandGroups.forEach(g => {
      const id = parseInt(g.getAttribute('data-id'), 10);
      const isl = this.islandMap.get(id);

      // Hover
      g.addEventListener('pointerenter', () => {
        this.hoveredIsland = isl;
        this.updateVisualState();
      });

      g.addEventListener('pointerleave', () => {
        this.hoveredIsland = null;
        this.updateVisualState();
      });

      // Pointer Down
      g.addEventListener('pointerdown', (e) => {
        if (this.options.readOnly || e.button !== 0) return;
        this.dragStartIsland = isl;
        this.isDragging = false;
        const pt = this.getSVGPoint(e);

        const startCenter = this.getIslandCenter(isl);
        const preview = svg.querySelector('#drag-preview-line');
        preview.setAttribute('x1', startCenter.x);
        preview.setAttribute('y1', startCenter.y);
        preview.setAttribute('x2', startCenter.x);
        preview.setAttribute('y2', startCenter.y);
      });

      // Pointer Up
      g.addEventListener('pointerup', (e) => {
        if (this.options.readOnly) return;
        const preview = svg.querySelector('#drag-preview-line');
        preview.style.display = 'none';

        if (this.dragStartIsland && this.dragStartIsland.id !== isl.id) {
          // Finished drag
          this.cycleBridge(this.dragStartIsland.id, isl.id, 1);
          this.dragStartIsland = null;
          this.selectedIsland = null;
          this.updateVisualState();
          return;
        }

        // Click on island
        if (this.selectedIsland === null) {
          this.selectedIsland = isl;
          if (window.soundManager) window.soundManager.playIslandSelect();
        } else if (this.selectedIsland.id === isl.id) {
          this.selectedIsland = null;
        } else {
          this.cycleBridge(this.selectedIsland.id, isl.id, 1);
          this.selectedIsland = null;
        }
        this.dragStartIsland = null;
        this.updateVisualState();
      });

      // Right Click
      g.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (this.options.readOnly) return;
        if (this.selectedIsland && this.selectedIsland.id !== isl.id) {
          this.cycleBridge(this.selectedIsland.id, isl.id, -1);
          this.selectedIsland = null;
          this.updateVisualState();
        }
      });
    });

    // 2. Direct Corridor Hitbox Clicks & Hover
    const corridorHitboxes = svg.querySelectorAll('.corridor-hitbox');
    corridorHitboxes.forEach(box => {
      const key = box.getAttribute('data-key');
      const edge = this.edgeMap.get(key);

      box.addEventListener('pointerenter', () => {
        this.hoveredEdge = edge;
        this.renderGhostBridge();
      });

      box.addEventListener('pointerleave', () => {
        this.hoveredEdge = null;
        this.renderGhostBridge();
      });

      box.addEventListener('pointerdown', (e) => {
        if (this.options.readOnly) return;
        e.stopPropagation();
        if (e.button === 0) {
          this.cycleBridge(edge.u, edge.v, 1);
        } else if (e.button === 2) {
          this.cycleBridge(edge.u, edge.v, -1);
        }
        this.selectedIsland = null;
        this.updateVisualState();
      });

      box.addEventListener('contextmenu', (e) => {
        e.preventDefault();
      });
    });

    // 3. Pointer Move for Drag Preview Line
    svg.addEventListener('pointermove', (e) => {
      if (!this.dragStartIsland || this.options.readOnly) return;
      this.isDragging = true;
      const pt = this.getSVGPoint(e);
      const preview = svg.querySelector('#drag-preview-line');
      preview.style.display = 'block';

      // Magnetic snap to nearby neighbor island
      let snapCenter = null;
      for (const edge of this.validEdges) {
        if (edge.u === this.dragStartIsland.id || edge.v === this.dragStartIsland.id) {
          const otherId = edge.u === this.dragStartIsland.id ? edge.v : edge.u;
          const otherIsl = this.islandMap.get(otherId);
          const otherCenter = this.getIslandCenter(otherIsl);
          const dist = Math.hypot(pt.x - otherCenter.x, pt.y - otherCenter.y);
          if (dist < this.cellSize * 0.45) {
            snapCenter = otherCenter;
            break;
          }
        }
      }

      if (snapCenter) {
        preview.setAttribute('x2', snapCenter.x);
        preview.setAttribute('y2', snapCenter.y);
        preview.setAttribute('stroke', 'var(--text-primary)');
        preview.setAttribute('stroke-width', '2.5px');
      } else {
        preview.setAttribute('x2', pt.x);
        preview.setAttribute('y2', pt.y);
        preview.setAttribute('stroke', 'var(--text-tertiary)');
        preview.setAttribute('stroke-width', '1.5px');
      }
    });

    // 4. Pointer Cancel
    window.addEventListener('pointerup', () => {
      if (this.dragStartIsland) {
        const preview = svg.querySelector('#drag-preview-line');
        if (preview) preview.style.display = 'none';
        this.dragStartIsland = null;
        this.updateVisualState();
      }
    });

    // 5. Global Keyboard Shortcuts (Z: undo, Y: redo, Esc: deselect, Space: check)
    window.addEventListener('keydown', (e) => {
      // Don't trigger if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) this.redo();
        else this.undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        this.redo();
      } else if (e.key.toLowerCase() === 'u' || e.key.toLowerCase() === 'z') {
        this.undo();
      } else if (e.key.toLowerCase() === 'y') {
        this.redo();
      } else if (e.key === 'Escape') {
        this.selectedIsland = null;
        this.updateVisualState();
      } else if (e.code === 'Space') {
        e.preventDefault();
        document.getElementById('btn-check')?.click();
      }
    });
  }

  getSVGPoint(event) {
    const pt = this.svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    return pt.matrixTransform(this.svg.getScreenCTM().inverse());
  }
}

window.BridgesEngine = BridgesEngine;
