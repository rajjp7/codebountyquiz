# Hashi Bridges • Cohort Quiz & Competition Platform

An interactive **Hashiwokakero (Bridges)** quiz platform built for classrooms and competitive coding batches, inspired by [puzzle-bridges.com](https://www.puzzle-bridges.com/). Designed specifically for **30-student cohorts (Batch A, Batch B, etc.)** to participate simultaneously, store telemetry into a persistent dataset, and track real-time timings and live leaderboards.

---

## 🌟 Key Features

### 1. Faithful Bridges (Hashi) Game Mechanics
- **Orthogonal Bridges**: Single (1 line) or Double (2 parallel lines) connections between islands.
- **Crossing Prevention**: Strictly blocks illegal bridge crossings and provides instant visual and acoustic error feedback.
- **Multiple Input Methods**:
  - **Click & Drag**: Drag a line directly between two islands in line of sight.
  - **Click-to-Click**: Click island A, then click island B to connect.
  - **Direct Path Click**: Click anywhere on the corridor between two islands to cycle bridges (0 ➔ 1 ➔ 2 ➔ 0).
  - **Right-Click**: Decrement or remove bridges.
- **Auto Status & Degree Feedback**:
  - Islands turn **Emerald Green** with a checkmark ring when their target bridge count is reached.
  - Islands turn **Crimson Red** with a shake animation when overconnected.
  - Remaining needed bridges are calculated in real time.
- **Connectivity Validation**: BFS algorithm verifies that all islands form a single connected graph (no isolated networks).
- **Undo / Redo / Reset**: Supports keyboard shortcuts (`Ctrl+Z`, `Ctrl+Y`).
- **Web Audio FX**: Synthesizes custom interactive audio for island clicks, bridge connections, errors, and celebratory victory fanfares.

### 2. Multi-Track Championship: Track 1 & 2nd Track
- **Track 1: Hashi Classic Circuit**: Single-puzzle speed challenge for cohort testing on pure Hashiwokakero boards.
- **2nd Track: Codestars Tri-Challenge**: Tri-stage multi-disciplinary championship:
  1. **Hashi 10*10 HARD**: Official size 52 specifications ([puzzle-bridges.com/?size=52](https://www.puzzle-bridges.com/?size=52)) with 18 islands and strict connectivity rules.
  2. **WHO IS THE DEEPFAKE? (Codestars Non-Tech Brain Teaser)**:
     - 5 short videos (A, B, C, D, E) with claim pairings.
     - Deepfake contains 2 false claims; genuine videos contain exactly 1 false claim.
     - Recovered evidence and AI fact-check analysis with warning of 1 incorrect conclusion.
     - Interactive Deepfake selector + 5-video upload order timeline builder (`B -> A -> C -> E -> D`).
  3. **ZERO TO CRORE (Alphametic Logic Puzzle)**:
     - Cryptarithm: `RAJA + ZERO = CRORE` and `GANGA + ZERO = SAREE`.
     - 10 distinct letters mapped to unique digits 0–9.
     - Interactive digit keypad with live arithmetic balance verification.
     - SAREE numerical value calculation (75288), division by 6 (12548), and final decoded English word (**CRANE**).
     - 5 expandable strategic hints.

### 3. 30-Student Cohort Quiz System
- **Batch Management**: Pre-configured for **Batch A (30 students)**, **Batch B (30 students)**, and custom batches.
- **Student Registration**: Students join by entering their Name, Student ID / Roll Number, and selecting their Batch.
- **Live Stopwatch**: Millisecond-accurate precision stopwatch measuring total solve duration.
- **Quiz Integrity Monitoring**: Automatically tracks window focus and tab switches (`visibilitychange`).
- **Real-Time Telemetry**: Tracks moves count, mistake count, undo count, and island completion percentage.
- **Server Verification**: Dual-layer verification (instant client feedback + strict server-side graph validation).

### 3. Live Leaderboard & Podiums
- **Top 3 Podium**: Animated Gold (🥇), Silver (🥈), and Bronze (🥉) podium cards with student avatars, solve times, and scores.
- **Cohort Filter**: Toggle between Batch A (30 students), Batch B (30 students), and All Cohorts.
- **Live Stream Mode**: 3-second auto-refresh polling with live indicator.
- **Ranking Metrics**: Ranked by completion status first, fastest completion time second, and fewest mistakes third.

### 4. Cohort Dataset & Analytics Center
- **Key Metrics (KPIs)**:
  - Total Enrolled Students
  - Completion Rate (%)
  - Average Solve Time (formatted `mm:ss.s`)
  - Fastest Record Time
- **Export Options**:
  - **Export as CSV**: Generates a spreadsheet-compatible `.csv` file.
  - **Export as JSON**: Generates complete `.json` dataset records.
- **1-Click Cohort Seeding**: Built-in buttons to seed 30 sample students for Batch A and Batch B with realistic varied timings.
- **Search & Filter**: Search students by name or roll number with real-time table updates.

### 5. Teacher / Room Administration
- **Contest Puzzle Selection**: Switch competition puzzle across presets:
  - 7x7 Classic Warmup (8-10 islands)
  - 7x7 Speed Challenge (10-12 islands)
  - 9x9 Standard Tournament (14-16 islands)
  - 10x10 Championship (18-20 islands)
  - 12x12 Grand Master (24-26 islands)
- **Time Limits**: Set 5-minute speed runs, 10-minute standard, or unlimited modes.

---

## 🚀 Quick Start Guide

### 1. Start the Server
```bash
npm start
```
The server will run at:
**[http://localhost:3000](http://localhost:3000)**

### 2. Re-seed 30-30 Student Cohorts (Optional)
To populate 30 students in Batch A and 30 students in Batch B:
```bash
npm run seed
```

---

## 📂 Project Structure

```
codebountyquiz/
├── package.json               # Scripts and dependencies
├── server.js                  # Express backend, graph validator, dataset & CSV APIs
├── scripts/
│   ├── generate_puzzles.js    # Procedural Hashi puzzle generator
│   └── seed_cohorts.js        # 30-student cohort seeder utility
├── data/
│   ├── puzzles.json           # Curated competition puzzle bank
│   ├── room_config.json       # Active room settings
│   └── dataset.json           # Persistent student quiz attempts dataset
└── public/
    ├── index.html             # Single-page application container
    ├── css/
    │   ├── style.css          # Design system, dark/light theme, glassmorphism
    │   └── animations.css     # Glowing pulses, conflicts, and victory confetti
    └── js/
        ├── audio.js           # Web Audio API sound synthesizers
        ├── bridges-engine.js  # Interactive Hashi game engine & SVG renderer
        ├── student-quiz.js    # Student quiz taker, stopwatch, submit workflow
        ├── leaderboard.js     # Live leaderboard, podiums, auto-refresh
        ├── dataset-view.js    # Dataset analytics table, CSV/JSON exporter
        ├── admin-controls.js  # Teacher room controller
        └── app.js             # Main navigation & toast manager
```

---

## 📊 Dataset Schema

Each student attempt in `data/dataset.json` contains:
| Field | Type | Description |
|---|---|---|
| `id` | String | Unique attempt identifier |
| `batch` | String | Cohort name (e.g. `Batch A`, `Batch B`) |
| `student_id` | String | Roll number / Student ID (e.g. `BATCHA-001`) |
| `student_name` | String | Student's full name |
| `puzzle_name` | String | Contest puzzle name (e.g. `7x7 Classic Warmup`) |
| `status` | String | `COMPLETED`, `IN_PROGRESS`, or `FAILED` |
| `duration_seconds` | Number | Exact time taken (e.g. `114.2`) |
| `formatted_time` | String | Human readable time (`01:54.2`) |
| `moves_count` | Number | Total bridge placement moves |
| `mistakes_count` | Number | Degree overflows or illegal bridge attempts |
| `undos_count` | Number | Number of undos performed |
| `tab_switches` | Number | Focus loss / tab blurs for exam integrity |
| `score` | Number | Calculated points based on speed and accuracy |
| `start_time` | String | ISO timestamp of quiz start |
| `finish_time` | String | ISO timestamp of final submission |
| `bridges` | Array | Full submitted bridges configuration |
