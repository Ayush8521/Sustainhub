/* ============================================================
   SustainHub – app.js (Firebase Edition)
   All data now saved to Firestore database (cloud backend)
   ============================================================ */

import { auth, db } from './firebase.js';
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

'use strict';

/* ─────────────────────────────────────────────
   GLOBALS
───────────────────────────────────────────── */
let currentUser = null;

/* ─────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────── */
function showToast(msg, duration = 3500) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

function showLoading(show, msg = 'Saving...') {
  let el = document.getElementById('global-loader');
  if (!el) {
    el = document.createElement('div');
    el.id = 'global-loader';
    el.className = 'global-loader';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.display = show ? 'flex' : 'none';
}

/* ─────────────────────────────────────────────
   AUTH GUARD — runs on every page
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const page = location.pathname.split('/').pop() || 'index.html';
  const publicPages = ['login.html'];

  onAuthStateChanged(auth, (user) => {
    if (!user && !publicPages.includes(page)) {
      // Not logged in → go to login
      window.location.href = 'login.html';
      return;
    }

    if (user) {
      currentUser = user;
      updateNavUser(user);
    }

    // Hamburger
    const burger = document.getElementById('hamburger');
    const links = document.querySelector('.nav-links');
    if (burger && links) burger.addEventListener('click', () => links.classList.toggle('open'));

    // Securely attach the logout listener here
    const logoutBtn = document.querySelector('.btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try {
          await signOut(auth);
          window.location.href = 'login.html';
        } catch (error) {
          console.error("Error signing out:", error);
        }
      });
    }

    // Dispatch page init
    if (page === 'index.html' || page === '')  initHome();
    if (page === 'calculator.html')             initCalculator();
    if (page === 'tracker.html')                initTracker();
    if (page === 'challenges.html')             initChallenges();
    if (page === 'tips.html')                   initTips();
  });
});

function updateNavUser(user) {
  const nameEl = document.getElementById('nav-username');
  if (nameEl) nameEl.textContent = user.displayName || user.email.split('@')[0];
}


/* ─────────────────────────────────────────────
   FIRESTORE HELPERS
───────────────────────────────────────────── */
function userCol(colName) {
  return collection(db, 'users', currentUser.uid, colName);
}

function userDoc(colName, docId) {
  return doc(db, 'users', currentUser.uid, colName, docId);
}

/* ─────────────────────────────────────────────
   HOME PAGE
───────────────────────────────────────────── */
function initHome() {
  const el = document.getElementById('co2-counter');
  if (!el) return;
  const target = 4.7;
  let cur = 0;
  const step = target / 60;
  const iv = setInterval(() => {
    cur += step;
    if (cur >= target) { cur = target; clearInterval(iv); }
    el.textContent = cur.toFixed(1);
  }, 20);
}

/* ─────────────────────────────────────────────
   CALCULATOR
───────────────────────────────────────────── */
let currentStep = 1;

function initCalculator() {}

function nextStep(n) { goToStep(n); }
function prevStep(n) { goToStep(n); }

function goToStep(n) {
  document.querySelectorAll('.calc-step').forEach(s => s.classList.remove('active'));
  const target = document.getElementById('step-' + n) || document.getElementById('step-result');
  if (target) target.classList.add('active');
  document.querySelectorAll('.prog-step').forEach(s => {
    const sn = parseInt(s.dataset.step);
    s.classList.remove('active', 'done');
    if (sn < n) s.classList.add('done');
    if (sn === n) s.classList.add('active');
  });
  currentStep = n;
}

function calculateFootprint() {
  const bill  = parseFloat(document.getElementById('electricity-bill').value) || 0;
  const lpg   = parseFloat(document.getElementById('lpg-use').value) || 0;
  const ac    = parseFloat(document.getElementById('ac-use').value) || 0;
  const home  = parseFloat(document.getElementById('home-type').value) || 1;

  const kwhPerMonth = bill / 7;
  const energyCO2   = ((kwhPerMonth * 0.82 * 12) / 1000) * home;
  const lpgCO2      = lpg * 1.5 * 0.001;
  const acCO2       = (ac / 24) * 365 * 1.5 * 0.001;
  const energyTotal = energyCO2 + lpgCO2 + acCO2;

  const tMode          = parseFloat(document.getElementById('transport-mode').value) || 0.5;
  const km             = parseFloat(document.getElementById('travel-km').value) || 10;
  const flights        = parseFloat(document.getElementById('flight-freq').value) || 0;
  const transportTotal = (tMode * km * 365) / 1000 + flights;

  const diet      = parseFloat(document.getElementById('diet-type').value) || 1.3;
  const foodWaste = parseFloat(document.getElementById('food-waste').value) || 0.5;
  const localFood = parseFloat(document.getElementById('local-food').value) || 0;
  const foodTotal = diet + foodWaste + localFood;

  const recycle    = parseFloat(document.getElementById('recycle').value) || 0;
  const shopping   = parseFloat(document.getElementById('shopping').value) || 0.5;
  const plastics   = parseFloat(document.getElementById('plastics').value) || 0.2;
  const wasteTotal = recycle + shopping + plastics + 0.5;

  const grand = energyTotal + transportTotal + foodTotal + wasteTotal;
  showResults(grand, energyTotal, transportTotal, foodTotal, wasteTotal);
}

function showResults(total, energy, transport, food, waste) {
  goToStep('result');
  const t = Math.round(total * 10) / 10;

  let cur = 0;
  const scoreEl = document.getElementById('result-score');
  const iv = setInterval(() => {
    cur += t / 50;
    if (cur >= t) { cur = t; clearInterval(iv); }
    scoreEl.textContent = cur.toFixed(1);
  }, 20);

  document.getElementById('cmp-yours').textContent = t.toFixed(1) + ' tons';

  let level, emoji, msg;
  const levelEl = document.getElementById('result-level');
  if (t < 1.5) {
    level = '🌟 Excellent – Climate Champion'; emoji = '🌟';
    levelEl.style.cssText = 'background:#d1fae5;color:#065f46';
    msg = 'Outstanding! Your footprint is well below India\'s average. Keep inspiring others!';
  } else if (t < 2.5) {
    level = '✅ Good – Below Average'; emoji = '✅';
    levelEl.style.cssText = 'background:#dcfce7;color:#166534';
    msg = 'Great work! A few more adjustments to transport and diet can bring you even lower.';
  } else if (t < 4.7) {
    level = '⚠️ Average – Room to Improve'; emoji = '⚠️';
    levelEl.style.cssText = 'background:#fef9c3;color:#713f12';
    msg = 'You\'re near the world average. Focus on transport and diet for the biggest impact.';
  } else if (t < 8) {
    level = '🔴 High – Action Needed'; emoji = '🔴';
    levelEl.style.cssText = 'background:#fee2e2;color:#991b1b';
    msg = 'Consider using public transport, reducing meat, and minimising air travel.';
  } else {
    level = '🚨 Very High – Urgent Change Needed'; emoji = '🚨';
    levelEl.style.cssText = 'background:#fecaca;color:#7f1d1d';
    msg = 'Start with the biggest changes: car/flight travel, plant-based diet, energy at home.';
  }

  document.getElementById('result-level').textContent = level;
  document.getElementById('result-emoji').textContent = emoji;
  document.getElementById('result-message').textContent = msg;

  const max = Math.max(energy, transport, food, waste, 1);
  setBar('bar-energy', 'val-energy', energy, max);
  setBar('bar-transport', 'val-transport', transport, max);
  setBar('bar-food', 'val-food', food, max);
  setBar('bar-waste', 'val-waste', waste, max);

  // Cache for saving
  window._lastResult = { total: t, energy, transport, food, waste };
}

function setBar(barId, valId, val, max) {
  const pct = Math.round((val / max) * 100);
  setTimeout(() => { document.getElementById(barId).style.width = pct + '%'; }, 100);
  document.getElementById(valId).textContent = val.toFixed(2) + ' t';
}

// ── SAVE TO FIRESTORE ────────────────────────────────────────
window.saveResult = async function() {
  if (!window._lastResult) { showToast('Calculate your footprint first!'); return; }
  if (!currentUser) { showToast('Please login first!'); return; }

  showLoading(true, 'Saving to database...');
  try {
    await addDoc(userCol('footprint_logs'), {
      date:      new Date().toISOString().split('T')[0],
      score:     window._lastResult.total,
      energy:    window._lastResult.energy,
      transport: window._lastResult.transport,
      food:      window._lastResult.food,
      waste:     window._lastResult.waste,
      note:      'From Calculator',
      createdAt: serverTimestamp()
    });
    showToast('✅ Saved to your cloud database!');
  } catch (e) {
    showToast('❌ Error saving: ' + e.message);
  }
  showLoading(false);
};

window.resetCalc = function() {
  document.querySelectorAll('.calc-step').forEach(s => s.classList.remove('active'));
  document.getElementById('step-1').classList.add('active');
  document.querySelectorAll('.prog-step').forEach((s, i) => {
    s.classList.remove('active', 'done');
    if (i === 0) s.classList.add('active');
  });
  document.querySelectorAll('input[type="number"]').forEach(i => i.value = '');
  currentStep = 1;
};

// Make calculator functions global
window.nextStep = nextStep;
window.prevStep = prevStep;
window.calculateFootprint = calculateFootprint;

/* ─────────────────────────────────────────────
   TRACKER — reads/writes Firestore
───────────────────────────────────────────── */
let chartInstance = null;

async function initTracker() {
  const d = document.getElementById('log-date');
  if (d) d.value = new Date().toISOString().split('T')[0];
  await renderTracker();
}

window.addLogEntry = async function() {
  const date  = document.getElementById('log-date').value;
  const score = parseFloat(document.getElementById('log-score').value);
  const note  = document.getElementById('log-note').value.trim();

  if (!date)             return showToast('Please select a date');
  if (isNaN(score) || score < 0) return showToast('Please enter a valid score');
  if (!currentUser)      return showToast('Please login first');

  showLoading(true, 'Saving entry...');
  try {
    await addDoc(userCol('footprint_logs'), {
      date,
      score,
      note:      note || '—',
      createdAt: serverTimestamp()
    });
    document.getElementById('log-score').value = '';
    document.getElementById('log-note').value  = '';
    showToast('✅ Entry saved to cloud!');
    await renderTracker();
  } catch (e) {
    showToast('❌ Error: ' + e.message);
  }
  showLoading(false);
};

window.deleteLog = async function(docId) {
  if (!confirm('Delete this entry?')) return;
  showLoading(true, 'Deleting...');
  try {
    await deleteDoc(userDoc('footprint_logs', docId));
    showToast('🗑️ Entry deleted');
    await renderTracker();
  } catch (e) {
    showToast('❌ Error: ' + e.message);
  }
  showLoading(false);
};

async function renderTracker() {
  if (!currentUser) return;

  showLoading(true, 'Loading your data...');
  let logs = [];
  try {
    const q    = query(userCol('footprint_logs'), orderBy('date', 'asc'));
    const snap = await getDocs(q);
    logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    showToast('Error loading data: ' + e.message);
  }
  showLoading(false);

  // Summary stats
  document.getElementById('days-tracked').textContent = logs.length;
  if (logs.length) {
    const avg  = logs.reduce((s, l) => s + l.score, 0) / logs.length;
    const best = Math.min(...logs.map(l => l.score));
    const saved = Math.max(0, (4.7 - avg) * logs.length * (1000 / 365));
    document.getElementById('avg-footprint').textContent = avg.toFixed(1);
    document.getElementById('best-day').textContent      = best.toFixed(1);
    document.getElementById('co2-saved').textContent     = Math.round(saved);
  } else {
    document.getElementById('avg-footprint').textContent = '–';
    document.getElementById('best-day').textContent      = '–';
    document.getElementById('co2-saved').textContent     = '0';
  }

  // Chart
  const chartEmpty = document.getElementById('chart-empty');
  const canvas     = document.getElementById('footprint-chart');
  if (logs.length) {
    chartEmpty.style.display = 'none';
    canvas.style.display     = 'block';
    renderChart(logs);
  } else {
    chartEmpty.style.display = 'block';
    canvas.style.display     = 'none';
  }

  // Table
  const tbody = document.getElementById('log-tbody');
  tbody.innerHTML = '';
  if (!logs.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#aaa;padding:2rem;">No entries yet. Use the calculator to get started!</td></tr>';
  } else {
    [...logs].reverse().forEach(log => {
      const lv = getLevel(log.score);
      tbody.innerHTML += `
        <tr>
          <td>${log.date}</td>
          <td><strong>${log.score.toFixed(1)}</strong></td>
          <td><span class="level-badge ${lv.cls}">${lv.label}</span></td>
          <td>${log.note}</td>
          <td><button class="delete-btn" onclick="deleteLog('${log.id}')">🗑️</button></td>
        </tr>`;
    });
  }

  updateAchievements(logs);
}

function getLevel(score) {
  if (score < 1.5) return { cls: 'level-excellent', label: 'Excellent 🌟' };
  if (score < 2.5) return { cls: 'level-good',      label: 'Good ✅' };
  if (score < 4.7) return { cls: 'level-average',   label: 'Average ⚠️' };
  return               { cls: 'level-high',      label: 'High 🔴' };
}

function renderChart(logs) {
  const canvas = document.getElementById('footprint-chart');
  if (!canvas) return;
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: logs.map(l => l.date),
      datasets: [
        { label: 'Your Footprint (tons/yr)', data: logs.map(l => l.score), borderColor: '#2d7a4f', backgroundColor: 'rgba(45,122,79,0.1)', fill: true, tension: 0.3, pointRadius: 5, pointBackgroundColor: '#2d7a4f' },
        { label: 'India Average (1.9)',       data: logs.map(() => 1.9),    borderColor: '#3498db', borderDash: [5,5], borderWidth: 1.5, pointRadius: 0 },
        { label: 'World Average (4.7)',       data: logs.map(() => 4.7),    borderColor: '#e74c3c', borderDash: [5,5], borderWidth: 1.5, pointRadius: 0 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + ctx.parsed.y.toFixed(1) + ' tons/yr' } } },
      scales: { y: { beginAtZero: true, title: { display: true, text: 'tons CO₂/yr' }, grid: { color: 'rgba(0,0,0,0.05)' } }, x: { grid: { display: false } } }
    }
  });
}

function updateAchievements(logs) {
  const avg  = logs.length ? logs.reduce((s, l) => s + l.score, 0) / logs.length : 99;
  const best = logs.length ? Math.min(...logs.map(l => l.score)) : 99;
  let improvements = 0;
  for (let i = 1; i < logs.length; i++) if (logs[i].score < logs[i-1].score) improvements++;

  const unlock = id => { const el = document.getElementById(id); if (el) { el.classList.remove('locked'); el.classList.add('unlocked'); } };
  if (logs.length >= 1)  unlock('ach-first');
  if (logs.length >= 7)  unlock('ach-week');
  if (best < 2)          unlock('ach-low');
  if (improvements >= 3) unlock('ach-improve');
  if (logs.length >= 30) unlock('ach-month');
  if (avg < 1.9)         unlock('ach-green');
}

/* ─────────────────────────────────────────────
   CHALLENGES — saved to Firestore
───────────────────────────────────────────── */
const CHALLENGES = [
  { id: 'ch1',  icon: '🚶', title: 'Walk or Cycle to Work',       desc: 'Avoid using a vehicle for one full day.',                                      difficulty: 'easy',   duration: '1 Day',   impact: 'Saves ~0.3 kg CO₂',    badge: '🚶' },
  { id: 'ch2',  icon: '🥗', title: 'Meatless Monday',             desc: 'Go completely meat-free for one day.',                                          difficulty: 'easy',   duration: '1 Day',   impact: 'Saves ~1.5 kg CO₂',    badge: '🥗' },
  { id: 'ch3',  icon: '💡', title: 'Unplug for a Night',          desc: 'Turn off all unnecessary electronics and lights for one evening.',              difficulty: 'easy',   duration: '1 Evening', impact: 'Saves ~0.2 kg CO₂', badge: '💡' },
  { id: 'ch4',  icon: '♻️', title: 'Zero Waste Day',              desc: 'Produce as little waste as possible for one full day.',                         difficulty: 'medium', duration: '1 Day',   impact: 'Saves ~0.5 kg CO₂',    badge: '♻️' },
  { id: 'ch5',  icon: '🚌', title: 'Public Transport Week',       desc: 'Use only public transport for an entire week.',                                 difficulty: 'medium', duration: '7 Days',  impact: 'Saves ~3.5 kg CO₂',    badge: '🚌' },
  { id: 'ch6',  icon: '🌱', title: '5-Minute Shower Challenge',   desc: 'Take showers of 5 minutes or less for a week.',                                difficulty: 'easy',   duration: '7 Days',  impact: 'Saves ~1 kg CO₂',      badge: '🌱' },
  { id: 'ch7',  icon: '🛍️', title: 'No Single-Use Plastic Week', desc: 'Avoid all single-use plastics for 7 days.',                                    difficulty: 'medium', duration: '7 Days',  impact: 'Saves ~0.8 kg CO₂',    badge: '🛍️' },
  { id: 'ch8',  icon: '🌿', title: 'Plant-Based Diet Week',       desc: 'Eat only plant-based food for one full week.',                                  difficulty: 'hard',   duration: '7 Days',  impact: 'Saves ~10 kg CO₂',     badge: '🌿' },
  { id: 'ch9',  icon: '🚗', title: 'Car-Free Week',               desc: 'Do not use a private car for 7 days.',                                          difficulty: 'hard',   duration: '7 Days',  impact: 'Saves ~15 kg CO₂',     badge: '🚗' },
  { id: 'ch10', icon: '🏠', title: 'Energy Audit at Home',        desc: 'Identify and reduce 3 sources of unnecessary energy use in your home.',         difficulty: 'medium', duration: '1 Day',   impact: 'Saves ~2 kg CO₂/week', badge: '🏠' },
  { id: 'ch11', icon: '🛒', title: 'Buy Local Month',             desc: 'For 30 days, buy only locally grown/produced food.',                            difficulty: 'hard',   duration: '30 Days', impact: 'Saves ~5 kg CO₂',      badge: '🛒' },
  { id: 'ch12', icon: '🌳', title: 'Plant a Tree or Seed',        desc: 'Plant at least one tree, sapling, or seed this week.',                          difficulty: 'easy',   duration: '1 Week',  impact: 'Absorbs 20 kg CO₂/yr', badge: '🌳' },
];

let currentFilter = 'all';
let completedChallenges = [];

async function initChallenges() {
  if (!currentUser) return;
  showLoading(true, 'Loading challenges...');
  try {
    const snap = await getDocs(userCol('completed_challenges'));
    completedChallenges = snap.docs.map(d => d.id);
  } catch (e) { console.error(e); }
  showLoading(false);
  renderChallenges();
  updateBadges();
}

window.filterChallenges = function(type) {
  currentFilter = type;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.filter-btn').forEach(b => {
    if (type === 'all' && b.textContent.includes('All')) b.classList.add('active');
    if (type !== 'all' && b.textContent.toLowerCase().includes(type)) b.classList.add('active');
  });
  renderChallenges();
};

function renderChallenges() {
  const grid     = document.getElementById('challenges-grid');
  if (!grid) return;
  const filtered = currentFilter === 'all' ? CHALLENGES : CHALLENGES.filter(c => c.difficulty === currentFilter);

  grid.innerHTML = filtered.map(ch => {
    const done = completedChallenges.includes(ch.id);
    return `
      <div class="challenge-card ${done ? 'completed' : ''}">
        ${done ? '<div class="ch-completed-badge">✅ Completed</div>' : ''}
        <div class="ch-icon">${ch.icon}</div>
        <div class="ch-title">${ch.title}</div>
        <div class="ch-desc">${ch.desc}</div>
        <div class="ch-meta">
          <span class="ch-tag ${ch.difficulty}">${ch.difficulty.charAt(0).toUpperCase() + ch.difficulty.slice(1)}</span>
          <span class="ch-tag">⏱ ${ch.duration}</span>
        </div>
        <div class="ch-impact">🌍 ${ch.impact}</div>
        <button class="ch-complete-btn ${done ? 'done' : ''}" onclick="completeChallenge('${ch.id}')" ${done ? 'disabled' : ''}>
          ${done ? '✅ Challenge Completed!' : '✔ Mark as Completed'}
        </button>
      </div>`;
  }).join('');
}

window.completeChallenge = async function(id) {
  if (completedChallenges.includes(id)) return;
  showLoading(true, 'Saving...');
  try {
    await setDoc(userDoc('completed_challenges', id), {
      completedAt: serverTimestamp(),
      challengeId: id
    });
    completedChallenges.push(id);
    const ch = CHALLENGES.find(c => c.id === id);
    showToast('🏆 Challenge completed! Badge earned: ' + ch.badge);
    renderChallenges();
    updateBadges();
  } catch (e) {
    showToast('❌ Error: ' + e.message);
  }
  showLoading(false);
};

function updateBadges() {
  const display = document.getElementById('badges-display');
  const count   = document.getElementById('badge-count');
  if (!display) return;
  count.textContent = completedChallenges.length;
  if (!completedChallenges.length) {
    display.innerHTML = '<div class="badge-empty">Complete challenges to earn badges here!</div>';
    return;
  }
  display.innerHTML = completedChallenges.map(id => {
    const ch = CHALLENGES.find(c => c.id === id);
    return ch ? `<div class="earned-badge" title="${ch.title}">${ch.badge}</div>` : '';
  }).join('');
}

/* ─────────────────────────────────────────────
   TIPS (static — no DB needed)
───────────────────────────────────────────── */
const TIPS = [
  { cat: 'energy',    icon: '💡', title: 'Switch to LED bulbs',           body: 'LED bulbs use up to 80% less energy than incandescent ones and last 25x longer.',                                                    impact: 'Saves ~0.3 tons CO₂/yr'     },
  { cat: 'energy',    icon: '❄️', title: 'Set AC to 24°C',                body: 'Setting your AC to 24°C instead of 18°C can save 30–40% of electricity.',                                                           impact: 'Saves ~0.5 tons CO₂/yr'     },
  { cat: 'energy',    icon: '🔌', title: 'Unplug idle electronics',        body: 'TVs, chargers, and appliances on standby consume phantom power. Unplug when not in use.',                                           impact: 'Saves ~0.1 tons CO₂/yr'     },
  { cat: 'energy',    icon: '☀️', title: 'Explore solar energy',           body: 'Rooftop solar panels can reduce household electricity bills by 70–90% in India.',                                                   impact: 'Saves up to 2 tons CO₂/yr'  },
  { cat: 'energy',    icon: '🌬️', title: 'Use natural ventilation',        body: 'Open windows in the morning/evening for cross-ventilation instead of using cooling.',                                               impact: 'Saves ~0.2 tons CO₂/yr'     },
  { cat: 'transport', icon: '🚌', title: 'Use public transport',           body: 'Taking a bus or metro instead of a private car can reduce transport emissions by 60–80%.',                                          impact: 'Saves ~1.5 tons CO₂/yr'     },
  { cat: 'transport', icon: '🚲', title: 'Cycle for short trips',          body: 'Trips under 5 km are ideal for cycling — zero emissions, better health, saves fuel money.',                                         impact: 'Saves ~0.8 tons CO₂/yr'     },
  { cat: 'transport', icon: '🤝', title: 'Carpool with colleagues',        body: 'Sharing a ride with 3 other people cuts per-person transport emissions by 75%.',                                                    impact: 'Saves ~0.6 tons CO₂/yr'     },
  { cat: 'transport', icon: '⚡', title: 'Consider an electric vehicle',   body: 'EVs produce 50–70% less lifecycle emissions than petrol cars in India.',                                                            impact: 'Saves ~1.2 tons CO₂/yr'     },
  { cat: 'transport', icon: '✈️', title: 'Reduce air travel',              body: 'A single domestic flight can emit 150–300 kg CO₂. Consider trains for trips under 1000 km.',                                       impact: 'Saves ~0.5–3 tons CO₂/trip' },
  { cat: 'food',      icon: '🥗', title: 'Eat more plant-based meals',     body: 'Replacing meat with lentils, beans, or tofu even 3 days/week makes a big difference.',                                             impact: 'Saves ~0.5 tons CO₂/yr'     },
  { cat: 'food',      icon: '🥕', title: 'Buy seasonal local produce',     body: 'Local, seasonal food requires less transport. Visit local sabzi mandis and farmers\' markets.',                                     impact: 'Saves ~0.2 tons CO₂/yr'     },
  { cat: 'food',      icon: '🍱', title: 'Reduce food waste',              body: 'About 30% of food produced globally is wasted. Plan meals, store food properly, compost scraps.',                                   impact: 'Saves ~0.3 tons CO₂/yr'     },
  { cat: 'food',      icon: '🌾', title: 'Try millets over rice/wheat',    body: 'Millets like jowar, bajra, and ragi need far less water and fertilizer than rice or wheat.',                                        impact: 'Saves ~0.1 tons CO₂/yr'     },
  { cat: 'waste',     icon: '♻️', title: 'Segregate your waste',           body: 'Separate wet (organic) and dry (recyclable) waste every day and compost food scraps at home.',                                      impact: 'Saves ~0.2 tons CO₂/yr'     },
  { cat: 'waste',     icon: '🛍️', title: 'Bring your own bag',            body: 'Plastic bags take 400–1000 years to decompose. Keep a reusable bag in your backpack or vehicle.',                                   impact: 'Prevents 300+ plastic bags/yr'},
  { cat: 'waste',     icon: '💧', title: 'Use a reusable water bottle',    body: 'A stainless steel bottle eliminates 150+ single-use plastic bottles per year.',                                                     impact: 'Prevents 150+ bottles/yr'   },
  { cat: 'waste',     icon: '👕', title: 'Buy less, buy better',           body: 'Fast fashion is one of the world\'s most polluting industries. Buy fewer, better-quality items.',                                   impact: 'Saves ~0.5 tons CO₂/yr'     },
  { cat: 'waste',     icon: '🌱', title: 'Start home composting',          body: 'Composting kitchen waste returns nutrients to soil and prevents landfill methane. Takes 2 minutes a day.',                          impact: 'Saves ~0.1 tons CO₂/yr'     },
];

let currentTipFilter = 'all';
let dailyTipIndex    = 0;

function initTips() {
  dailyTipIndex = Math.floor(Date.now() / 86400000) % TIPS.length;
  renderDailyTip();
  renderTips();
}

function renderDailyTip() {
  const el  = document.getElementById('tip-of-day-content');
  if (!el) return;
  const tip = TIPS[dailyTipIndex % TIPS.length];
  el.innerHTML = `<strong>${tip.icon} ${tip.title}:</strong> ${tip.body} <em style="opacity:0.7"> — ${tip.impact}</em>`;
}

window.newTip = function() {
  dailyTipIndex = (dailyTipIndex + 1) % TIPS.length;
  renderDailyTip();
};

window.filterTips = function(cat) {
  currentTipFilter = cat;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.filter-btn').forEach(b => {
    if (cat === 'all' && b.textContent.includes('All')) b.classList.add('active');
    if (cat !== 'all' && b.textContent.toLowerCase().includes(cat)) b.classList.add('active');
  });
  renderTips();
};

function renderTips() {
  const grid = document.getElementById('tips-grid');
  if (!grid) return;
  const catLabel = { energy: '⚡ Energy', transport: '🚗 Transport', food: '🥗 Food', waste: '♻️ Waste' };
  const filtered = currentTipFilter === 'all' ? TIPS : TIPS.filter(t => t.cat === currentTipFilter);
  grid.innerHTML = filtered.map(tip => `
    <div class="tip-card">
      <div class="tip-cat">${catLabel[tip.cat]}</div>
      <div class="tip-icon">${tip.icon}</div>
      <div class="tip-title">${tip.title}</div>
      <div class="tip-body">${tip.body}</div>
      <div class="tip-impact">🌍 ${tip.impact}</div>
    </div>`).join('');
}
