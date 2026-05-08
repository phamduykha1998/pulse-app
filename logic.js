/* ═══════════════════════════════════════════════════════════════════
   PULSE v2 — Time + Energy Operating System
   ═══════════════════════════════════════════════════════════════════
   v2 CHANGES:
   • Added LEARNING pillar (7 pillars total)
   • New DEAD TIME ENGINE (replaces Tier 1-3 correlation)
     - Escape Time, Unaccounted Time, Zombie Time
     - Recovery Deficit, Intention Gap
     - Cognitive Load, Decision Fatigue
   • Intentionality scoring per pillar
   • Quality / Focus inputs
   • "Reality Mirror" view instead of habit dashboard
   ═══════════════════════════════════════════════════════════════════ */


/* ─────────── 1. CONFIG ─────────── */

const PILLARS = [
  { key: 'main_job',    label: 'Main Job',    icon: '◆', color: '#00E5FF', fn: 'build' },
  { key: 'second_job',  label: 'Second Job',  icon: '◇', color: '#B388FF', fn: 'build' },
  { key: 'learning',    label: 'Learning',    icon: '✦', color: '#FFD54F', fn: 'build' },
  { key: 'investment',  label: 'Investment',  icon: '↗', color: '#FFB300', fn: 'build' },
  { key: 'exercise',    label: 'Exercise',    icon: '▲', color: '#00E676', fn: 'maintain' },
  { key: 'sleep',       label: 'Sleep',       icon: '☾', color: '#4DD0E1', fn: 'recover' },
  { key: 'use_phone',   label: 'Phone Use',   icon: '▤', color: '#FF5252', fn: 'escape', negative: true }
];

const DEFAULT_TARGETS = {
  main_job: 8,
  second_job: 2,
  learning: 1.5,
  investment: 1,
  exercise: 1.5,
  sleep: 8,
  use_phone: 2
};

const FUNCTION_TYPES = {
  build:    { label: 'BUILD',    color: '#00E5FF' },
  maintain: { label: 'MAINTAIN', color: '#FFB300' },
  recover:  { label: 'RECOVER',  color: '#4DD0E1' },
  enjoy:    { label: 'ENJOY',    color: '#B388FF' },
  escape:   { label: 'ESCAPE',   color: '#FF5252' }
};


/* ─────────── 2. STORAGE ─────────── */

const STORE_PREFIX = 'pulse_';
const STORE_VERSION = 2;

function getStorageKey(type, id) { return STORE_PREFIX + type + '_' + id; }

function loadCurrentState() {
  try {
    const raw = localStorage.getItem(getStorageKey('state', 'current'));
    if (!raw) return { targets: { ...DEFAULT_TARGETS }, lastSync: ds(new Date()), version: STORE_VERSION };
    const state = JSON.parse(raw);
    if (!state.targets.learning) state.targets.learning = DEFAULT_TARGETS.learning;
    return state;
  } catch (e) {
    return { targets: { ...DEFAULT_TARGETS }, lastSync: ds(new Date()), version: STORE_VERSION };
  }
}

function loadDailyLog(dateStr) {
  try {
    const raw = localStorage.getItem(getStorageKey('daily', dateStr));
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function saveDailyLog(dateStr, log) {
  try {
    localStorage.setItem(getStorageKey('daily', dateStr), JSON.stringify(log));
    const state = loadCurrentState();
    state.lastSync = ds(new Date());
    localStorage.setItem(getStorageKey('state', 'current'), JSON.stringify(state));
  } catch (e) { console.error('Save error', e); }
}

function loadTargets() { return loadCurrentState().targets || { ...DEFAULT_TARGETS }; }

function saveTargets(targets) {
  const state = loadCurrentState();
  state.targets = targets;
  state.lastSync = ds(new Date());
  localStorage.setItem(getStorageKey('state', 'current'), JSON.stringify(state));
}

function getAllStorageKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith(STORE_PREFIX)) keys.push(k);
  }
  return keys;
}

function getStorageSize() {
  let size = 0;
  getAllStorageKeys().forEach(k => { size += localStorage.getItem(k).length; });
  return (size / 1024).toFixed(2) + ' KB';
}

function exportJSON() {
  const state = loadCurrentState();
  const dailies = {};
  getAllStorageKeys().forEach(k => {
    if (k.includes('_daily_')) {
      const date = k.replace(STORE_PREFIX + 'daily_', '');
      dailies[date] = JSON.parse(localStorage.getItem(k));
    }
  });
  const exportData = {
    timestamp: new Date().toISOString(),
    version: STORE_VERSION,
    storageSize: getStorageSize(),
    currentState: state,
    dailyLogs: dailies
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
      if (!data.currentState) throw new Error('Invalid');
      localStorage.setItem(getStorageKey('state', 'current'), JSON.stringify(data.currentState));
      if (data.dailyLogs) {
        Object.entries(data.dailyLogs).forEach(([date, log]) => saveDailyLog(date, log));
      }
      renderAll();
      toast('Imported ✓');
    } catch (err) { toast('Invalid file'); }
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
function toHours(t) { if (!t) return 0; return (t.h || 0) + (t.m || 0) / 60; }

function weekDates(baseDate) {
  const d = new Date(baseDate);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
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
   5. DEAD TIME ENGINE — Reality Mirror
   ═══════════════════════════════════════════════════════════════════ */

function computeDeadTime(log) {
  const targets = loadTargets();
  const t = {};
  PILLARS.forEach(p => { t[p.key] = toHours(log[p.key]); });

  const focusScore = (log.focus_score != null ? log.focus_score : 70) / 100;
  const sleepQuality = (log.sleep_quality != null ? log.sleep_quality : 70) / 100;
  const cognitiveLoad = log.cognitive_load || 0;
  const decisionLoad = log.decision_load || 0;

  const result = {
    breakdown: {},
    totalTracked: 0,
    totalDead: 0,
    intentionalTime: 0,
    escapeTime: 0,
    fatigueType: null,
    recoveryQuality: 0
  };

  // 1. ESCAPE TIME — phone vượt target
  const phoneTarget = targets.use_phone || 2;
  const escapePhone = Math.max(0, t.use_phone - phoneTarget);
  result.breakdown.escape = escapePhone;
  result.escapeTime = escapePhone;

  // 2. UNACCOUNTED TIME = 24h - sum(tracked) - maintenance buffer (4h)
  const sumTracked = PILLARS.reduce((s, p) => s + t[p.key], 0);
  result.totalTracked = sumTracked;
  const unaccounted = Math.max(0, 24 - sumTracked);
  const maintenanceBuffer = 4;
  const trueUnaccounted = Math.max(0, unaccounted - maintenanceBuffer);
  result.breakdown.unaccounted = trueUnaccounted;

  // 3. ZOMBIE TIME — work × (1 - focus)
  const workTime = t.main_job + t.second_job;
  const zombieTime = workTime * (1 - focusScore);
  result.breakdown.zombie = zombieTime;

  // 4. RECOVERY DEFICIT — sleep_target - effective_sleep
  const sleepTarget = targets.sleep || 8;
  const effectiveSleep = t.sleep * sleepQuality;
  const recoveryDeficit = Math.max(0, sleepTarget - effectiveSleep);
  result.breakdown.recovery_deficit = recoveryDeficit;
  result.recoveryQuality = Math.round(sleepQuality * 100);

  // 5. INTENTION GAP — learning + investment × (1 - focus) × 0.6
  const buildTime = t.learning + t.investment;
  const intentionGap = buildTime * (1 - focusScore) * 0.6;
  result.breakdown.intention_gap = intentionGap;

  // 6. COGNITIVE LOAD — mỗi task pending = 15min energy
  const cognitiveResidue = cognitiveLoad * 0.25;
  result.breakdown.cognitive_load = cognitiveResidue;

  // 7. DECISION FATIGUE
  const decisionMap = { 0: 0, 1: 0.3, 2: 0.7, 3: 1.2 };
  const decisionFatigue = decisionMap[decisionLoad] || 0;
  result.breakdown.decision_fatigue = decisionFatigue;

  result.totalDead = Object.values(result.breakdown).reduce((s, v) => s + v, 0);

  const productiveTracked = t.main_job + t.second_job + t.learning + t.investment + t.exercise + t.sleep;
  result.intentionalTime = Math.max(0, productiveTracked - (zombieTime + recoveryDeficit + intentionGap));
  result.fatigueType = diagnoseFatigue(result.breakdown, t, focusScore);

  return result;
}

function diagnoseFatigue(breakdown, t, focusScore) {
  const escape = breakdown.escape;
  const zombie = breakdown.zombie;
  const cognitive = breakdown.cognitive_load;
  const recoveryDef = breakdown.recovery_deficit;

  if ((t.main_job + t.second_job) > 6 && escape < 1 && recoveryDef < 1.5 && focusScore > 0.6) {
    return { type: 'PRODUCTIVE', tone: 'good', desc: 'Mệt vì làm thật. Đây là mệt khoẻ.' };
  }
  if (escape > 1.5) {
    return { type: 'ESCAPE FATIGUE', tone: 'bad', desc: 'Mệt vì trốn, không vì làm. Đang né cái gì?' };
  }
  if (focusScore < 0.5 || cognitive > 0.75) {
    return { type: 'FRAGMENTED', tone: 'warn', desc: 'Mệt vì đầu óc phân tán, nhiều task song song.' };
  }
  if ((t.main_job + t.second_job) < 4 && (escape > 1 || zombie > 1)) {
    return { type: 'ESCAPE FATIGUE', tone: 'bad', desc: 'Không làm nhiều, vẫn mệt — vì trốn.' };
  }
  return { type: 'BALANCED', tone: 'good', desc: 'Năng lượng cân bằng.' };
}

function calcIntentionality(log) {
  const dt = computeDeadTime(log);
  const targets = loadTargets();
  const t = {};
  PILLARS.forEach(p => { t[p.key] = toHours(log[p.key]); });

  const productiveTime = t.main_job + t.second_job + t.learning + t.investment + t.exercise;
  const totalUseful = productiveTime + (t.sleep * (log.sleep_quality || 70) / 100);
  const dead = dt.totalDead;
  const ratio = totalUseful / Math.max(0.1, totalUseful + dead);

  let bonus = 0;
  if (t.exercise >= targets.exercise * 0.7) bonus += 5;
  if (t.sleep >= targets.sleep * 0.85) bonus += 5;
  if (t.learning >= targets.learning * 0.7) bonus += 5;
  if (t.use_phone <= targets.use_phone) bonus += 5;

  return Math.min(100, Math.round(ratio * 80 + bonus));
}

function intentLabel(score) {
  if (score >= 85) return { text: 'COHERENT', tone: 'good', desc: 'Năng lượng & ý định đồng bộ. Compound đang chạy.' };
  if (score >= 70) return { text: 'INTENTIONAL', tone: 'good', desc: 'Phần lớn thời gian phục vụ mục tiêu.' };
  if (score >= 50) return { text: 'MIXED', tone: 'mid', desc: 'Có làm nhưng cũng có trốn.' };
  if (score >= 30) return { text: 'LEAKING', tone: 'low', desc: 'Quá nhiều thời gian chết. Cần fix 1 thứ.' };
  return { text: 'DRIFT', tone: 'low', desc: 'Lạc hướng. Reset ngày mai.' };
}

function generateFixes(log) {
  const dt = computeDeadTime(log);
  const targets = loadTargets();
  const t = {};
  PILLARS.forEach(p => { t[p.key] = toHours(log[p.key]); });

  const fixes = [];
  const sorted = Object.entries(dt.breakdown)
    .sort((a, b) => b[1] - a[1])
    .filter(([k, v]) => v > 0.3);

  sorted.slice(0, 4).forEach(([key, val]) => {
    if (key === 'escape') {
      fixes.push({
        title: 'CUT ESCAPE TIME',
        problem: `Phone vượt target ${val.toFixed(1)}h.`,
        action: `Mai giảm phone target xuống ${Math.max(1, targets.use_phone - 0.5)}h, hoặc cài timer.`,
        gain: `+${val.toFixed(1)}h reclaimed`,
        priority: 1
      });
    } else if (key === 'unaccounted') {
      fixes.push({
        title: 'RECLAIM UNACCOUNTED TIME',
        problem: `${val.toFixed(1)}h "biến mất" — không nhớ đi đâu.`,
        action: `Mai bật timer mỗi 2h, ghi 1 dòng "đã làm gì".`,
        gain: `Tìm lại ~${(val * 0.6).toFixed(1)}h productivity`,
        priority: 2
      });
    } else if (key === 'zombie') {
      fixes.push({
        title: 'REDUCE ZOMBIE TIME',
        problem: `${val.toFixed(1)}h work nhưng không focus.`,
        action: `Mai chia work thành block 90min, tắt notification.`,
        gain: `+${(val * 0.7).toFixed(1)}h real output`,
        priority: 3
      });
    } else if (key === 'recovery_deficit') {
      fixes.push({
        title: 'FIX SLEEP QUALITY',
        problem: `Ngủ ${t.sleep.toFixed(1)}h nhưng chỉ hồi phục ${dt.recoveryQuality}%.`,
        action: `Mai ngủ sớm 30min, tắt phone trước ngủ 1h.`,
        gain: `+${val.toFixed(1)}h recovery thực tế`,
        priority: 1
      });
    } else if (key === 'cognitive_load') {
      fixes.push({
        title: 'CLEAR MENTAL CACHE',
        problem: `Quá nhiều task pending trong đầu.`,
        action: `Tối nay viết hết task ra giấy. Ngủ rỗng.`,
        gain: `Năng lượng hôm sau +20-30%`,
        priority: 2
      });
    } else if (key === 'decision_fatigue') {
      fixes.push({
        title: 'BATCH DECISIONS',
        problem: `Decision load cao → đêm nay/mai sẽ "numb".`,
        action: `Mai pre-decide: ăn gì, mặc gì, làm gì trước. 1 lần.`,
        gain: `~30-40 min energy saved`,
        priority: 3
      });
    } else if (key === 'intention_gap') {
      fixes.push({
        title: 'CLOSE INTENTION GAP',
        problem: `Học/đầu tư ${(t.learning + t.investment).toFixed(1)}h nhưng không absorb.`,
        action: `Mai học 30min, viết 3 dòng tóm tắt sau đó.`,
        gain: `Quality jump 50%+`,
        priority: 2
      });
    }
  });

  return fixes.sort((a, b) => a.priority - b.priority).slice(0, 3);
}

function aggregateRange(dateStrs) {
  const sum = {};
  PILLARS.forEach(p => sum[p.key] = { h: 0, m: 0 });
  let count = 0;
  let focusSum = 0, sleepQSum = 0;
  let deadTotal = 0;

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
    if (hasData) {
      count++;
      focusSum += log.focus_score || 70;
      sleepQSum += log.sleep_quality || 70;
      const dt = computeDeadTime(log);
      deadTotal += dt.totalDead;
    }
  });
  PILLARS.forEach(p => {
    sum[p.key].h += Math.floor(sum[p.key].m / 60);
    sum[p.key].m = sum[p.key].m % 60;
  });
  return {
    sum, count,
    avgFocus: count > 0 ? Math.round(focusSum / count) : 0,
    avgSleepQ: count > 0 ? Math.round(sleepQSum / count) : 0,
    totalDead: deadTotal,
    avgDead: count > 0 ? deadTotal / count : 0
  };
}


/* ═══════════════════════════════════════════════════════════════════
   6. RENDER
   ═══════════════════════════════════════════════════════════════════ */

/* ─── INPUT ─── */
function renderInput() {
  document.getElementById('todayLabel').textContent = fmtFull(logDate);
  document.getElementById('logDate').value = logDate;

  const log = loadDailyLog(logDate) || {};
  const targets = loadTargets();
  const grid = document.getElementById('inputGrid');

  grid.innerHTML = PILLARS.map((p, i) => {
    const t = log[p.key] || { h: 0, m: 0 };
    const target = targets[p.key];
    const targetTxt = p.negative ? `Max ${target}h/day` : `Target ${target}h/day`;
    const fnLabel = FUNCTION_TYPES[p.fn].label;
    return `
      <div class="input-row stagger" data-key="${p.key}" style="animation-delay:${i * 50}ms">
        <div class="input-icon">${p.icon}</div>
        <div class="input-info">
          <div class="input-label">${p.label}</div>
          <div class="input-target">${targetTxt} · <span class="fn-tag fn-${p.fn}">${fnLabel}</span></div>
        </div>
        <div class="input-fields">
          <input class="tm-input" type="number" min="0" max="24" id="in_${p.key}_h" value="${t.h || 0}" inputmode="numeric">
          <span class="tm-unit">h</span>
          <span class="tm-sep">:</span>
          <input class="tm-input" type="number" min="0" max="59" id="in_${p.key}_m" value="${t.m || 0}" inputmode="numeric">
          <span class="tm-unit">m</span>
        </div>
      </div>
    `;
  }).join('');

  const qualityHtml = `
    <div class="quality-card stagger" style="animation-delay:${PILLARS.length * 50}ms">
      <div class="quality-title">QUALITY · STATE OF MIND</div>

      <div class="q-row">
        <div class="q-label">
          <span>Focus today</span>
          <span class="q-val" id="qv_focus">${log.focus_score || 70}%</span>
        </div>
        <input type="range" id="q_focus" min="0" max="100" value="${log.focus_score || 70}" class="q-slider">
        <div class="q-hint">Bao nhiêu % work thực sự "có tâm"?</div>
      </div>

      <div class="q-row">
        <div class="q-label">
          <span>Sleep quality</span>
          <span class="q-val" id="qv_sleep">${log.sleep_quality || 70}%</span>
        </div>
        <input type="range" id="q_sleep" min="0" max="100" value="${log.sleep_quality || 70}" class="q-slider">
        <div class="q-hint">Ngủ dậy có thấy hồi phục không?</div>
      </div>

      <div class="q-row">
        <div class="q-label">
          <span>Tasks pending in head</span>
          <span class="q-val" id="qv_cog">${log.cognitive_load || 0}</span>
        </div>
        <div class="q-pills" id="q_cognitive">
          ${[0, 1, 2, 3, 4, 5].map(n => `<button class="q-pill ${(log.cognitive_load || 0) === n ? 'on' : ''}" data-v="${n}">${n}</button>`).join('')}
        </div>
        <div class="q-hint">Số task đang "treo" trong đầu chưa xử lý.</div>
      </div>

      <div class="q-row">
        <div class="q-label">
          <span>Decision load</span>
          <span class="q-val" id="qv_dec">${['None', 'Low', 'Medium', 'High'][log.decision_load || 0]}</span>
        </div>
        <div class="q-pills" id="q_decision">
          ${['None', 'Low', 'Med', 'High'].map((lbl, n) => `<button class="q-pill ${(log.decision_load || 0) === n ? 'on' : ''}" data-v="${n}">${lbl}</button>`).join('')}
        </div>
        <div class="q-hint">Hôm nay phải quyết nhiều thứ không?</div>
      </div>
    </div>
  `;
  document.getElementById('qualityWrap').innerHTML = qualityHtml;

  document.getElementById('q_focus').addEventListener('input', e => {
    document.getElementById('qv_focus').textContent = e.target.value + '%';
  });
  document.getElementById('q_sleep').addEventListener('input', e => {
    document.getElementById('qv_sleep').textContent = e.target.value + '%';
  });
  document.querySelectorAll('#q_cognitive .q-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#q_cognitive .q-pill').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      document.getElementById('qv_cog').textContent = btn.dataset.v;
    });
  });
  document.querySelectorAll('#q_decision .q-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#q_decision .q-pill').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      const v = parseInt(btn.dataset.v);
      document.getElementById('qv_dec').textContent = ['None', 'Low', 'Medium', 'High'][v];
    });
  });

  const savedLog = loadDailyLog(logDate);
  if (savedLog) {
    const dt = computeDeadTime(savedLog);
    const intent = calcIntentionality(savedLog);
    const lbl = intentLabel(intent);
    document.getElementById('quickStats').innerHTML = `
      <div class="qs-title">CURRENT SAVED</div>
      <div class="qs-row"><span class="qs-key">Tracked</span><span class="qs-val">${dt.totalTracked.toFixed(1)}h</span></div>
      <div class="qs-row"><span class="qs-key">Dead Time</span><span class="qs-val">${dt.totalDead.toFixed(1)}h</span></div>
      <div class="qs-row"><span class="qs-key">Intentionality</span><span class="qs-val">${intent} · ${lbl.text}</span></div>
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
  log.focus_score = parseInt(document.getElementById('q_focus').value);
  log.sleep_quality = parseInt(document.getElementById('q_sleep').value);
  log.cognitive_load = parseInt(document.querySelector('#q_cognitive .q-pill.on').dataset.v);
  log.decision_load = parseInt(document.querySelector('#q_decision .q-pill.on').dataset.v);
  saveDailyLog(logDate, log);
  renderInput();
  toast('Saved ✓');
}

/* ─── DAILY ─── */
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

  const dt = computeDeadTime(log);
  const intent = calcIntentionality(log);
  const lbl = intentLabel(intent);
  const fixes = generateFixes(log);
  const targets = loadTargets();

  const t = {};
  PILLARS.forEach(p => { t[p.key] = toHours(log[p.key]); });

  const circ = 2 * Math.PI * 32;
  const offset = circ - (intent / 100) * circ;

  let html = '';

  html += `
    <div class="dash-card glow stagger" style="animation-delay:0ms">
      <div class="dash-section-label">INTENTIONALITY · REALITY MIRROR</div>
      <div class="score-gauge">
        <div class="gauge-circle">
          <svg viewBox="0 0 80 80" width="80" height="80">
            <circle cx="40" cy="40" r="32" fill="none" stroke="#1F2940" stroke-width="6"/>
            <circle cx="40" cy="40" r="32" fill="none"
              stroke="url(#gradS)" stroke-width="6" stroke-linecap="round"
              stroke-dasharray="${circ}" stroke-dashoffset="${circ}"
              transform="rotate(-90 40 40)"
              class="gauge-anim" data-target="${offset}"/>
            <defs>
              <linearGradient id="gradS" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#00E5FF"/>
                <stop offset="100%" stop-color="#B388FF"/>
              </linearGradient>
            </defs>
          </svg>
          <div class="gauge-num">
            <div class="gauge-val">${intent}</div>
            <div class="gauge-pct">/ 100</div>
          </div>
        </div>
        <div class="gauge-info">
          <div class="gauge-label">STATE</div>
          <div class="gauge-status s-${lbl.tone}">${lbl.text}</div>
          <div class="gauge-desc">${lbl.desc}</div>
        </div>
      </div>
    </div>
  `;

  const ddOrder = [
    { key: 'escape',          label: 'Escape Time',       desc: 'Phone vượt target' },
    { key: 'unaccounted',     label: 'Unaccounted Time',  desc: 'Không nhớ đi đâu' },
    { key: 'zombie',          label: 'Zombie Time',       desc: 'Work không focus' },
    { key: 'recovery_deficit',label: 'Recovery Deficit',  desc: 'Ngủ không hồi phục' },
    { key: 'intention_gap',   label: 'Intention Gap',     desc: 'Học không absorb' },
    { key: 'cognitive_load',  label: 'Cognitive Load',    desc: 'Task pending trong đầu' },
    { key: 'decision_fatigue',label: 'Decision Fatigue',  desc: 'Quyết định quá nhiều' }
  ];

  html += `
    <div class="dash-card stagger" style="animation-delay:100ms">
      <div class="dash-section-label">DEAD TIME · ${dt.totalDead.toFixed(1)}h LOST</div>
      <div class="dt-breakdown">
        ${ddOrder.map(d => {
          const v = dt.breakdown[d.key] || 0;
          if (v < 0.05) return '';
          const pct = Math.min(100, (v / Math.max(0.5, dt.totalDead)) * 100);
          return `
            <div class="dt-row">
              <div class="dt-head">
                <div class="dt-name">${d.label}</div>
                <div class="dt-val">${v.toFixed(1)}h</div>
              </div>
              <div class="dt-bar"><div class="dt-fill" data-w="${pct}" style="width:0%"></div></div>
              <div class="dt-desc">${d.desc}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  if (dt.fatigueType) {
    html += `
      <div class="dash-card stagger" style="animation-delay:200ms">
        <div class="dash-section-label">FATIGUE DIAGNOSIS</div>
        <div class="fatigue-card f-${dt.fatigueType.tone}">
          <div class="fatigue-type">${dt.fatigueType.type}</div>
          <div class="fatigue-desc">${dt.fatigueType.desc}</div>
        </div>
      </div>
    `;
  }

  html += `
    <div class="dash-card stagger" style="animation-delay:300ms">
      <div class="dash-section-label">PILLARS vs TARGET</div>
      <div class="pillar-list">
        ${PILLARS.map(p => {
          const actual = t[p.key];
          const target = targets[p.key] || 1;
          const pct = target > 0 ? Math.round((actual / target) * 100) : 0;
          const fill = Math.min(100, pct);
          const isOver = p.negative && pct > 100;
          const fillStyle = isOver
            ? `width:100%; background:repeating-linear-gradient(45deg,#FF5252,#FF5252 4px,#C0392B 4px,#C0392B 8px)`
            : `background:linear-gradient(90deg, ${p.color}, ${p.color}AA)`;
          const targetTxt = p.negative ? `${actual.toFixed(1)}h / max ${target}h` : `${actual.toFixed(1)}h / ${target}h`;
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
                <div class="pillar-fill" data-w="${fill}" style="${fillStyle}; width:0%"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  if (fixes.length) {
    html += `
      <div class="dash-card stagger" style="animation-delay:400ms">
        <div class="dash-section-label">PRIORITY FIX FOR TOMORROW</div>
        ${fixes.map((f, i) => `
          <div class="fix-card stagger" style="animation-delay:${500 + i * 100}ms">
            <div class="fix-num">#${i + 1}</div>
            <div class="fix-body">
              <div class="fix-title">${f.title}</div>
              <div class="fix-problem">${f.problem}</div>
              <div class="fix-action"><span class="fix-arrow">→</span> ${f.action}</div>
              <div class="fix-gain">${f.gain}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  container.innerHTML = html;

  requestAnimationFrame(() => {
    setTimeout(() => {
      const gauge = container.querySelector('.gauge-anim');
      if (gauge) gauge.style.strokeDashoffset = gauge.dataset.target;
      container.querySelectorAll('.pillar-fill[data-w]').forEach(el => {
        el.style.width = el.dataset.w + '%';
      });
      container.querySelectorAll('.dt-fill[data-w]').forEach(el => {
        el.style.width = el.dataset.w + '%';
      });
    }, 100);
  });
}

/* ─── WEEKLY ─── */
function renderWeekly() {
  const week = weekDates(weekBase);
  const wkStart = ds(week[0]);
  const wkEnd = ds(week[6]);
  document.getElementById('weeklyLabel').textContent = `${fmtDate(wkStart)} – ${fmtDate(wkEnd)}`;
  document.getElementById('weekRange').textContent = `${fmtDate(wkStart)} – ${fmtDate(wkEnd)}`;

  const dateStrs = week.map(d => ds(d));
  const agg = aggregateRange(dateStrs);
  const container = document.getElementById('weeklyContent');

  if (agg.count === 0) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">○</div><div>No data this week.</div></div>`;
    return;
  }

  const avgLog = {};
  PILLARS.forEach(p => {
    const totalMin = agg.sum[p.key].h * 60 + agg.sum[p.key].m;
    const avgMin = agg.count > 0 ? totalMin / agg.count : 0;
    avgLog[p.key] = { h: Math.floor(avgMin / 60), m: Math.round(avgMin % 60) };
  });
  avgLog.focus_score = agg.avgFocus;
  avgLog.sleep_quality = agg.avgSleepQ;
  avgLog.cognitive_load = 0;
  avgLog.decision_load = 0;

  const dt = computeDeadTime(avgLog);
  const intent = calcIntentionality(avgLog);
  const lbl = intentLabel(intent);
  const targets = loadTargets();

  const circ = 2 * Math.PI * 32;
  const offset = circ - (intent / 100) * circ;

  let html = '';

  html += `
    <div class="dash-card glow stagger" style="animation-delay:0ms">
      <div class="dash-section-label">WEEK AVERAGE — ${agg.count}/7 days logged</div>
      <div class="score-gauge">
        <div class="gauge-circle">
          <svg viewBox="0 0 80 80" width="80" height="80">
            <circle cx="40" cy="40" r="32" fill="none" stroke="#1F2940" stroke-width="6"/>
            <circle cx="40" cy="40" r="32" fill="none"
              stroke="url(#gradW)" stroke-width="6" stroke-linecap="round"
              stroke-dasharray="${circ}" stroke-dashoffset="${circ}"
              transform="rotate(-90 40 40)"
              class="gauge-anim" data-target="${offset}"/>
            <defs>
              <linearGradient id="gradW" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#00E5FF"/>
                <stop offset="100%" stop-color="#B388FF"/>
              </linearGradient>
            </defs>
          </svg>
          <div class="gauge-num">
            <div class="gauge-val">${intent}</div>
            <div class="gauge-pct">/ 100</div>
          </div>
        </div>
        <div class="gauge-info">
          <div class="gauge-label">WEEKLY STATE</div>
          <div class="gauge-status s-${lbl.tone}">${lbl.text}</div>
          <div class="gauge-desc">${lbl.desc}</div>
        </div>
      </div>
    </div>
  `;

  html += `
    <div class="dash-card stagger" style="animation-delay:100ms">
      <div class="dash-section-label">7-DAY ACTIVITY · DEAD ${agg.totalDead.toFixed(1)}h</div>
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
          const sc = calcIntentionality(log);
          return `<div class="day-cell has-data ${today ? 'today' : ''}">
            <div class="day-cell-label">${VND[d.getDay()]}</div>
            <div class="day-cell-num">${d.getDate()}</div>
            <div class="day-cell-bar"><div class="day-cell-bar-fill" data-w="${Math.min(100, sc)}" style="width:0"></div></div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;

  const t = {};
  PILLARS.forEach(p => { t[p.key] = toHours(avgLog[p.key]); });

  html += `
    <div class="dash-card stagger" style="animation-delay:200ms">
      <div class="dash-section-label">DAILY AVG vs TARGET</div>
      <div class="pillar-list">
        ${PILLARS.map(p => {
          const actual = t[p.key];
          const target = targets[p.key] || 1;
          const pct = target > 0 ? Math.round((actual / target) * 100) : 0;
          const fill = Math.min(100, pct);
          const isOver = p.negative && pct > 100;
          const fillStyle = isOver
            ? `width:100%; background:repeating-linear-gradient(45deg,#FF5252,#FF5252 4px,#C0392B 4px,#C0392B 8px)`
            : `background:linear-gradient(90deg, ${p.color}, ${p.color}AA)`;
          const targetTxt = p.negative ? `${actual.toFixed(1)}h / max ${target}h` : `${actual.toFixed(1)}h / ${target}h`;
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
                <div class="pillar-fill" data-w="${fill}" style="${fillStyle}; width:0%"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  container.innerHTML = html;

  requestAnimationFrame(() => {
    setTimeout(() => {
      const gauge = container.querySelector('.gauge-anim');
      if (gauge) gauge.style.strokeDashoffset = gauge.dataset.target;
      container.querySelectorAll('.pillar-fill[data-w]').forEach(el => {
        el.style.width = el.dataset.w + '%';
      });
      container.querySelectorAll('.day-cell-bar-fill[data-w]').forEach(el => {
        el.style.width = el.dataset.w + '%';
      });
    }, 100);
  });
}

/* ─── MONTHLY ─── */
function renderMonthly() {
  const y = monthBase.getFullYear();
  const m = monthBase.getMonth();
  document.getElementById('monthlyLabel').textContent = `${VNM[m]} ${y}`;
  document.getElementById('monthRange').textContent = `${VNM[m]} ${y}`;

  const days = monthDates(y, m);
  const dateStrs = days.map(d => ds(d));
  const agg = aggregateRange(dateStrs);
  const container = document.getElementById('monthlyContent');

  if (agg.count === 0) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">○</div><div>No data this month.</div></div>`;
    return;
  }

  const avgLog = {};
  PILLARS.forEach(p => {
    const totalMin = agg.sum[p.key].h * 60 + agg.sum[p.key].m;
    const avgMin = agg.count > 0 ? totalMin / agg.count : 0;
    avgLog[p.key] = { h: Math.floor(avgMin / 60), m: Math.round(avgMin % 60) };
  });
  avgLog.focus_score = agg.avgFocus;
  avgLog.sleep_quality = agg.avgSleepQ;

  const intent = calcIntentionality(avgLog);
  const lbl = intentLabel(intent);
  const targets = loadTargets();

  const circ = 2 * Math.PI * 32;
  const offset = circ - (intent / 100) * circ;

  let html = '';

  html += `
    <div class="dash-card glow stagger" style="animation-delay:0ms">
      <div class="dash-section-label">MONTH AVERAGE — ${agg.count}/${days.length} days</div>
      <div class="score-gauge">
        <div class="gauge-circle">
          <svg viewBox="0 0 80 80" width="80" height="80">
            <circle cx="40" cy="40" r="32" fill="none" stroke="#1F2940" stroke-width="6"/>
            <circle cx="40" cy="40" r="32" fill="none"
              stroke="url(#gradM)" stroke-width="6" stroke-linecap="round"
              stroke-dasharray="${circ}" stroke-dashoffset="${circ}"
              transform="rotate(-90 40 40)"
              class="gauge-anim" data-target="${offset}"/>
            <defs>
              <linearGradient id="gradM" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#00E5FF"/>
                <stop offset="100%" stop-color="#B388FF"/>
              </linearGradient>
            </defs>
          </svg>
          <div class="gauge-num">
            <div class="gauge-val">${intent}</div>
            <div class="gauge-pct">/ 100</div>
          </div>
        </div>
        <div class="gauge-info">
          <div class="gauge-label">MONTHLY STATE</div>
          <div class="gauge-status s-${lbl.tone}">${lbl.text}</div>
          <div class="gauge-desc">${lbl.desc}</div>
        </div>
      </div>
    </div>
  `;

  html += `
    <div class="dash-card stagger" style="animation-delay:100ms">
      <div class="dash-section-label">TOTAL HOURS · ${VNM[m]} (Dead: ${agg.totalDead.toFixed(0)}h)</div>
      <div class="pillar-list">
        ${PILLARS.map(p => {
          const totalH = agg.sum[p.key].h + agg.sum[p.key].m / 60;
          const targetTotal = targets[p.key] * agg.count;
          const pct = targetTotal > 0 ? Math.round((totalH / targetTotal) * 100) : 0;
          const fill = Math.min(100, pct);
          const isOver = p.negative && pct > 100;
          const fillStyle = isOver
            ? `width:100%; background:repeating-linear-gradient(45deg,#FF5252,#FF5252 4px,#C0392B 4px,#C0392B 8px)`
            : `background:linear-gradient(90deg, ${p.color}, ${p.color}AA)`;
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
                <div class="pillar-fill" data-w="${fill}" style="${fillStyle}; width:0%"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  container.innerHTML = html;

  requestAnimationFrame(() => {
    setTimeout(() => {
      const gauge = container.querySelector('.gauge-anim');
      if (gauge) gauge.style.strokeDashoffset = gauge.dataset.target;
      container.querySelectorAll('.pillar-fill[data-w]').forEach(el => {
        el.style.width = el.dataset.w + '%';
      });
    }, 100);
  });
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
  if (currentTab === 'daily') renderDaily();
  if (currentTab === 'weekly') renderWeekly();
  if (currentTab === 'monthly') renderMonthly();
}


/* ═══════════════════════════════════════════════════════════════════
   7. EVENTS
   ═══════════════════════════════════════════════════════════════════ */

function switchTab(tab) {
  if (currentTab === tab) return;
  currentTab = tab;
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('on', b.dataset.tab === tab);
  });
  document.querySelectorAll('.page').forEach(p => {
    if (p.id === 'page-' + tab) p.classList.add('on');
    else p.classList.remove('on');
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
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.addEventListener('click', () => switchTab(b.dataset.tab));
  });

  document.getElementById('dateBack').addEventListener('click', () => { logDate = shiftDate(logDate, -1); renderInput(); });
  document.getElementById('dateFwd').addEventListener('click', () => { logDate = shiftDate(logDate, 1); renderInput(); });
  document.getElementById('logDate').addEventListener('change', (e) => { logDate = e.target.value; renderInput(); });
  document.getElementById('saveBtn').addEventListener('click', saveInputForm);

  document.getElementById('dailyBack').addEventListener('click', () => { dailyDate = shiftDate(dailyDate, -1); renderDaily(); });
  document.getElementById('dailyFwd').addEventListener('click', () => { dailyDate = shiftDate(dailyDate, 1); renderDaily(); });
  document.getElementById('dailyDate').addEventListener('change', (e) => { dailyDate = e.target.value; renderDaily(); });

  document.getElementById('weekBack').addEventListener('click', () => { weekBase.setDate(weekBase.getDate() - 7); renderWeekly(); });
  document.getElementById('weekFwd').addEventListener('click', () => { weekBase.setDate(weekBase.getDate() + 7); renderWeekly(); });

  document.getElementById('monthBack').addEventListener('click', () => { monthBase.setMonth(monthBase.getMonth() - 1); renderMonthly(); });
  document.getElementById('monthFwd').addEventListener('click', () => { monthBase.setMonth(monthBase.getMonth() + 1); renderMonthly(); });

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
      toast('Reset ✓');
    }
  });
}


/* ═══════════════════════════════════════════════════════════════════
   8. INIT
   ═══════════════════════════════════════════════════════════════════ */

bindEvents();
renderInput();
