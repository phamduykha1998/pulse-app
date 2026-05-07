/* ═══════════════════════════════════════════════════════════════════
   PULSE — Personal OS / logic.js
   ═══════════════════════════════════════════════════════════════════
   STRUCTURE:
   1. CONFIG       — pillars, default targets
   2. STORAGE      — localStorage CRUD + JSON export/import
   3. UTILS        — date helpers, time conversion
   4. STATE        — current view state
   5. CORRELATION  — Tier 1-3 logic engine (single, vs target, pair)
   6. RENDER       — input form, daily/weekly/monthly views
   7. EVENTS       — wire up UI interactions
   8. INIT         — bootstrap
   ═══════════════════════════════════════════════════════════════════ */


/* ─────────── 1. CONFIG ─────────── */

const PILLARS = [
  { key: 'main_job',   label: 'Main Job',    icon: '◆', color: '#00E5FF' },
  { key: 'second_job', label: 'Second Job',  icon: '◇', color: '#B388FF' },
  { key: 'use_phone',  label: 'Phone Use',   icon: '▤', color: '#FF5252', negative: true },
  { key: 'investment', label: 'Investment',  icon: '↗', color: '#FFB300' },
  { key: 'exercise',   label: 'Exercise',    icon: '▲', color: '#00E676' },
  { key: 'sleep',      label: 'Sleep',       icon: '☾', color: '#4DD0E1' }
];

const DEFAULT_TARGETS = {
  main_job: 8,
  second_job: 2,
  use_phone: 2,    // negative target (max allowed)
  investment: 1,
  exercise: 1.5,
  sleep: 8
};

/* ─────────── 2. STORAGE — Incremental Architecture ─────────── */
/* 
   Strategy:
   - current_state.json  → loaded at startup (fast)
   - daily/{YYYY-MM-DD}.json → 7 days recent (lazy load older)
   - monthly/{YYYY-MM}.json → aggregated (30d+ compress)
   - UPSERT logic → no duplicates
*/

const STORE_PREFIX = 'pulse_';

function getStorageKey(type, id) {
  return STORE_PREFIX + type + '_' + id;
}

function loadCurrentState() {
  try {
    const raw = localStorage.getItem(getStorageKey('state', 'current'));
    if (!raw) {
      return {
        targets: { ...DEFAULT_TARGETS },
        lastSync: ds(new Date()),
        version: 1
      };
    }
    return JSON.parse(raw);
  } catch (e) {
    return { targets: { ...DEFAULT_TARGETS }, lastSync: ds(new Date()), version: 1 };
  }
}

function loadDailyLog(dateStr) {
  try {
    const raw = localStorage.getItem(getStorageKey('daily', dateStr));
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveDailyLog(dateStr, log) {
  try {
    localStorage.setItem(getStorageKey('daily', dateStr), JSON.stringify(log));
    const state = loadCurrentState();
    state.lastSync = ds(new Date());
    localStorage.setItem(getStorageKey('state', 'current'), JSON.stringify(state));
  } catch (e) {
    console.error('Save daily error', e);
  }
}

function loadMonthlyAggregate(yearMonth) {
  try {
    const raw = localStorage.getItem(getStorageKey('monthly', yearMonth));
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveMonthlyAggregate(yearMonth, agg) {
  try {
    localStorage.setItem(getStorageKey('monthly', yearMonth), JSON.stringify(agg));
  } catch (e) {
    console.error('Save monthly error', e);
  }
}

function loadTargets() {
  const state = loadCurrentState();
  return state.targets || { ...DEFAULT_TARGETS };
}

function saveTargets(targets) {
  const state = loadCurrentState();
  state.targets = targets;
  state.lastSync = ds(new Date());
  localStorage.setItem(getStorageKey('state', 'current'), JSON.stringify(state));
}

function getAllStorageKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(STORE_PREFIX)) keys.push(key);
  }
  return keys;
}

function getStorageSize() {
  let size = 0;
  getAllStorageKeys().forEach(k => {
    const v = localStorage.getItem(k);
    size += v.length;
  });
  return (size / 1024).toFixed(2) + ' KB';
}

function exportJSON() {
  const state = loadCurrentState();
  const dailies = {};
  const monthlies = {};
  
  getAllStorageKeys().forEach(k => {
    const v = localStorage.getItem(k);
    if (k.includes('_daily_')) {
      const date = k.replace(STORE_PREFIX + 'daily_', '');
      dailies[date] = JSON.parse(v);
    } else if (k.includes('_monthly_')) {
      const ym = k.replace(STORE_PREFIX + 'monthly_', '');
      monthlies[ym] = JSON.parse(v);
    }
  });

  const exportData = {
    timestamp: new Date().toISOString(),
    storageSize: getStorageSize(),
    currentState: state,
    dailyLogs: dailies,
    monthlyAggregates: monthlies
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pulse_export_${ds(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Exported ✓');
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.currentState) throw new Error('Invalid format');

      // UPSERT: merge without duplicate
      if (data.currentState) {
        localStorage.setItem(getStorageKey('state', 'current'), JSON.stringify(data.currentState));
      }
      if (data.dailyLogs) {
        Object.entries(data.dailyLogs).forEach(([date, log]) => {
          saveDailyLog(date, log);
        });
      }
      if (data.monthlyAggregates) {
        Object.entries(data.monthlyAggregates).forEach(([ym, agg]) => {
          saveMonthlyAggregate(ym, agg);
        });
      }

      renderAll();
      toast('Imported ✓ — ' + getStorageSize());
    } catch (err) {
      toast('Invalid file');
    }
  };
  reader.readAsText(file);
}


/* ─────────── 3. UTILS ─────────── */

const VND = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const VNM = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function ds(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function fromDs(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function fmtDate(s) { const d = fromDs(s); return d.getDate() + ' ' + VNM[d.getMonth()]; }
function fmtFull(s) { const d = fromDs(s); return VND[d.getDay()] + ', ' + d.getDate() + ' ' + VNM[d.getMonth()] + ' ' + d.getFullYear(); }

// Convert {h, m} ↔ decimal hours
function toHours(t) {
  if (!t) return 0;
  return (t.h || 0) + (t.m || 0) / 60;
}
function fromHours(h) {
  const total = Math.round(h * 60);
  return { h: Math.floor(total / 60), m: total % 60 };
}
function fmtTime(t) {
  if (!t) return '0h00';
  return (t.h || 0) + 'h' + pad(t.m || 0);
}

// Get week (Mon–Sun) dates from a base date
function weekDates(baseDate) {
  const d = new Date(baseDate);
  const day = d.getDay() || 7;            // 1..7 (Mon=1, Sun=7)
  d.setDate(d.getDate() - day + 1);       // back to Monday
  const week = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(d);
    dd.setDate(d.getDate() + i);
    week.push(dd);
  }
  return week;
}

function monthDates(year, month) {
  const days = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: days }, (_, i) => new Date(year, month, i + 1));
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('on');
  setTimeout(() => el.classList.remove('on'), 1800);
}


/* ─────────── 4. STATE ─────────── */

let currentTab = 'input';
let logDate = ds(new Date());
let dailyDate = ds(new Date());
let weekBase = new Date();
let monthBase = new Date();


/* ═══════════════════════════════════════════════════════════════════
   5. CORRELATION ENGINE — Tier 1, 2, 3
   ═══════════════════════════════════════════════════════════════════ */

/* TIER 1 — Single Metric */
function tier1_singleMetric(log) {
  const out = {};
  PILLARS.forEach(p => { out[p.key] = toHours(log[p.key]); });
  return out;
}

/* TIER 2 — vs Target */
function tier2_vsTarget(log) {
  const t1 = tier1_singleMetric(log);
  const targets = loadTargets();
  const out = {};
  PILLARS.forEach(p => {
    const actual = t1[p.key];
    const target = targets[p.key] || 1;
    out[p.key] = {
      actual,
      target,
      pct: target > 0 ? Math.round((actual / target) * 100) : 0,
      negative: !!p.negative
    };
  });
  return out;
}

/* TIER 3 — Pair Correlations */
function tier3_pairCorrelations(log) {
  const t = tier1_singleMetric(log);
  const targets = loadTargets();
  const insights = [];
  const states = [];

  // -- 1. PHONE ↔ EXERCISE
  if (t.use_phone > 0 || t.exercise > 0) {
    const diff = t.use_phone - t.exercise;
    if (t.use_phone > t.exercise + 1.5) {
      insights.push({
        level: 'bad',
        label: 'PHONE > EXERCISE',
        msg: `Phone ${t.use_phone.toFixed(1)}h > Exercise ${t.exercise.toFixed(1)}h. Passive dopamine is overriding active energy.`,
        rec: 'Add 15 min of movement before or after phone time.'
      });
      states.push({ label: 'OVERSTIMULATED', tone: 'bad' });
    } else if (t.exercise > 0.5 && t.use_phone > 3) {
      insights.push({
        level: 'warn',
        label: 'COEXIST PATTERN',
        msg: `Exercise ${t.exercise.toFixed(1)}h but phone still ${t.use_phone.toFixed(1)}h. Possible "guilt compensation" — not a real behavior shift yet.`,
        rec: 'True discipline = phone drops as exercise rises.'
      });
    } else if (t.exercise > t.use_phone && t.exercise > 0.8) {
      insights.push({
        level: 'good',
        label: 'EXERCISE > PHONE',
        msg: `Exercise ${t.exercise.toFixed(1)}h > Phone ${t.use_phone.toFixed(1)}h. Executive control is rising.`,
        rec: 'Hold this rhythm. Compound effect kicks in after 2–3 weeks.'
      });
      states.push({ label: 'ACTIVE MODE', tone: 'good' });
    }
  }

  // -- 2. SLEEP ↔ MAIN JOB
  if (t.main_job > 0 || t.sleep > 0) {
    if (t.sleep < 6 && t.main_job >= targets.main_job) {
      insights.push({
        level: 'bad',
        label: 'UNSUSTAINABLE SPRINT',
        msg: `Sleep ${t.sleep.toFixed(1)}h + Main Job ${t.main_job.toFixed(1)}h. High output but unsustainable.`,
        rec: 'Crash incoming. Decision fatigue is building up.'
      });
      states.push({ label: 'SPRINT (RISKY)', tone: 'bad' });
    } else if (t.sleep >= 7 && t.sleep <= 8.5 && t.main_job >= targets.main_job * 0.85) {
      insights.push({
        level: 'good',
        label: 'SUSTAINABLE OUTPUT',
        msg: `Sleep ${t.sleep.toFixed(1)}h + Main Job ${t.main_job.toFixed(1)}h. Nervous system is stable.`,
        rec: 'This is the pace you can scale long-term. Keep it.'
      });
      states.push({ label: 'SUSTAINABLE', tone: 'good' });
    } else if (t.sleep > 9 && t.main_job < targets.main_job * 0.5) {
      insights.push({
        level: 'warn',
        label: 'REST WITHOUT OUTPUT',
        msg: `Sleep ${t.sleep.toFixed(1)}h but Main Job only ${t.main_job.toFixed(1)}h. Might be escape sleep, not real recovery.`,
        rec: 'Check: unclear goals? Or mental exhaustion?'
      });
    } else if (t.sleep < 6.5 && t.sleep > 0) {
      insights.push({
        level: 'warn',
        label: 'SLEEP DEBT',
        msg: `Sleep ${t.sleep.toFixed(1)}h under 7h. Immunity and focus will drop after 3–5 days.`,
        rec: 'Prioritize sleeping before 11 PM.'
      });
    }
  }

  // -- 3. MAIN ↔ SECOND JOB (Overload check)
  if (t.main_job > 0 && t.second_job > 0) {
    const total = t.main_job + t.second_job;
    if (total > 10 && t.sleep < 7) {
      insights.push({
        level: 'bad',
        label: 'OVERLOAD',
        msg: `Main + Second = ${total.toFixed(1)}h, Sleep ${t.sleep.toFixed(1)}h. Resource conflict.`,
        rec: 'Cut second job by 30 min or sleep 1h more.'
      });
      states.push({ label: 'OVERLOAD', tone: 'bad' });
    } else if (total >= 9 && total <= 11 && t.sleep >= 7) {
      states.push({ label: 'CAPACITY+', tone: 'good' });
    }
  }

  // -- 4. INVESTMENT ↔ PHONE
  if (t.investment >= 0 && t.use_phone > 0) {
    if (t.investment < 0.3 && t.use_phone > 4) {
      insights.push({
        level: 'bad',
        label: 'PASSIVE FUTURE',
        msg: `Investment ${(t.investment * 60).toFixed(0)}m + Phone ${t.use_phone.toFixed(1)}h. Consumption > asset building.`,
        rec: 'Swap 30 min of phone → 30 min of investment learning.'
      });
      states.push({ label: 'PASSIVE FUTURE', tone: 'bad' });
    } else if (t.investment >= 1 && t.use_phone > 4) {
      insights.push({
        level: 'warn',
        label: 'PRODUCTIVE PROCRASTINATION',
        msg: `Investment ${t.investment.toFixed(1)}h is good, but phone still ${t.use_phone.toFixed(1)}h. Learning without restructuring your lifestyle.`,
        rec: 'Might be info addiction. Apply first, learn more later.'
      });
    } else if (t.investment >= 1 && t.use_phone < 2) {
      insights.push({
        level: 'good',
        label: 'LONG-TERM BUILDER',
        msg: `Investment ${t.investment.toFixed(1)}h + Phone only ${t.use_phone.toFixed(1)}h. Long-term positioning is clear.`,
        rec: 'Compound 4 weeks → consider scaling the target.'
      });
      states.push({ label: 'LONG-TERM BUILDER', tone: 'good' });
    }
  }

  // -- 5. EXERCISE ↔ SLEEP
  if (t.exercise > 0 && t.sleep > 0) {
    if (t.exercise < 0.3 && t.sleep < 6.5) {
      insights.push({
        level: 'warn',
        label: 'NO PHYSICAL FATIGUE',
        msg: `Exercise ${(t.exercise * 60).toFixed(0)}m + Sleep ${t.sleep.toFixed(1)}h. Not enough physical fatigue → poor sleep quality.`,
        rec: 'Add 30 min of walking in the afternoon.'
      });
    } else if (t.exercise >= 0.7 && t.sleep >= 7) {
      states.push({ label: 'RECOVERY MODE', tone: 'good' });
    }
  }

  // -- 6. PHONE ↔ MAIN JOB
  if (t.use_phone > 5 && t.main_job < targets.main_job * 0.7) {
    insights.push({
      level: 'bad',
      label: 'PHONE KILLS PRODUCTIVITY',
      msg: `Phone ${t.use_phone.toFixed(1)}h and Main Job only ${t.main_job.toFixed(1)}h. Correlation is clear.`,
      rec: 'Detox for 2 days, measure the impact.'
    });
  }

  // -- 7. ALL LOW (Drift mode)
  const allLow = PILLARS.filter(p => !p.negative).every(p => {
    const target = targets[p.key];
    return t[p.key] < target * 0.5;
  });
  if (allLow && (t.main_job + t.exercise + t.investment) > 0) {
    insights.push({
      level: 'bad',
      label: 'DRIFT MODE',
      msg: 'Most targets below 50%. Motivation is declining.',
      rec: 'Reset goals. Pick 1 small trigger action to break the loop.'
    });
    states.push({ label: 'DRIFT MODE', tone: 'bad' });
  }

  return { insights, states };
}

/* SCORE — composite balanced score (0-100) */
function calcScore(log) {
  const t2 = tier2_vsTarget(log);
  let score = 0;
  let count = 0;

  PILLARS.forEach(p => {
    const v = t2[p.key];
    if (v.actual === 0 && v.target === 0) return;
    let pct;
    if (p.negative) {
      // less = better. 0 = 100%, target = 70%, 2x target = 0
      if (v.actual <= 0) pct = 100;
      else if (v.actual <= v.target) pct = 100 - (v.actual / v.target) * 30;
      else pct = Math.max(0, 70 - ((v.actual - v.target) / v.target) * 70);
    } else {
      pct = Math.min(110, v.pct);
      if (pct > 100) pct = 100 + (pct - 100) * 0.3; // diminishing return after 100
      pct = Math.min(105, pct);
    }
    score += pct;
    count++;
  });

  return count > 0 ? Math.round(score / count) : 0;
}

function scoreLabel(score) {
  if (score >= 85) return { text: 'BREAKTHROUGH', tone: 'good', desc: 'All 6 pillars balanced. Compound effect is running.' };
  if (score >= 70) return { text: 'ON TRACK', tone: 'good', desc: 'Good, still room to grow. Focus on the weakest pillar.' };
  if (score >= 50) return { text: 'AVERAGE', tone: 'mid', desc: 'Average. Need more consistency.' };
  if (score >= 30) return { text: 'NEEDS WORK', tone: 'low', desc: 'Off track. Reset 1 habit first.' };
  return { text: 'DRIFT', tone: 'low', desc: 'Lost direction. Pick 1 small win.' };
}

/* AGGREGATE — sum logs over date range */
function aggregateRange(dateStrs) {
  const sum = {};
  PILLARS.forEach(p => sum[p.key] = { h: 0, m: 0 });
  let count = 0;
  dateStrs.forEach(s => {
    const log = loadDailyLog(s);
    if (!log) return;
    let hasData = false;
    PILLARS.forEach(p => {
      const t = log[p.key];
      if (t && (t.h || t.m)) {
        sum[p.key].h += t.h || 0;
        sum[p.key].m += t.m || 0;
        hasData = true;
      }
    });
    if (hasData) count++;
  });
  // normalize minutes
  PILLARS.forEach(p => {
    sum[p.key].h += Math.floor(sum[p.key].m / 60);
    sum[p.key].m = sum[p.key].m % 60;
  });
  return { sum, count };
}


/* ═══════════════════════════════════════════════════════════════════
   6. RENDER
   ═══════════════════════════════════════════════════════════════════ */

/* ─── INPUT FORM ─── */
function renderInput() {
  document.getElementById('todayLabel').textContent = fmtFull(logDate);
  document.getElementById('logDate').value = logDate;

  const log = loadDailyLog(logDate) || {};
  const targets = loadTargets();
  const grid = document.getElementById('inputGrid');
  grid.innerHTML = PILLARS.map(p => {
    const t = log[p.key] || { h: 0, m: 0 };
    const target = targets[p.key];
    const targetTxt = p.negative ? `Max ${target}h/day` : `Target ${target}h/day`;
    return `
      <div class="input-row" data-key="${p.key}">
        <div class="input-icon">${p.icon}</div>
        <div class="input-info">
          <div class="input-label">${p.label}</div>
          <div class="input-target">${targetTxt}</div>
        </div>
        <div class="input-fields">
          <input class="tm-input" type="number" min="0" max="24" id="in_${p.key}_h" value="${t.h || 0}">
          <span class="tm-unit">h</span>
          <span class="tm-sep">:</span>
          <input class="tm-input" type="number" min="0" max="59" id="in_${p.key}_m" value="${t.m || 0}">
          <span class="tm-unit">m</span>
        </div>
      </div>
    `;
  }).join('');

  // quick stats: today total + score so far
  const savedLog = loadDailyLog(logDate);
  if (savedLog) {
    const score = calcScore(savedLog);
    const lbl = scoreLabel(score);
    const totalH = PILLARS.reduce((s, p) => s + toHours(savedLog[p.key]), 0);
    document.getElementById('quickStats').innerHTML = `
      <div class="qs-title">CURRENT SAVED</div>
      <div class="qs-row"><span class="qs-key">Total tracked</span><span class="qs-val">${totalH.toFixed(1)}h</span></div>
      <div class="qs-row"><span class="qs-key">Score</span><span class="qs-val">${score} / 100 — ${lbl.text}</span></div>
      <div class="qs-row"><span class="qs-key">Storage</span><span class="qs-val">${getStorageSize()}</span></div>
    `;
  } else {
    document.getElementById('quickStats').innerHTML = `
      <div class="qs-title">NO DATA YET</div>
      <div class="qs-row"><span class="qs-key">Status</span><span class="qs-val">Empty — fill in & save</span></div>
      <div class="qs-row"><span class="qs-key">Storage</span><span class="qs-val">${getStorageSize()}</span></div>
    `;
  }
}

function saveInputForm() {
  const log = {};
  PILLARS.forEach(p => {
    const h = parseInt(document.getElementById('in_' + p.key + '_h').value) || 0;
    const m = parseInt(document.getElementById('in_' + p.key + '_m').value) || 0;
    log[p.key] = { h, m };
  });
  saveDailyLog(logDate, log);
  renderInput();
  toast('Saved ✓');
}

/* ─── DAILY VIEW ─── */
function renderDaily() {
  document.getElementById('dailyLabel').textContent = fmtFull(dailyDate);
  document.getElementById('dailyDate').value = dailyDate;

  const log = loadDailyLog(dailyDate);
  const container = document.getElementById('dailyContent');

  if (!log) {
    container.innerHTML = `
      <div class="empty">
        <div class="empty-icon">○</div>
        <div>No data for this day.</div>
        <div style="margin-top:6px;font-size:11px;opacity:.7">Switch to LOG tab to add.</div>
      </div>`;
    return;
  }

  const t2 = tier2_vsTarget(log);
  const { insights, states } = tier3_pairCorrelations(log);
  const score = calcScore(log);
  const sLbl = scoreLabel(score);

  // Score gauge SVG
  const circumference = 2 * Math.PI * 32;
  const offset = circumference - (score / 100) * circumference;

  let html = '';

  // Score card
  html += `
    <div class="dash-card glow">
      <div class="dash-section-label">DAILY SCORE</div>
      <div class="score-gauge">
        <div class="gauge-circle">
          <svg viewBox="0 0 80 80" width="80" height="80">
            <circle cx="40" cy="40" r="32" fill="none" stroke="#1F2940" stroke-width="6"/>
            <circle cx="40" cy="40" r="32" fill="none"
              stroke="url(#gradS)" stroke-width="6" stroke-linecap="round"
              stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
              transform="rotate(-90 40 40)" style="transition: stroke-dashoffset 0.8s ease"/>
            <defs>
              <linearGradient id="gradS" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#00E5FF"/>
                <stop offset="100%" stop-color="#B388FF"/>
              </linearGradient>
            </defs>
          </svg>
          <div class="gauge-num">
            <div class="gauge-val">${score}</div>
            <div class="gauge-pct">/ 100</div>
          </div>
        </div>
        <div class="gauge-info">
          <div class="gauge-label">STATUS</div>
          <div class="gauge-status s-${sLbl.tone}">${sLbl.text}</div>
          <div class="gauge-desc">${sLbl.desc}</div>
        </div>
      </div>
      ${states.length ? `<div style="margin-top:12px">${states.map(s => `<span class="state-badge b-${s.tone}">${s.label}</span>`).join('')}</div>` : ''}
    </div>
  `;

  // Pillars vs target
  html += `
    <div class="dash-card">
      <div class="dash-section-label">PILLARS vs TARGET</div>
      <div class="pillar-list">
        ${PILLARS.map(p => {
          const v = t2[p.key];
          const fill = Math.min(100, v.pct);
          const isOver = p.negative && v.pct > 100;
          const fillStyle = isOver
            ? `width:100%; background:repeating-linear-gradient(45deg,#FF5252,#FF5252 4px,#C0392B 4px,#C0392B 8px)`
            : `width:${fill}%; background:linear-gradient(90deg, ${p.color}, ${p.color}AA)`;
          const targetTxt = p.negative ? `${v.actual.toFixed(1)}h / max ${v.target}h` : `${v.actual.toFixed(1)}h / ${v.target}h`;
          return `
            <div class="pillar">
              <div class="pillar-head">
                <div class="pillar-name">
                  <span class="pill-dot" style="background:${p.color}"></span>
                  <span>${p.label}</span>
                </div>
                <div class="pillar-time">${targetTxt} <span class="pt-target">(${v.pct}%)</span></div>
              </div>
              <div class="pillar-track">
                <div class="pillar-fill" style="${fillStyle}"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // Insights
  if (insights.length) {
    html += `
      <div class="dash-card">
        <div class="dash-section-label">INSIGHTS — ${insights.length}</div>
        ${insights.map(i => `
          <div class="insight i-${i.level}">
            <div class="insight-label">${i.label}</div>
            <div class="insight-msg">${i.msg}</div>
            <div class="insight-rec">${i.rec}</div>
          </div>
        `).join('')}
      </div>
    `;
  } else {
    html += `
      <div class="dash-card">
        <div class="dash-section-label">INSIGHTS</div>
        <div style="color:var(--tx3);font-size:13px;padding:8px 0">No unusual patterns detected.</div>
      </div>
    `;
  }

  container.innerHTML = html;
}

/* ─── WEEKLY VIEW ─── */
function renderWeekly() {
  const week = weekDates(weekBase);
  const wkStart = ds(week[0]);
  const wkEnd = ds(week[6]);
  document.getElementById('weeklyLabel').textContent = `${fmtDate(wkStart)} – ${fmtDate(wkEnd)}`;
  document.getElementById('weekRange').textContent = `${fmtDate(wkStart)} – ${fmtDate(wkEnd)}`;

  const dateStrs = week.map(d => ds(d));
  const { sum, count } = aggregateRange(dateStrs);

  const container = document.getElementById('weeklyContent');

  if (count === 0) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">○</div><div>No data this week.</div></div>`;
    return;
  }

  // Build a "synthetic average log" for correlation
  const avgLog = {};
  PILLARS.forEach(p => {
    const totalMin = sum[p.key].h * 60 + sum[p.key].m;
    const avgMin = count > 0 ? totalMin / count : 0;
    avgLog[p.key] = { h: Math.floor(avgMin / 60), m: Math.round(avgMin % 60) };
  });

  const t2 = tier2_vsTarget(avgLog);
  const { insights, states } = tier3_pairCorrelations(avgLog);
  const score = calcScore(avgLog);
  const sLbl = scoreLabel(score);

  const circumference = 2 * Math.PI * 32;
  const offset = circumference - (score / 100) * circumference;

  let html = '';

  // Week score
  html += `
    <div class="dash-card glow">
      <div class="dash-section-label">WEEK AVERAGE — ${count}/7 days logged</div>
      <div class="score-gauge">
        <div class="gauge-circle">
          <svg viewBox="0 0 80 80" width="80" height="80">
            <circle cx="40" cy="40" r="32" fill="none" stroke="#1F2940" stroke-width="6"/>
            <circle cx="40" cy="40" r="32" fill="none"
              stroke="url(#gradW)" stroke-width="6" stroke-linecap="round"
              stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
              transform="rotate(-90 40 40)"/>
            <defs>
              <linearGradient id="gradW" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#00E5FF"/>
                <stop offset="100%" stop-color="#B388FF"/>
              </linearGradient>
            </defs>
          </svg>
          <div class="gauge-num">
            <div class="gauge-val">${score}</div>
            <div class="gauge-pct">/ 100</div>
          </div>
        </div>
        <div class="gauge-info">
          <div class="gauge-label">WEEKLY STATUS</div>
          <div class="gauge-status s-${sLbl.tone}">${sLbl.text}</div>
          <div class="gauge-desc">${sLbl.desc}</div>
        </div>
      </div>
      ${states.length ? `<div style="margin-top:12px">${states.map(s => `<span class="state-badge b-${s.tone}">${s.label}</span>`).join('')}</div>` : ''}
    </div>
  `;

  // 7-day grid
  html += `
    <div class="dash-card">
      <div class="dash-section-label">7-DAY ACTIVITY</div>
      <div class="day-grid">
        ${week.map(d => {
          const s = ds(d);
          const log = loadDailyLog(s);
          const today = s === ds(new Date());
          if (!log) {
            return `<div class="day-cell ${today ? 'today' : ''}">
              <div class="day-cell-label">${VND[d.getDay()]}</div>
              <div class="day-cell-num" style="color:var(--tx4)">${d.getDate()}</div>
            </div>`;
          }
          const sc = calcScore(log);
          return `<div class="day-cell has-data ${today ? 'today' : ''}">
            <div class="day-cell-label">${VND[d.getDay()]}</div>
            <div class="day-cell-num">${d.getDate()}</div>
            <div class="day-cell-bar"><div class="day-cell-bar-fill" style="width:${Math.min(100, sc)}%"></div></div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;

  // Pillar averages
  html += `
    <div class="dash-card">
      <div class="dash-section-label">DAILY AVG vs TARGET</div>
      <div class="pillar-list">
        ${PILLARS.map(p => {
          const v = t2[p.key];
          const fill = Math.min(100, v.pct);
          const isOver = p.negative && v.pct > 100;
          const fillStyle = isOver
            ? `width:100%; background:repeating-linear-gradient(45deg,#FF5252,#FF5252 4px,#C0392B 4px,#C0392B 8px)`
            : `width:${fill}%; background:linear-gradient(90deg, ${p.color}, ${p.color}AA)`;
          const targetTxt = p.negative ? `${v.actual.toFixed(1)}h / max ${v.target}h` : `${v.actual.toFixed(1)}h / ${v.target}h`;
          return `
            <div class="pillar">
              <div class="pillar-head">
                <div class="pillar-name">
                  <span class="pill-dot" style="background:${p.color}"></span>
                  <span>${p.label}</span>
                </div>
                <div class="pillar-time">${targetTxt} <span class="pt-target">(${v.pct}%)</span></div>
              </div>
              <div class="pillar-track">
                <div class="pillar-fill" style="${fillStyle}"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // Insights
  if (insights.length) {
    html += `
      <div class="dash-card">
        <div class="dash-section-label">PATTERNS — ${insights.length}</div>
        ${insights.map(i => `
          <div class="insight i-${i.level}">
            <div class="insight-label">${i.label}</div>
            <div class="insight-msg">${i.msg}</div>
            <div class="insight-rec">${i.rec}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  container.innerHTML = html;
}

/* ─── MONTHLY VIEW ─── */
function renderMonthly() {
  const y = monthBase.getFullYear();
  const m = monthBase.getMonth();
  document.getElementById('monthlyLabel').textContent = `${VNM[m]} ${y}`;
  document.getElementById('monthRange').textContent = `${VNM[m]} ${y}`;

  const days = monthDates(y, m);
  const dateStrs = days.map(d => ds(d));
  const { sum, count } = aggregateRange(dateStrs);

  const container = document.getElementById('monthlyContent');

  if (count === 0) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">○</div><div>No data this month.</div></div>`;
    return;
  }

  // Average log
  const avgLog = {};
  PILLARS.forEach(p => {
    const totalMin = sum[p.key].h * 60 + sum[p.key].m;
    const avgMin = count > 0 ? totalMin / count : 0;
    avgLog[p.key] = { h: Math.floor(avgMin / 60), m: Math.round(avgMin % 60) };
  });

  const t2 = tier2_vsTarget(avgLog);
  const { insights, states } = tier3_pairCorrelations(avgLog);
  const score = calcScore(avgLog);
  const sLbl = scoreLabel(score);

  const circumference = 2 * Math.PI * 32;
  const offset = circumference - (score / 100) * circumference;

  let html = '';

  html += `
    <div class="dash-card glow">
      <div class="dash-section-label">MONTH AVERAGE — ${count}/${days.length} days logged</div>
      <div class="score-gauge">
        <div class="gauge-circle">
          <svg viewBox="0 0 80 80" width="80" height="80">
            <circle cx="40" cy="40" r="32" fill="none" stroke="#1F2940" stroke-width="6"/>
            <circle cx="40" cy="40" r="32" fill="none"
              stroke="url(#gradM)" stroke-width="6" stroke-linecap="round"
              stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
              transform="rotate(-90 40 40)"/>
            <defs>
              <linearGradient id="gradM" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#00E5FF"/>
                <stop offset="100%" stop-color="#B388FF"/>
              </linearGradient>
            </defs>
          </svg>
          <div class="gauge-num">
            <div class="gauge-val">${score}</div>
            <div class="gauge-pct">/ 100</div>
          </div>
        </div>
        <div class="gauge-info">
          <div class="gauge-label">MONTHLY STATUS</div>
          <div class="gauge-status s-${sLbl.tone}">${sLbl.text}</div>
          <div class="gauge-desc">${sLbl.desc}</div>
        </div>
      </div>
      ${states.length ? `<div style="margin-top:12px">${states.map(s => `<span class="state-badge b-${s.tone}">${s.label}</span>`).join('')}</div>` : ''}
    </div>
  `;

  // Total hours per pillar
  html += `
    <div class="dash-card">
      <div class="dash-section-label">TOTAL HOURS — ${VNM[m]}</div>
      <div class="pillar-list">
        ${PILLARS.map(p => {
          const totalH = sum[p.key].h + sum[p.key].m / 60;
          const targetTotal = DATA.targets[p.key] * count;
          const pct = targetTotal > 0 ? Math.round((totalH / targetTotal) * 100) : 0;
          const fill = Math.min(100, pct);
          const isOver = p.negative && pct > 100;
          const fillStyle = isOver
            ? `width:100%; background:repeating-linear-gradient(45deg,#FF5252,#FF5252 4px,#C0392B 4px,#C0392B 8px)`
            : `width:${fill}%; background:linear-gradient(90deg, ${p.color}, ${p.color}AA)`;
          const targetTxt = p.negative ? `${totalH.toFixed(0)}h / max ${targetTotal.toFixed(0)}h` : `${totalH.toFixed(0)}h / ${targetTotal.toFixed(0)}h`;
          return `
            <div class="pillar">
              <div class="pillar-head">
                <div class="pillar-name">
                  <span class="pill-dot" style="background:${p.color}"></span>
                  <span>${p.label}</span>
                </div>
                <div class="pillar-time">${targetTxt} <span class="pt-target">(${pct}%)</span></div>
              </div>
              <div class="pillar-track">
                <div class="pillar-fill" style="${fillStyle}"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // Insights
  if (insights.length) {
    html += `
      <div class="dash-card">
        <div class="dash-section-label">MONTHLY PATTERNS — ${insights.length}</div>
        ${insights.map(i => `
          <div class="insight i-${i.level}">
            <div class="insight-label">${i.label}</div>
            <div class="insight-msg">${i.msg}</div>
            <div class="insight-rec">${i.rec}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  container.innerHTML = html;
}

/* ─── SETTINGS ─── */
function renderSettings() {
  const targets = loadTargets();
  const grid = document.getElementById('settingsGrid');
  grid.innerHTML = PILLARS.map(p => {
    const target = targets[p.key];
    const note = p.negative ? '(max allowed)' : '(daily target)';
    return `
      <div class="input-row" data-key="${p.key}" style="margin-bottom:8px">
        <div class="input-icon">${p.icon}</div>
        <div class="input-info">
          <div class="input-label">${p.label}</div>
          <div class="input-target">${note}</div>
        </div>
        <div class="input-fields">
          <input class="tm-input" type="number" min="0" max="24" step="0.5" id="tg_${p.key}" value="${target}" style="width:60px">
          <span class="tm-unit">h</span>
        </div>
      </div>
    `;
  }).join('');

  // attach change handlers
  PILLARS.forEach(p => {
    const inp = document.getElementById('tg_' + p.key);
    if (inp) {
      inp.addEventListener('change', () => {
        const v = parseFloat(inp.value);
        if (!isNaN(v) && v >= 0) {
          const targets = loadTargets();
          targets[p.key] = v;
          saveTargets(targets);
        }
      });
    }
  });
}

function renderAll() {
  renderInput();
  renderDaily();
  renderWeekly();
  renderMonthly();
}


/* ═══════════════════════════════════════════════════════════════════
   7. EVENTS
   ═══════════════════════════════════════════════════════════════════ */

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('on', b.dataset.tab === tab);
  });
  document.querySelectorAll('.page').forEach(p => {
    p.classList.toggle('on', p.id === 'page-' + tab);
  });
  if (tab === 'daily') renderDaily();
  else if (tab === 'weekly') renderWeekly();
  else if (tab === 'monthly') renderMonthly();
  else if (tab === 'input') renderInput();
}

function shiftDate(strRef, days) {
  const d = fromDs(strRef);
  d.setDate(d.getDate() + days);
  return ds(d);
}

function bindEvents() {
  // tabs
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.addEventListener('click', () => switchTab(b.dataset.tab));
  });

  // INPUT date nav
  document.getElementById('dateBack').addEventListener('click', () => { logDate = shiftDate(logDate, -1); renderInput(); });
  document.getElementById('dateFwd').addEventListener('click', () => { logDate = shiftDate(logDate, 1); renderInput(); });
  document.getElementById('logDate').addEventListener('change', (e) => { logDate = e.target.value; renderInput(); });
  document.getElementById('saveBtn').addEventListener('click', saveInputForm);

  // DAILY date nav
  document.getElementById('dailyBack').addEventListener('click', () => { dailyDate = shiftDate(dailyDate, -1); renderDaily(); });
  document.getElementById('dailyFwd').addEventListener('click', () => { dailyDate = shiftDate(dailyDate, 1); renderDaily(); });
  document.getElementById('dailyDate').addEventListener('change', (e) => { dailyDate = e.target.value; renderDaily(); });

  // WEEK nav
  document.getElementById('weekBack').addEventListener('click', () => { weekBase.setDate(weekBase.getDate() - 7); renderWeekly(); });
  document.getElementById('weekFwd').addEventListener('click', () => { weekBase.setDate(weekBase.getDate() + 7); renderWeekly(); });

  // MONTH nav
  document.getElementById('monthBack').addEventListener('click', () => { monthBase.setMonth(monthBase.getMonth() - 1); renderMonthly(); });
  document.getElementById('monthFwd').addEventListener('click', () => { monthBase.setMonth(monthBase.getMonth() + 1); renderMonthly(); });

  // settings
  document.getElementById('settingsBtn').addEventListener('click', () => {
    renderSettings();
    document.getElementById('settingsModal').classList.add('on');
  });
  document.getElementById('closeSettings').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.remove('on');
    renderAll();
  });
  document.getElementById('settingsModal').addEventListener('click', (e) => {
    if (e.target.id === 'settingsModal') {
      document.getElementById('settingsModal').classList.remove('on');
      renderAll();
    }
  });

  // export / import / reset
  document.getElementById('exportBtn').addEventListener('click', exportJSON);
  document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', (e) => {
    if (e.target.files[0]) importJSON(e.target.files[0]);
  });
  document.getElementById('resetBtn').addEventListener('click', () => {
    if (confirm('Reset all data? This cannot be undone.')) {
      getAllStorageKeys().forEach(k => localStorage.removeItem(k));
      renderAll();
      renderSettings();
      toast('Reset ✓ — ' + getStorageSize());
    }
  });
}


/* ═══════════════════════════════════════════════════════════════════
   8. INIT
   ═══════════════════════════════════════════════════════════════════ */

bindEvents();
renderInput();
