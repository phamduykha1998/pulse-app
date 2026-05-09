/* ═══════════════════════════════════════════════════════════════════
   PULSE v3.1 — Time + Energy OS
   ═══════════════════════════════════════════════════════════════════
   FIX v3.1:
   • Full tiếng Việt
   • Today button → text cyan clickable, không có ô
   • Phone Use → compact 2-col grid (Năng suất / Lãng phí)
   • Phone Alert → chỉ show hôm SAU nếu hôm qua vượt target
   • Không show alert nếu đúng giới hạn
   ═══════════════════════════════════════════════════════════════════ */


/* ─────────── 1. CONFIG ─────────── */

const PILLARS = [
  { key: 'main_job',   label: 'Công việc chính', icon: '◆', color: '#00E5FF', fn: 'build' },
  { key: 'second_job', label: 'Công việc phụ',   icon: '◇', color: '#B388FF', fn: 'build' },
  { key: 'learning',   label: 'Học tập',          icon: '✦', color: '#FFD54F', fn: 'build' },
  { key: 'investment', label: 'Đầu tư',           icon: '↗', color: '#FFB300', fn: 'build' },
  { key: 'exercise',   label: 'Vận động',         icon: '▲', color: '#00E676', fn: 'maintain' },
  { key: 'sleep',      label: 'Ngủ',              icon: '☾', color: '#4DD0E1', fn: 'recover' },
  { key: 'use_phone',  label: 'Dùng điện thoại', icon: '▤', color: '#FF5252', fn: 'escape', negative: true, hasSub: true }
];

const PHONE_SUBS = [
  { key: 'work',          label: 'Công việc',    icon: '◆', type: 'good', desc: 'Email, Slack, cuộc gọi' },
  { key: 'learning',      label: 'Học tập',      icon: '✦', type: 'good', desc: 'Khoá học, podcast, ebook' },
  { key: 'comm',          label: 'Liên lạc',     icon: '◐', type: 'good', desc: 'Gọi điện, nhắn tin gia đình/bạn' },
  { key: 'entertainment', label: 'Giải trí',     icon: '◉', type: 'bad',  desc: 'YouTube, Netflix, nhạc' },
  { key: 'gaming',        label: 'Game',         icon: '◈', type: 'bad',  desc: 'Game điện thoại' },
  { key: 'scroll',        label: 'Lướt mạng',   icon: '≋', type: 'bad',  desc: 'TikTok, Insta, FB' },
  { key: 'escape',        label: 'Trốn tránh',  icon: '⊘', type: 'bad',  desc: 'Né stress, tránh task' }
];

const DEFAULT_TARGETS = {
  main_job: 8, second_job: 2, learning: 1.5,
  investment: 1, exercise: 1.5, sleep: 8, use_phone: 2
};

const FN_VI = {
  build:    'XÂY DỰNG',
  maintain: 'DUY TRÌ',
  recover:  'HỒI PHỤC',
  enjoy:    'THƯ GIÃN',
  escape:   'TRỐN TRÁNH'
};


/* ─────────── 2. STORAGE ─────────── */

const STORE_PREFIX = 'pulse_';
const STORE_VERSION = 3;
const ALERT_DISMISS_KEY = 'pulse_alert_dismissed';

function getStorageKey(type, id) { return STORE_PREFIX + type + '_' + id; }

function loadCurrentState() {
  try {
    const raw = localStorage.getItem(getStorageKey('state', 'current'));
    if (!raw) return { targets: { ...DEFAULT_TARGETS }, lastSync: ds(new Date()), version: STORE_VERSION };
    const state = JSON.parse(raw);
    Object.keys(DEFAULT_TARGETS).forEach(k => {
      if (state.targets[k] == null) state.targets[k] = DEFAULT_TARGETS[k];
    });
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
    if (k && k.startsWith(STORE_PREFIX)) keys.push(k);
  }
  return keys;
}

function getStorageSize() {
  let size = 0;
  getAllStorageKeys().forEach(k => { size += (localStorage.getItem(k) || '').length; });
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
  const blob = new Blob([JSON.stringify({ timestamp: new Date().toISOString(), version: STORE_VERSION, storageSize: getStorageSize(), currentState: state, dailyLogs: dailies }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pulse_export_${ds(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Đã xuất dữ liệu ✓');
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
      toast('Đã nhập dữ liệu ✓');
    } catch (err) { toast('File không hợp lệ'); }
  };
  reader.readAsText(file);
}


/* ─────────── 3. UTILS ─────────── */

const VND = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const VNM = ['Th1','Th2','Th3','Th4','Th5','Th6','Th7','Th8','Th9','Th10','Th11','Th12'];
const VNM_FULL = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function ds(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function fromDs(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function fmtDate(s) { const d = fromDs(s); return d.getDate() + ' ' + VNM[d.getMonth()]; }
function fmtFull(s) { const d = fromDs(s); return VND[d.getDay()] + ', ' + d.getDate() + '/' + pad(d.getMonth()+1) + '/' + d.getFullYear(); }
function toHours(t) { if (!t) return 0; return (t.h || 0) + (t.m || 0) / 60; }
function shiftDate(strRef, days) { const d = fromDs(strRef); d.setDate(d.getDate() + days); return ds(d); }

function getPhoneTotal(phoneData) {
  if (!phoneData) return { h: 0, m: 0 };
  if (phoneData.h != null || phoneData.m != null) return { h: phoneData.h || 0, m: phoneData.m || 0 };
  let totalMin = 0;
  PHONE_SUBS.forEach(s => { const sub = phoneData[s.key]; if (sub) totalMin += (sub.h||0)*60 + (sub.m||0); });
  return { h: Math.floor(totalMin/60), m: totalMin%60 };
}

function getPhoneSplit(phoneData) {
  if (!phoneData) return { good: 0, bad: 0, total: 0, breakdown: {} };
  if (phoneData.h != null || phoneData.m != null) {
    const bad = (phoneData.h||0) + (phoneData.m||0)/60;
    return { good: 0, bad, total: bad, breakdown: {} };
  }
  let goodMin = 0, badMin = 0;
  const breakdown = {};
  PHONE_SUBS.forEach(s => {
    const sub = phoneData[s.key];
    const min = sub ? (sub.h||0)*60 + (sub.m||0) : 0;
    breakdown[s.key] = min / 60;
    if (s.type === 'good') goodMin += min; else badMin += min;
  });
  return { good: goodMin/60, bad: badMin/60, total: (goodMin+badMin)/60, breakdown };
}

function weekDates(baseDate) {
  const d = new Date(baseDate);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return Array.from({length:7}, (_, i) => { const dd = new Date(d); dd.setDate(d.getDate()+i); return dd; });
}

function monthDates(year, month) {
  const days = new Date(year, month+1, 0).getDate();
  return Array.from({length:days}, (_, i) => new Date(year, month, i+1));
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
   5. DEAD TIME ENGINE
   ═══════════════════════════════════════════════════════════════════ */

function computeDeadTime(log) {
  const targets = loadTargets();
  const t = {};
  PILLARS.forEach(p => {
    t[p.key] = p.key === 'use_phone' ? toHours(getPhoneTotal(log[p.key])) : toHours(log[p.key]);
  });

  const focusScore = (log.focus_score != null ? log.focus_score : 70) / 100;
  const sleepQuality = (log.sleep_quality != null ? log.sleep_quality : 70) / 100;
  const cognitiveLoad = log.cognitive_load || 0;
  const decisionLoad = log.decision_load || 0;

  const result = { breakdown: {}, totalTracked: 0, totalDead: 0, intentionalTime: 0, escapeTime: 0, fatigueType: null, recoveryQuality: 0 };

  const phoneSplit = getPhoneSplit(log.use_phone);
  result.breakdown.escape = Math.max(0, phoneSplit.bad - 0.5);
  result.escapeTime = result.breakdown.escape;

  const sumTracked = PILLARS.reduce((s, p) => s + t[p.key], 0);
  result.totalTracked = sumTracked;
  result.breakdown.unaccounted = Math.max(0, 24 - sumTracked - 4);

  const workTime = t.main_job + t.second_job;
  result.breakdown.zombie = workTime * (1 - focusScore);

  const effectiveSleep = t.sleep * sleepQuality;
  result.breakdown.recovery_deficit = Math.max(0, (targets.sleep||8) - effectiveSleep);
  result.recoveryQuality = Math.round(sleepQuality * 100);

  result.breakdown.intention_gap = (t.learning + t.investment) * (1 - focusScore) * 0.6;
  result.breakdown.cognitive_load = cognitiveLoad * 0.25;
  result.breakdown.decision_fatigue = ({0:0, 1:0.3, 2:0.7, 3:1.2})[decisionLoad] || 0;

  result.totalDead = Object.values(result.breakdown).reduce((s, v) => s + v, 0);
  result.intentionalTime = Math.max(0, (t.main_job + t.second_job + t.learning + t.investment + t.exercise + t.sleep) - (result.breakdown.zombie + result.breakdown.recovery_deficit + result.breakdown.intention_gap));
  result.fatigueType = diagnoseFatigue(result.breakdown, t, focusScore);
  return result;
}

function diagnoseFatigue(breakdown, t, focusScore) {
  const { escape, zombie, cognitive_load, recovery_deficit } = breakdown;
  if ((t.main_job + t.second_job) > 6 && escape < 1 && recovery_deficit < 1.5 && focusScore > 0.6)
    return { type: 'NĂNG SUẤT', tone: 'good', desc: 'Mệt vì làm thật. Đây là mệt khoẻ.' };
  if (escape > 1.5)
    return { type: 'TRỐN TRÁNH', tone: 'bad', desc: 'Mệt vì trốn, không vì làm. Đang né cái gì?' };
  if (focusScore < 0.5 || cognitive_load > 0.75)
    return { type: 'PHÂN TÁN', tone: 'warn', desc: 'Mệt vì đầu óc phân tán, nhiều task song song.' };
  if ((t.main_job + t.second_job) < 4 && (escape > 1 || zombie > 1))
    return { type: 'TRỐN TRÁNH', tone: 'bad', desc: 'Không làm nhiều, vẫn mệt — vì trốn.' };
  return { type: 'CÂN BẰNG', tone: 'good', desc: 'Năng lượng cân bằng.' };
}

function calcIntentionality(log) {
  const dt = computeDeadTime(log);
  const targets = loadTargets();
  const t = {};
  PILLARS.forEach(p => { t[p.key] = p.key === 'use_phone' ? toHours(getPhoneTotal(log[p.key])) : toHours(log[p.key]); });

  const totalUseful = (t.main_job + t.second_job + t.learning + t.investment + t.exercise) + (t.sleep * (log.sleep_quality||70) / 100);
  const ratio = totalUseful / Math.max(0.1, totalUseful + dt.totalDead);

  let bonus = 0;
  if (t.exercise >= targets.exercise * 0.7) bonus += 5;
  if (t.sleep >= targets.sleep * 0.85) bonus += 5;
  if (t.learning >= targets.learning * 0.7) bonus += 5;
  if (t.use_phone <= targets.use_phone) bonus += 5;

  return Math.min(100, Math.round(ratio * 80 + bonus));
}

function intentLabel(score) {
  if (score >= 85) return { text: 'COHERENT',     tone: 'good', desc: 'Năng lượng & ý định đồng bộ. Đang compound.' };
  if (score >= 70) return { text: 'CÓ CHỦ ĐÍCH',  tone: 'good', desc: 'Phần lớn thời gian phục vụ mục tiêu.' };
  if (score >= 50) return { text: 'HỖN HỢP',      tone: 'mid',  desc: 'Có làm nhưng cũng có trốn.' };
  if (score >= 30) return { text: 'RÒ RỈ',         tone: 'low',  desc: 'Quá nhiều thời gian chết. Cần fix 1 thứ.' };
  return             { text: 'LẠC HƯỚNG',          tone: 'low',  desc: 'Lạc hướng. Reset ngày mai.' };
}

function generateFixes(log) {
  const dt = computeDeadTime(log);
  const t = {};
  PILLARS.forEach(p => { t[p.key] = p.key === 'use_phone' ? toHours(getPhoneTotal(log[p.key])) : toHours(log[p.key]); });

  const fixes = [];
  Object.entries(dt.breakdown).sort((a,b) => b[1]-a[1]).filter(([,v]) => v > 0.3).slice(0,4).forEach(([key, val]) => {
    if (key === 'escape') {
      const split = getPhoneSplit(log.use_phone);
      const topBad = PHONE_SUBS.filter(s => s.type==='bad').map(s => ({name:s.label, h:split.breakdown[s.key]||0})).sort((a,b)=>b.h-a.h)[0];
      fixes.push({ title:'CẮT THỜI GIAN TRỐN', problem:`Điện thoại xấu ${split.bad.toFixed(1)}h${topBad&&topBad.h>0.3?' · Top: '+topBad.name+' ('+topBad.h.toFixed(1)+'h)':''}`, action:`Mai cài timer cho app nhiều nhất, hoặc tắt thông báo 1 buổi.`, gain:`+${val.toFixed(1)}h lấy lại`, priority:1 });
    } else if (key === 'unaccounted') {
      fixes.push({ title:'LẤY LẠI THỜI GIAN MẤT', problem:`${val.toFixed(1)}h "biến mất" — không nhớ đi đâu.`, action:`Mai bật timer mỗi 2h, ghi 1 dòng "đã làm gì".`, gain:`Tìm lại ~${(val*0.6).toFixed(1)}h hiệu suất`, priority:2 });
    } else if (key === 'zombie') {
      fixes.push({ title:'GIẢM THỜI GIAN ZOMBIE', problem:`${val.toFixed(1)}h làm việc nhưng không tập trung.`, action:`Mai chia công việc thành block 90min, tắt thông báo.`, gain:`+${(val*0.7).toFixed(1)}h kết quả thực`, priority:3 });
    } else if (key === 'recovery_deficit') {
      fixes.push({ title:'CẢI THIỆN CHẤT LƯỢNG NGỦ', problem:`Ngủ ${t.sleep.toFixed(1)}h nhưng chỉ hồi phục ${dt.recoveryQuality}%.`, action:`Mai ngủ sớm 30min, tắt điện thoại trước ngủ 1h.`, gain:`+${val.toFixed(1)}h hồi phục thực tế`, priority:1 });
    } else if (key === 'cognitive_load') {
      fixes.push({ title:'XÓA CACHE TRONG ĐẦU', problem:`Quá nhiều task chưa xử lý trong đầu.`, action:`Tối nay viết hết task ra giấy. Ngủ rỗng đầu.`, gain:`Năng lượng hôm sau +20-30%`, priority:2 });
    } else if (key === 'decision_fatigue') {
      fixes.push({ title:'GOM QUYẾT ĐỊNH', problem:`Quyết định quá nhiều → đêm nay/mai sẽ "tê liệt".`, action:`Mai pre-decide: ăn gì, mặc gì, làm gì trước. 1 lần.`, gain:`~30-40 phút năng lượng tiết kiệm`, priority:3 });
    } else if (key === 'intention_gap') {
      fixes.push({ title:'THU HẸP KHOẢNG CÁCH Ý ĐỊNH', problem:`Học/đầu tư ${(t.learning+t.investment).toFixed(1)}h nhưng không hấp thụ.`, action:`Mai học 30min, viết 3 dòng tóm tắt sau đó.`, gain:`Chất lượng tăng 50%+`, priority:2 });
    }
  });
  return fixes.sort((a,b) => a.priority-b.priority).slice(0,3);
}

function aggregateRange(dateStrs) {
  const sum = {};
  PILLARS.forEach(p => sum[p.key] = { h:0, m:0 });
  let count=0, focusSum=0, sleepQSum=0, deadTotal=0;
  dateStrs.forEach(s => {
    const log = loadDailyLog(s);
    if (!log) return;
    let hasData = false;
    PILLARS.forEach(p => {
      const t = p.key === 'use_phone' ? getPhoneTotal(log[p.key]) : log[p.key];
      if (t && (t.h||t.m)) { sum[p.key].h += t.h||0; sum[p.key].m += t.m||0; hasData = true; }
    });
    if (hasData) { count++; focusSum += log.focus_score||70; sleepQSum += log.sleep_quality||70; deadTotal += computeDeadTime(log).totalDead; }
  });
  PILLARS.forEach(p => { sum[p.key].h += Math.floor(sum[p.key].m/60); sum[p.key].m = sum[p.key].m%60; });
  return { sum, count, avgFocus: count>0?Math.round(focusSum/count):0, avgSleepQ: count>0?Math.round(sleepQSum/count):0, totalDead: deadTotal, avgDead: count>0?deadTotal/count:0 };
}


/* ═══════════════════════════════════════════════════════════════════
   6. PHONE SMART ALERT
   Chỉ show hôm SAU nếu hôm qua vượt target.
   Đúng giới hạn → không show.
   ═══════════════════════════════════════════════════════════════════ */

function checkPhoneAlert() {
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  const yestStr = ds(yest);
  const todayStr = ds(new Date());

  // Đã dismiss hôm nay → skip
  if (localStorage.getItem(ALERT_DISMISS_KEY) === todayStr) return;

  const log = loadDailyLog(yestStr);
  if (!log || !log.use_phone) return;

  const split = getPhoneSplit(log.use_phone);
  const target = loadTargets().use_phone || 2;

  // Chỉ alert nếu vượt target rõ ràng (>30min) VÀ có bad time đáng kể
  if (split.total <= target + 0.5) return;
  if (split.bad < 1.0) return; // bad time quá ít → không đáng alert
  if (split.total < 0.5) return;

  showPhoneAlert(yestStr, log, split, target);
}

function showPhoneAlert(yestStr, log, split, target) {
  const modal = document.getElementById('phoneAlertModal');
  const body = document.getElementById('phoneAlertBody');

  const overshoot = Math.max(0, split.total - target);
  const goodPct = split.total > 0 ? Math.round((split.good / split.total) * 100) : 0;
  const badPct = 100 - goodPct;

  const badList = PHONE_SUBS.filter(s => s.type==='bad').map(s => ({...s, h: split.breakdown[s.key]||0})).filter(x=>x.h>0).sort((a,b)=>b.h-a.h);
  const goodList = PHONE_SUBS.filter(s => s.type==='good').map(s => ({...s, h: split.breakdown[s.key]||0})).filter(x=>x.h>0);

  const topBad = badList[0];
  let insight = '', recommendation = '';
  if (topBad && topBad.h > 1) {
    const cutTo = Math.max(0.3, topBad.h * 0.4);
    insight = `"${topBad.label}" chiếm ${topBad.h.toFixed(1)}h — đây là nơi thất thoát nhiều nhất.`;
    recommendation = `Cắt ${topBad.label} xuống ~${cutTo.toFixed(1)}h → tổng điện thoại về ${(split.total - (topBad.h-cutTo)).toFixed(1)}h (gần mục tiêu ${target}h).`;
  } else if (badPct > 70) {
    insight = `${badPct}% thời gian điện thoại không có ích.`;
    recommendation = `Mai cài "cửa sổ điện thoại" 30min sau bữa ăn. Ngoài đó cất điện thoại.`;
  }

  const exerciseH = toHours(log.exercise);
  const sleepQ = log.sleep_quality || 70;
  let correlation = '';
  if (exerciseH < 0.3 && split.bad > 1.5)
    correlation = `Vận động ${exerciseH.toFixed(1)}h + Điện thoại xấu ${split.bad.toFixed(1)}h → vòng lặp stress→trốn→ít vận động.`;
  else if (sleepQ < 60 && split.bad > 1.5)
    correlation = `Chất lượng ngủ ${sleepQ}% + Điện thoại xấu ${split.bad.toFixed(1)}h → dùng điện thoại trước ngủ?`;

  const yestFmt = fmtFull(yestStr);

  body.innerHTML = `
    <div class="alert-date">Dữ liệu hôm qua · ${yestFmt}</div>

    <div class="alert-summary">
      <div class="alert-total">
        <div class="alert-total-num">${split.total.toFixed(1)}h</div>
        <div class="alert-total-lbl">điện thoại hôm qua</div>
      </div>
      <span class="ov-tag">+${overshoot.toFixed(1)}h vượt mục tiêu</span>
    </div>

    <div class="alert-bar">
      <div class="alert-bar-good" style="width:${goodPct}%"></div>
      <div class="alert-bar-bad" style="width:${badPct}%"></div>
    </div>
    <div class="alert-bar-legend">
      <span><span class="dot dot-good"></span>Năng suất ${split.good.toFixed(1)}h (${goodPct}%)</span>
      <span><span class="dot dot-bad"></span>Lãng phí ${split.bad.toFixed(1)}h (${badPct}%)</span>
    </div>

    ${goodList.length ? `<div class="alert-section"><div class="alert-section-title good">✓ NĂNG SUẤT</div>${goodList.map(x=>`<div class="alert-row"><span class="ar-name">${x.icon} ${x.label}</span><span class="ar-val good">${x.h.toFixed(1)}h</span></div>`).join('')}</div>` : ''}
    ${badList.length ? `<div class="alert-section"><div class="alert-section-title bad">✗ LÃNG PHÍ</div>${badList.map(x=>`<div class="alert-row"><span class="ar-name">${x.icon} ${x.label}</span><span class="ar-val bad">${x.h.toFixed(1)}h</span></div>`).join('')}</div>` : ''}

    ${insight ? `<div class="alert-insight"><div class="ai-label">📊 NHẬN XÉT</div><div class="ai-text">${insight}</div></div>` : ''}
    ${correlation ? `<div class="alert-insight warn"><div class="ai-label">⚠ PATTERN</div><div class="ai-text">${correlation}</div></div>` : ''}
    ${recommendation ? `<div class="alert-rec"><div class="ai-label">💡 HÔM NAY</div><div class="ai-text">${recommendation}</div></div>` : ''}

    <button class="alert-dismiss-btn" onclick="dismissPhoneAlert()">Đã hiểu, bắt đầu hôm nay tốt hơn →</button>
  `;

  modal.classList.add('on');
}

function dismissPhoneAlert() {
  document.getElementById('phoneAlertModal').classList.remove('on');
  localStorage.setItem(ALERT_DISMISS_KEY, ds(new Date()));
}


/* ═══════════════════════════════════════════════════════════════════
   7. RENDER — INPUT
   ═══════════════════════════════════════════════════════════════════ */

function renderInput() {
  const todayStr = ds(new Date());
  const isToday = logDate === todayStr;

  document.getElementById('todayLabel').textContent = fmtFull(logDate);
  document.getElementById('logDate').value = logDate;

  // Today link — chỉ show khi không ở hôm nay
  const todayLink = document.getElementById('todayLink');
  if (todayLink) {
    todayLink.style.display = isToday ? 'none' : 'block';
  }

  const log = loadDailyLog(logDate) || {};
  const targets = loadTargets();
  const grid = document.getElementById('inputGrid');

  grid.innerHTML = PILLARS.map((p, i) => {
    if (p.hasSub) return renderPhoneCard(p, log, targets, i);

    const t = log[p.key] || { h:0, m:0 };
    const target = targets[p.key];
    const targetTxt = p.negative ? `Tối đa ${target}h/ngày` : `Mục tiêu ${target}h/ngày`;
    return `
      <div class="input-row stagger" data-key="${p.key}" style="animation-delay:${i*50}ms">
        <div class="input-icon">${p.icon}</div>
        <div class="input-info">
          <div class="input-label">${p.label}</div>
          <div class="input-target">${targetTxt} · <span class="fn-tag fn-${p.fn}">${FN_VI[p.fn]}</span></div>
        </div>
        <div class="input-fields">
          <input class="tm-input" type="number" min="0" max="24" id="in_${p.key}_h" value="${t.h||0}" inputmode="numeric">
          <span class="tm-unit">h</span>
          <span class="tm-sep">:</span>
          <input class="tm-input" type="number" min="0" max="59" id="in_${p.key}_m" value="${t.m||0}" inputmode="numeric">
          <span class="tm-unit">m</span>
        </div>
      </div>
    `;
  }).join('');

  // Bind phone inputs
  PHONE_SUBS.forEach(s => {
    ['h','m'].forEach(unit => {
      const el = document.getElementById(`in_phone_${s.key}_${unit}`);
      if (el) el.addEventListener('input', updatePhoneTotal);
    });
  });

  // Quality card — Vietnamese
  document.getElementById('qualityWrap').innerHTML = `
    <div class="quality-card stagger" style="animation-delay:${PILLARS.length*50}ms">
      <div class="quality-title">CHẤT LƯỢNG · TRẠNG THÁI</div>
      <div class="q-row">
        <div class="q-label"><span>Mức độ tập trung hôm nay</span><span class="q-val" id="qv_focus">${log.focus_score||70}%</span></div>
        <input type="range" id="q_focus" min="0" max="100" value="${log.focus_score||70}" class="q-slider">
        <div class="q-hint">Bao nhiêu % công việc thực sự "có tâm"?</div>
      </div>
      <div class="q-row">
        <div class="q-label"><span>Chất lượng giấc ngủ</span><span class="q-val" id="qv_sleep">${log.sleep_quality||70}%</span></div>
        <input type="range" id="q_sleep" min="0" max="100" value="${log.sleep_quality||70}" class="q-slider">
        <div class="q-hint">Ngủ dậy có thấy hồi phục không?</div>
      </div>
      <div class="q-row">
        <div class="q-label"><span>Task đang "treo" trong đầu</span><span class="q-val" id="qv_cog">${log.cognitive_load||0}</span></div>
        <div class="q-pills" id="q_cognitive">
          ${[0,1,2,3,4,5].map(n=>`<button class="q-pill ${(log.cognitive_load||0)===n?'on':''}" data-v="${n}">${n}</button>`).join('')}
        </div>
        <div class="q-hint">Số task chưa xử lý đang chiếm bộ nhớ đầu.</div>
      </div>
      <div class="q-row">
        <div class="q-label"><span>Áp lực quyết định</span><span class="q-val" id="qv_dec">${['Không','Thấp','Trung bình','Cao'][log.decision_load||0]}</span></div>
        <div class="q-pills" id="q_decision">
          ${['Không','Thấp','TB','Cao'].map((lbl,n)=>`<button class="q-pill ${(log.decision_load||0)===n?'on':''}" data-v="${n}">${lbl}</button>`).join('')}
        </div>
        <div class="q-hint">Hôm nay phải đưa ra nhiều quyết định không?</div>
      </div>
    </div>
  `;

  document.getElementById('q_focus').addEventListener('input', e => { document.getElementById('qv_focus').textContent = e.target.value+'%'; });
  document.getElementById('q_sleep').addEventListener('input', e => { document.getElementById('qv_sleep').textContent = e.target.value+'%'; });
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
      document.getElementById('qv_dec').textContent = ['Không','Thấp','Trung bình','Cao'][parseInt(btn.dataset.v)];
    });
  });

  // Quick stats
  const savedLog = loadDailyLog(logDate);
  if (savedLog) {
    const dt = computeDeadTime(savedLog);
    const intent = calcIntentionality(savedLog);
    const lbl = intentLabel(intent);
    document.getElementById('quickStats').innerHTML = `
      <div class="qs-title">ĐÃ LƯU</div>
      <div class="qs-row"><span class="qs-key">Đã ghi</span><span class="qs-val">${dt.totalTracked.toFixed(1)}h</span></div>
      <div class="qs-row"><span class="qs-key">Thời gian chết</span><span class="qs-val">${dt.totalDead.toFixed(1)}h</span></div>
      <div class="qs-row"><span class="qs-key">Chủ đích</span><span class="qs-val">${intent} · ${lbl.text}</span></div>
      <div class="qs-row"><span class="qs-key">Bộ nhớ</span><span class="qs-val">${getStorageSize()}</span></div>
    `;
  } else {
    document.getElementById('quickStats').innerHTML = `
      <div class="qs-title">CHƯA CÓ DỮ LIỆU</div>
      <div class="qs-row"><span class="qs-key">Trạng thái</span><span class="qs-val">Trống — nhập và lưu</span></div>
      <div class="qs-row"><span class="qs-key">Bộ nhớ</span><span class="qs-val">${getStorageSize()}</span></div>
    `;
  }
}

/* ── PHONE CARD — compact 2-col grid ── */
function renderPhoneCard(p, log, targets, i) {
  const phoneData = log[p.key] || {};
  const target = targets[p.key];
  const split = getPhoneSplit(phoneData);
  const total = getPhoneTotal(phoneData);
  const isOver = split.total > target;
  const isLegacy = (phoneData.h != null || phoneData.m != null) && !PHONE_SUBS.some(s => phoneData[s.key]);

  const goodSubs = PHONE_SUBS.filter(s => s.type === 'good');
  const badSubs  = PHONE_SUBS.filter(s => s.type === 'bad');

  function subInput(s) {
    const sub = phoneData[s.key] || { h:0, m:0 };
    return `
      <div class="ph-sub">
        <div class="ph-sub-head">
          <span class="ph-sub-icon">${s.icon}</span>
          <span class="ph-sub-name">${s.label}</span>
          <span class="ph-sub-time" id="ph_display_${s.key}">${sub.h||0}h${sub.m||0 ? ' '+(sub.m||0)+'m' : ''}</span>
        </div>
        <div class="ph-sub-desc">${s.desc}</div>
        <div class="ph-sub-inputs">
          <input class="tm-input tm-sm" type="number" min="0" max="24" id="in_phone_${s.key}_h" value="${sub.h||0}" inputmode="numeric">
          <span class="tm-unit">g</span>
          <input class="tm-input tm-sm" type="number" min="0" max="59" id="in_phone_${s.key}_m" value="${sub.m||0}" inputmode="numeric">
          <span class="tm-unit">p</span>
        </div>
      </div>
    `;
  }

  return `
    <div class="phone-card stagger" data-key="${p.key}" style="animation-delay:${i*50}ms">
      <div class="phone-card-head">
        <div class="phone-card-left">
          <div class="input-icon ph-icon">${p.icon}</div>
          <div>
            <div class="input-label">${p.label}</div>
            <div class="input-target">Tối đa ${target}h/ngày · <span class="fn-tag fn-escape">TRỐN TRÁNH</span></div>
          </div>
        </div>
        <div class="phone-card-total ${isOver ? 'over' : ''}" id="phoneTotalDisplay">
          <div class="pct-num">${total.h}g ${total.m}p</div>
          <div class="pct-split">
            <span class="pts-good">✓ ${split.good.toFixed(1)}h</span>
            <span class="pts-sep">·</span>
            <span class="pts-bad">✗ ${split.bad.toFixed(1)}h</span>
          </div>
        </div>
      </div>

      ${isLegacy ? `<div class="phone-legacy-note">⚠ Dữ liệu cũ — vui lòng nhập lại theo danh mục bên dưới.</div>` : ''}

      <div class="phone-grid">
        <div class="phone-col good-col">
          <div class="phone-col-title good">✓ NĂNG SUẤT</div>
          ${goodSubs.map(subInput).join('')}
        </div>
        <div class="phone-col bad-col">
          <div class="phone-col-title bad">✗ LÃNG PHÍ</div>
          ${badSubs.map(subInput).join('')}
        </div>
      </div>
    </div>
  `;
}

function updatePhoneTotal() {
  let goodMin = 0, badMin = 0;
  PHONE_SUBS.forEach(s => {
    const h = parseInt(document.getElementById(`in_phone_${s.key}_h`)?.value) || 0;
    const m = parseInt(document.getElementById(`in_phone_${s.key}_m`)?.value) || 0;
    const min = h*60 + m;
    if (s.type === 'good') goodMin += min; else badMin += min;

    // Update per-sub display
    const disp = document.getElementById(`ph_display_${s.key}`);
    if (disp) disp.textContent = h + 'g' + (m ? ' '+m+'p' : '');
  });
  const totalMin = goodMin + badMin;
  const display = document.getElementById('phoneTotalDisplay');
  if (display) {
    const target = loadTargets().use_phone || 2;
    display.classList.toggle('over', totalMin/60 > target);
    display.querySelector('.pct-num').textContent = `${Math.floor(totalMin/60)}g ${totalMin%60}p`;
    display.querySelector('.pts-good').textContent = `✓ ${(goodMin/60).toFixed(1)}h`;
    display.querySelector('.pts-bad').textContent  = `✗ ${(badMin/60).toFixed(1)}h`;
  }
}

function validateInputs() {
  let totalMin = 0, errors = [];
  PILLARS.forEach(p => {
    if (p.hasSub) {
      PHONE_SUBS.forEach(s => {
        const h = parseInt(document.getElementById(`in_phone_${s.key}_h`)?.value)||0;
        const m = parseInt(document.getElementById(`in_phone_${s.key}_m`)?.value)||0;
        if (h<0||h>24) errors.push(`${p.label} > ${s.label}: giờ phải 0-24`);
        if (m<0||m>59) errors.push(`${p.label} > ${s.label}: phút phải 0-59`);
        totalMin += h*60 + m;
      });
    } else {
      const h = parseInt(document.getElementById('in_'+p.key+'_h')?.value)||0;
      const m = parseInt(document.getElementById('in_'+p.key+'_m')?.value)||0;
      if (h<0||h>24) errors.push(`${p.label}: giờ phải 0-24`);
      if (m<0||m>59) errors.push(`${p.label}: phút phải 0-59`);
      totalMin += h*60 + m;
    }
  });
  if (totalMin/60 > 24) errors.push(`Tổng = ${(totalMin/60).toFixed(1)}h > 24h. Bạn có chắc không?`);
  return { ok: errors.length===0, errors, totalH: totalMin/60 };
}

function saveInputForm() {
  const v = validateInputs();
  if (!v.ok) {
    if (v.errors.some(e => e.includes('> 24h'))) {
      if (!confirm(`⚠ ${v.errors[0]}\n\nLưu vẫn?`)) return;
    } else { toast('⚠ ' + v.errors[0]); return; }
  }
  const log = {};
  PILLARS.forEach(p => {
    if (p.hasSub) {
      const obj = {};
      PHONE_SUBS.forEach(s => {
        obj[s.key] = { h: parseInt(document.getElementById(`in_phone_${s.key}_h`)?.value)||0, m: parseInt(document.getElementById(`in_phone_${s.key}_m`)?.value)||0 };
      });
      log[p.key] = obj;
    } else {
      log[p.key] = { h: parseInt(document.getElementById('in_'+p.key+'_h')?.value)||0, m: parseInt(document.getElementById('in_'+p.key+'_m')?.value)||0 };
    }
  });
  log.focus_score    = parseInt(document.getElementById('q_focus').value);
  log.sleep_quality  = parseInt(document.getElementById('q_sleep').value);
  log.cognitive_load = parseInt(document.querySelector('#q_cognitive .q-pill.on')?.dataset.v||0);
  log.decision_load  = parseInt(document.querySelector('#q_decision .q-pill.on')?.dataset.v||0);
  saveDailyLog(logDate, log);
  renderInput();
  toast('Đã lưu ✓');
}


/* ═══════════════════════════════════════════════════════════════════
   8. RENDER — DAILY
   ═══════════════════════════════════════════════════════════════════ */

function renderDaily() {
  const todayStr = ds(new Date());
  document.getElementById('dailyLabel').textContent = fmtFull(dailyDate);
  document.getElementById('dailyDate').value = dailyDate;
  const dailyTodayLink = document.getElementById('dailyTodayLink');
  if (dailyTodayLink) dailyTodayLink.style.display = dailyDate === todayStr ? 'none' : 'block';

  const log = loadDailyLog(dailyDate);
  const container = document.getElementById('dailyContent');
  if (!log) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">○</div><div>Chưa có dữ liệu ngày này.</div><div style="margin-top:6px;font-size:11px;opacity:.7">Chuyển sang tab NHẬT KÝ để thêm.</div></div>`;
    return;
  }

  const dt = computeDeadTime(log);
  const intent = calcIntentionality(log);
  const lbl = intentLabel(intent);
  const fixes = generateFixes(log);
  const targets = loadTargets();
  const t = {};
  PILLARS.forEach(p => { t[p.key] = p.key==='use_phone' ? toHours(getPhoneTotal(log[p.key])) : toHours(log[p.key]); });

  const circ = 2 * Math.PI * 32;
  const offset = circ - (intent/100) * circ;
  let html = '';

  html += `
    <div class="dash-card glow stagger" style="animation-delay:0ms">
      <div class="dash-section-label">CHỦ ĐÍCH · GƯƠNG THỰC TẾ</div>
      <div class="score-gauge">
        <div class="gauge-circle">
          <svg viewBox="0 0 80 80" width="80" height="80">
            <circle cx="40" cy="40" r="32" fill="none" stroke="#1F2940" stroke-width="6"/>
            <circle cx="40" cy="40" r="32" fill="none" stroke="url(#gradS)" stroke-width="6" stroke-linecap="round"
              stroke-dasharray="${circ}" stroke-dashoffset="${circ}" transform="rotate(-90 40 40)"
              class="gauge-anim" data-target="${offset}"/>
            <defs><linearGradient id="gradS" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#00E5FF"/><stop offset="100%" stop-color="#B388FF"/></linearGradient></defs>
          </svg>
          <div class="gauge-num"><div class="gauge-val">${intent}</div><div class="gauge-pct">/ 100</div></div>
        </div>
        <div class="gauge-info">
          <div class="gauge-label">TRẠNG THÁI</div>
          <div class="gauge-status s-${lbl.tone}">${lbl.text}</div>
          <div class="gauge-desc">${lbl.desc}</div>
        </div>
      </div>
    </div>
  `;

  // Phone breakdown
  const split = getPhoneSplit(log.use_phone);
  if (split.total > 0 && Object.keys(split.breakdown).length) {
    const goodPct = split.total>0 ? Math.round((split.good/split.total)*100) : 0;
    const badPct = 100-goodPct;
    const badList = PHONE_SUBS.filter(s=>s.type==='bad').map(s=>({...s,h:split.breakdown[s.key]||0})).filter(x=>x.h>0).sort((a,b)=>b.h-a.h);
    html += `
      <div class="dash-card stagger" style="animation-delay:50ms">
        <div class="dash-section-label">ĐIỆN THOẠI · ${split.total.toFixed(1)}h TỔNG</div>
        <div class="phone-bar"><div class="phone-bar-good" style="width:${goodPct}%"></div><div class="phone-bar-bad" style="width:${badPct}%"></div></div>
        <div class="phone-bar-legend">
          <span><span class="dot dot-good"></span>Năng suất ${split.good.toFixed(1)}h (${goodPct}%)</span>
          <span><span class="dot dot-bad"></span>Lãng phí ${split.bad.toFixed(1)}h (${badPct}%)</span>
        </div>
        ${badList.length ? `<div class="phone-detail-grid">${badList.slice(0,4).map(x=>`<div class="phone-detail-cell"><div class="pdc-icon">${x.icon}</div><div class="pdc-name">${x.label}</div><div class="pdc-val">${x.h.toFixed(1)}h</div></div>`).join('')}</div>` : ''}
      </div>
    `;
  }

  const ddOrder = [
    { key:'escape',           label:'Thời gian trốn tránh', desc:'Điện thoại xấu vượt giới hạn' },
    { key:'unaccounted',      label:'Thời gian mất tích',   desc:'Không nhớ đi đâu' },
    { key:'zombie',           label:'Thời gian zombie',     desc:'Làm việc không tập trung' },
    { key:'recovery_deficit', label:'Thiếu hồi phục',       desc:'Ngủ không đủ/không chất lượng' },
    { key:'intention_gap',    label:'Khoảng cách ý định',   desc:'Học nhưng không hấp thụ' },
    { key:'cognitive_load',   label:'Tải nhận thức',        desc:'Task treo trong đầu' },
    { key:'decision_fatigue', label:'Mệt quyết định',       desc:'Đưa ra quá nhiều lựa chọn' }
  ];

  html += `
    <div class="dash-card stagger" style="animation-delay:100ms">
      <div class="dash-section-label">THỜI GIAN CHẾT · ${dt.totalDead.toFixed(1)}h MẤT</div>
      <div class="dt-breakdown">
        ${ddOrder.map(d => {
          const v = dt.breakdown[d.key]||0;
          if (v<0.05) return '';
          const pct = Math.min(100,(v/Math.max(0.5,dt.totalDead))*100);
          return `<div class="dt-row"><div class="dt-head"><div class="dt-name">${d.label}</div><div class="dt-val">${v.toFixed(1)}h</div></div><div class="dt-bar"><div class="dt-fill" data-w="${pct}" style="width:0%"></div></div><div class="dt-desc">${d.desc}</div></div>`;
        }).join('')}
      </div>
    </div>
  `;

  if (dt.fatigueType) {
    html += `
      <div class="dash-card stagger" style="animation-delay:200ms">
        <div class="dash-section-label">CHẨN ĐOÁN MỆT MỎI</div>
        <div class="fatigue-card f-${dt.fatigueType.tone}">
          <div class="fatigue-type">${dt.fatigueType.type}</div>
          <div class="fatigue-desc">${dt.fatigueType.desc}</div>
        </div>
      </div>
    `;
  }

  html += `
    <div class="dash-card stagger" style="animation-delay:300ms">
      <div class="dash-section-label">CÁC TRỤ CỘT vs MỤC TIÊU</div>
      <div class="pillar-list">
        ${PILLARS.map(p => {
          const actual = t[p.key];
          const target = targets[p.key]||1;
          const pct = target>0 ? Math.round((actual/target)*100) : 0;
          const fill = Math.min(100,pct);
          const isOver = p.negative && pct>100;
          const fillStyle = isOver ? `width:100%;background:repeating-linear-gradient(45deg,#FF5252,#FF5252 4px,#C0392B 4px,#C0392B 8px)` : `background:linear-gradient(90deg,${p.color},${p.color}AA)`;
          const txt = p.negative ? `${actual.toFixed(1)}h / tối đa ${target}h` : `${actual.toFixed(1)}h / ${target}h`;
          return `<div class="pillar"><div class="pillar-head"><div class="pillar-name"><span class="pill-dot" style="background:${p.color}"></span><span>${p.label}</span></div><div class="pillar-time">${txt} <span class="pt-target">(${pct}%)</span></div></div><div class="pillar-track"><div class="pillar-fill" data-w="${fill}" style="${fillStyle};width:0%"></div></div></div>`;
        }).join('')}
      </div>
    </div>
  `;

  if (fixes.length) {
    html += `
      <div class="dash-card stagger" style="animation-delay:400ms">
        <div class="dash-section-label">ƯU TIÊN SỬA CHO NGÀY MAI</div>
        ${fixes.map((f,i) => `
          <div class="fix-card stagger" style="animation-delay:${500+i*100}ms">
            <div class="fix-num">#${i+1}</div>
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
  requestAnimationFrame(() => setTimeout(() => {
    const gauge = container.querySelector('.gauge-anim');
    if (gauge) gauge.style.strokeDashoffset = gauge.dataset.target;
    container.querySelectorAll('.pillar-fill[data-w],.dt-fill[data-w]').forEach(el => { el.style.width = el.dataset.w+'%'; });
  }, 100));
}


/* ═══════════════════════════════════════════════════════════════════
   9. RENDER — WEEKLY
   ═══════════════════════════════════════════════════════════════════ */

function renderWeekly() {
  const week = weekDates(weekBase);
  const wkStart = ds(week[0]), wkEnd = ds(week[6]);
  document.getElementById('weeklyLabel').textContent = `${fmtDate(wkStart)} – ${fmtDate(wkEnd)}`;
  document.getElementById('weekRange').textContent = `${fmtDate(wkStart)} – ${fmtDate(wkEnd)}`;

  const agg = aggregateRange(week.map(d => ds(d)));
  const container = document.getElementById('weeklyContent');
  if (agg.count===0) { container.innerHTML=`<div class="empty"><div class="empty-icon">○</div><div>Chưa có dữ liệu tuần này.</div></div>`; return; }

  const avgLog = {};
  PILLARS.forEach(p => { const totalMin=agg.sum[p.key].h*60+agg.sum[p.key].m; avgLog[p.key]={h:Math.floor(totalMin/agg.count/60),m:Math.round((totalMin/agg.count)%60)}; });
  avgLog.focus_score=agg.avgFocus; avgLog.sleep_quality=agg.avgSleepQ; avgLog.cognitive_load=0; avgLog.decision_load=0;

  const intent=calcIntentionality(avgLog), lbl=intentLabel(intent), targets=loadTargets();
  const circ=2*Math.PI*32, offset=circ-(intent/100)*circ;
  let html='';

  html += `
    <div class="dash-card glow stagger">
      <div class="dash-section-label">TRUNG BÌNH TUẦN — ${agg.count}/7 ngày đã ghi</div>
      <div class="score-gauge">
        <div class="gauge-circle">
          <svg viewBox="0 0 80 80" width="80" height="80">
            <circle cx="40" cy="40" r="32" fill="none" stroke="#1F2940" stroke-width="6"/>
            <circle cx="40" cy="40" r="32" fill="none" stroke="url(#gradW)" stroke-width="6" stroke-linecap="round"
              stroke-dasharray="${circ}" stroke-dashoffset="${circ}" transform="rotate(-90 40 40)" class="gauge-anim" data-target="${offset}"/>
            <defs><linearGradient id="gradW" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#00E5FF"/><stop offset="100%" stop-color="#B388FF"/></linearGradient></defs>
          </svg>
          <div class="gauge-num"><div class="gauge-val">${intent}</div><div class="gauge-pct">/ 100</div></div>
        </div>
        <div class="gauge-info">
          <div class="gauge-label">TRẠNG THÁI TUẦN</div>
          <div class="gauge-status s-${lbl.tone}">${lbl.text}</div>
          <div class="gauge-desc">${lbl.desc}</div>
        </div>
      </div>
    </div>
  `;

  html += `
    <div class="dash-card stagger">
      <div class="dash-section-label">7 NGÀY · CHẾT ${agg.totalDead.toFixed(1)}h</div>
      <div class="day-grid">
        ${week.map(d => {
          const s=ds(d), log=loadDailyLog(s), today=s===ds(new Date());
          if (!log) return `<div class="day-cell ${today?'today':''}"><div class="day-cell-label">${VND[d.getDay()]}</div><div class="day-cell-num" style="color:var(--tx4)">${d.getDate()}</div></div>`;
          const sc=calcIntentionality(log);
          return `<div class="day-cell has-data ${today?'today':''}"><div class="day-cell-label">${VND[d.getDay()]}</div><div class="day-cell-num">${d.getDate()}</div><div class="day-cell-bar"><div class="day-cell-bar-fill" data-w="${Math.min(100,sc)}" style="width:0"></div></div></div>`;
        }).join('')}
      </div>
    </div>
  `;

  const t={};
  PILLARS.forEach(p => { t[p.key]=toHours(avgLog[p.key]); });
  html += `
    <div class="dash-card stagger">
      <div class="dash-section-label">TB NGÀY vs MỤC TIÊU</div>
      <div class="pillar-list">
        ${PILLARS.map(p => {
          const actual=t[p.key], target=targets[p.key]||1;
          const pct=target>0?Math.round((actual/target)*100):0, fill=Math.min(100,pct);
          const isOver=p.negative&&pct>100;
          const fillStyle=isOver?`width:100%;background:repeating-linear-gradient(45deg,#FF5252,#FF5252 4px,#C0392B 4px,#C0392B 8px)`:`background:linear-gradient(90deg,${p.color},${p.color}AA)`;
          const txt=p.negative?`${actual.toFixed(1)}h / tối đa ${target}h`:`${actual.toFixed(1)}h / ${target}h`;
          return `<div class="pillar"><div class="pillar-head"><div class="pillar-name"><span class="pill-dot" style="background:${p.color}"></span><span>${p.label}</span></div><div class="pillar-time">${txt} <span class="pt-target">(${pct}%)</span></div></div><div class="pillar-track"><div class="pillar-fill" data-w="${fill}" style="${fillStyle};width:0%"></div></div></div>`;
        }).join('')}
      </div>
    </div>
  `;

  container.innerHTML = html;
  requestAnimationFrame(() => setTimeout(() => {
    const gauge=container.querySelector('.gauge-anim'); if (gauge) gauge.style.strokeDashoffset=gauge.dataset.target;
    container.querySelectorAll('.pillar-fill[data-w],.day-cell-bar-fill[data-w]').forEach(el=>{el.style.width=el.dataset.w+'%';});
  }, 100));
}


/* ═══════════════════════════════════════════════════════════════════
   10. RENDER — MONTHLY
   ═══════════════════════════════════════════════════════════════════ */

function renderMonthly() {
  const y=monthBase.getFullYear(), m=monthBase.getMonth();
  document.getElementById('monthlyLabel').textContent = `${VNM_FULL[m]} ${y}`;
  document.getElementById('monthRange').textContent = `${VNM_FULL[m]} ${y}`;

  const days=monthDates(y,m);
  const agg=aggregateRange(days.map(d=>ds(d)));
  const container=document.getElementById('monthlyContent');
  if (agg.count===0) { container.innerHTML=`<div class="empty"><div class="empty-icon">○</div><div>Chưa có dữ liệu tháng này.</div></div>`; return; }

  const avgLog={};
  PILLARS.forEach(p => { const totalMin=agg.sum[p.key].h*60+agg.sum[p.key].m; avgLog[p.key]={h:Math.floor(totalMin/agg.count/60),m:Math.round((totalMin/agg.count)%60)}; });
  avgLog.focus_score=agg.avgFocus; avgLog.sleep_quality=agg.avgSleepQ;

  const intent=calcIntentionality(avgLog), lbl=intentLabel(intent), targets=loadTargets();
  const circ=2*Math.PI*32, offset=circ-(intent/100)*circ;
  let html='';

  html += `
    <div class="dash-card glow stagger">
      <div class="dash-section-label">TRUNG BÌNH THÁNG — ${agg.count}/${days.length} ngày</div>
      <div class="score-gauge">
        <div class="gauge-circle">
          <svg viewBox="0 0 80 80" width="80" height="80">
            <circle cx="40" cy="40" r="32" fill="none" stroke="#1F2940" stroke-width="6"/>
            <circle cx="40" cy="40" r="32" fill="none" stroke="url(#gradM)" stroke-width="6" stroke-linecap="round"
              stroke-dasharray="${circ}" stroke-dashoffset="${circ}" transform="rotate(-90 40 40)" class="gauge-anim" data-target="${offset}"/>
            <defs><linearGradient id="gradM" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#00E5FF"/><stop offset="100%" stop-color="#B388FF"/></linearGradient></defs>
          </svg>
          <div class="gauge-num"><div class="gauge-val">${intent}</div><div class="gauge-pct">/ 100</div></div>
        </div>
        <div class="gauge-info">
          <div class="gauge-label">TRẠNG THÁI THÁNG</div>
          <div class="gauge-status s-${lbl.tone}">${lbl.text}</div>
          <div class="gauge-desc">${lbl.desc}</div>
        </div>
      </div>
    </div>
  `;

  html += `
    <div class="dash-card stagger">
      <div class="dash-section-label">TỔNG GIỜ · ${VNM_FULL[m]} (Chết: ${agg.totalDead.toFixed(0)}h)</div>
      <div class="pillar-list">
        ${PILLARS.map(p => {
          const totalH=agg.sum[p.key].h+agg.sum[p.key].m/60, targetTotal=targets[p.key]*agg.count;
          const pct=targetTotal>0?Math.round((totalH/targetTotal)*100):0, fill=Math.min(100,pct);
          const isOver=p.negative&&pct>100;
          const fillStyle=isOver?`width:100%;background:repeating-linear-gradient(45deg,#FF5252,#FF5252 4px,#C0392B 4px,#C0392B 8px)`:`background:linear-gradient(90deg,${p.color},${p.color}AA)`;
          const txt=p.negative?`${totalH.toFixed(0)}h / tối đa ${targetTotal.toFixed(0)}h`:`${totalH.toFixed(0)}h / ${targetTotal.toFixed(0)}h`;
          return `<div class="pillar"><div class="pillar-head"><div class="pillar-name"><span class="pill-dot" style="background:${p.color}"></span><span>${p.label}</span></div><div class="pillar-time">${txt} <span class="pt-target">(${pct}%)</span></div></div><div class="pillar-track"><div class="pillar-fill" data-w="${fill}" style="${fillStyle};width:0%"></div></div></div>`;
        }).join('')}
      </div>
    </div>
  `;

  container.innerHTML = html;
  requestAnimationFrame(() => setTimeout(() => {
    const gauge=container.querySelector('.gauge-anim'); if (gauge) gauge.style.strokeDashoffset=gauge.dataset.target;
    container.querySelectorAll('.pillar-fill[data-w]').forEach(el=>{el.style.width=el.dataset.w+'%';});
  }, 100));
}


/* ═══════════════════════════════════════════════════════════════════
   11. SETTINGS
   ═══════════════════════════════════════════════════════════════════ */

function renderSettings() {
  const targets=loadTargets();
  document.getElementById('settingsGrid').innerHTML = PILLARS.map(p => `
    <div class="input-row" data-key="${p.key}" style="margin-bottom:8px">
      <div class="input-icon">${p.icon}</div>
      <div class="input-info">
        <div class="input-label">${p.label}</div>
        <div class="input-target">${p.negative?'(tối đa cho phép)':'(mục tiêu mỗi ngày)'}</div>
      </div>
      <div class="input-fields">
        <input class="tm-input" type="number" min="0" max="24" step="0.5" id="tg_${p.key}" value="${targets[p.key]}" style="width:60px">
        <span class="tm-unit">h</span>
      </div>
    </div>
  `).join('');

  PILLARS.forEach(p => {
    const inp=document.getElementById('tg_'+p.key);
    if (inp) inp.addEventListener('change', () => {
      const v=parseFloat(inp.value);
      if (!isNaN(v)&&v>=0) { const t=loadTargets(); t[p.key]=v; saveTargets(t); }
    });
  });
}

function renderAll() {
  renderInput();
  if (currentTab==='daily') renderDaily();
  if (currentTab==='weekly') renderWeekly();
  if (currentTab==='monthly') renderMonthly();
}


/* ═══════════════════════════════════════════════════════════════════
   12. EVENTS
   ═══════════════════════════════════════════════════════════════════ */

function switchTab(tab) {
  if (currentTab===tab) return;
  currentTab=tab;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('on', b.dataset.tab===tab));
  document.querySelectorAll('.page').forEach(p => { if (p.id==='page-'+tab) p.classList.add('on'); else p.classList.remove('on'); });
  if (tab==='daily') renderDaily();
  else if (tab==='weekly') renderWeekly();
  else if (tab==='monthly') renderMonthly();
  else renderInput();
}

function bindEvents() {
  document.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

  document.getElementById('dateBack').addEventListener('click', () => { logDate=shiftDate(logDate,-1); renderInput(); });
  document.getElementById('dateFwd').addEventListener('click',  () => { logDate=shiftDate(logDate,1);  renderInput(); });
  document.getElementById('logDate').addEventListener('change', e => { logDate=e.target.value; renderInput(); });
  document.getElementById('todayLink').addEventListener('click', () => { logDate=ds(new Date()); renderInput(); });
  document.getElementById('saveBtn').addEventListener('click', saveInputForm);

  document.getElementById('dailyBack').addEventListener('click', () => { dailyDate=shiftDate(dailyDate,-1); renderDaily(); });
  document.getElementById('dailyFwd').addEventListener('click',  () => { dailyDate=shiftDate(dailyDate,1);  renderDaily(); });
  document.getElementById('dailyDate').addEventListener('change', e => { dailyDate=e.target.value; renderDaily(); });
  document.getElementById('dailyTodayLink').addEventListener('click', () => { dailyDate=ds(new Date()); renderDaily(); });

  document.getElementById('weekBack').addEventListener('click', () => { weekBase.setDate(weekBase.getDate()-7); renderWeekly(); });
  document.getElementById('weekFwd').addEventListener('click',  () => { weekBase.setDate(weekBase.getDate()+7);  renderWeekly(); });

  document.getElementById('monthBack').addEventListener('click', () => { monthBase.setMonth(monthBase.getMonth()-1); renderMonthly(); });
  document.getElementById('monthFwd').addEventListener('click',  () => { monthBase.setMonth(monthBase.getMonth()+1); renderMonthly(); });

  document.getElementById('settingsBtn').addEventListener('click', () => { renderSettings(); document.getElementById('settingsModal').classList.add('on'); });
  document.getElementById('closeSettings').addEventListener('click', () => { document.getElementById('settingsModal').classList.remove('on'); renderAll(); });
  document.getElementById('settingsModal').addEventListener('click', e => { if (e.target.id==='settingsModal') { document.getElementById('settingsModal').classList.remove('on'); renderAll(); } });

  document.getElementById('exportBtn').addEventListener('click', exportJSON);
  document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', e => { if (e.target.files[0]) importJSON(e.target.files[0]); });
  document.getElementById('resetBtn').addEventListener('click', () => {
    if (confirm('Xoá tất cả dữ liệu? Không thể hoàn tác.')) {
      getAllStorageKeys().forEach(k => localStorage.removeItem(k));
      localStorage.removeItem(ALERT_DISMISS_KEY);
      renderAll(); renderSettings(); toast('Đã reset ✓');
    }
  });

  document.getElementById('phoneAlertModal').addEventListener('click', e => { if (e.target.id==='phoneAlertModal') dismissPhoneAlert(); });
}


/* ═══════════════════════════════════════════════════════════════════
   13. INIT
   ═══════════════════════════════════════════════════════════════════ */

bindEvents();
renderInput();
setTimeout(checkPhoneAlert, 600);
