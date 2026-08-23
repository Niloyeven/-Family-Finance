const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxuUfcicei74kNdvb9ddZ6lV_VBYdEu7WWorgHEctow4v1EIjpa2Y1FFOAXa-70uJBc/exec';
const ADMIN_EMAIL = "niloyeven@gmail.com"; 

let currentUser = null;
let monthlyChart, expenseChart;
const today = new Date().toISOString().split('T')[0];
document.querySelectorAll('input[type="date"]').forEach(x => x.value = today); 

// Theme Manager
const themeBtn = document.getElementById('themeToggleBtn');
const themeText = document.getElementById('themeBtnText');

function initTheme() {
  const savedTheme = localStorage.getItem('ff_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeUI(savedTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const nextTheme = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', nextTheme);
  localStorage.setItem('ff_theme', nextTheme);
  updateThemeUI(nextTheme);
  renderDashboard();
}

function updateThemeUI(theme) {
  if (themeBtn && themeText) {
    themeBtn.querySelector('i').className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    themeText.innerText = theme === 'dark' ? 'লাইট মোড' : 'নাইট মোড';
  }
}

if(themeBtn) themeBtn.addEventListener('click', toggleTheme);
initTheme();

// Data Storage Management
function getUsers() { 
  try { 
    let users = JSON.parse(localStorage.getItem('ff_users'));
    if(!users) {
      users = {};
      users[ADMIN_EMAIL] = { password: "123456", sheetUrl: GOOGLE_SCRIPT_URL, createdAt: new Date().toISOString() };
      localStorage.setItem('ff_users', JSON.stringify(users));
    }
    return users; 
  } catch(e) { return {}; } 
}

function getUserStorageKey() { return currentUser ? 'ff_data_' + currentUser : null; }
function getData() {
  const key = getUserStorageKey();
  if(!key) return [];
  try { return JSON.parse(localStorage.getItem(key)) || []; } catch(e){ return []; }
}
function saveData(data) {
  const key = getUserStorageKey();
  if(key) localStorage.setItem(key, JSON.stringify(data));
}

// Session Auto Setup
const savedSession = localStorage.getItem('ff_current_session');
currentUser = savedSession || ADMIN_EMAIL;
document.getElementById('userInfo').innerHTML = `<i class="fa-solid fa-circle-user"></i> ${currentUser}`;

function money(n) { return '৳ ' + Number(n||0).toLocaleString('bn-BD', {minimumFractionDigits: 0, maximumFractionDigits: 2}); }
function esc(s) { return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }

// Page Navigation
document.querySelectorAll('.nav button[data-page]').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.nav button[data-page]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(btn.dataset.page).classList.add('active');
  if(btn.dataset.page === 'dashboard') renderDashboard();
  if(btn.dataset.page === 'transactions') renderTransactions();
  if(btn.dataset.page === 'budget-goals') renderBudgetsAndGoals();
}));

// Transaction Actions with Google Sheet Auto-Sync
async function addTransaction(type, form, btnId) {
  const btn = document.getElementById(btnId);
  const originalText = btn.innerHTML;
  btn.innerText = "সংরক্ষণ করা হচ্ছে...";
  btn.disabled = true;

  const fd = new FormData(form);
  const t = {
    id: Date.now(),
    user: currentUser,
    type,
    amount: Number(fd.get('amount')),
    category: fd.get('category').trim(),
    method: fd.get('method'),
    date: fd.get('date'),
    note: fd.get('note').trim(),
    createdAt: new Date().toISOString()
  };

  // 1. Save to LocalStorage
  const data = getData();
  data.push(t);
  saveData(data);

  // Check budget alert if type is expense
  if(type === 'expense') {
    checkBudgetExceeded(t.category, t.date);
  }

  // 2. Sync to Google Sheet Apps Script
  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors', // Avoid CORS block
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(t)
    });
  } catch(err) {
    console.error("Google Sheet Sync Error: ", err);
  }

  form.reset();
  form.querySelector('[name="date"]').value = today;
  btn.innerHTML = originalText;
  btn.disabled = false;

  alert(type === 'income' ? 'আয় সফলভাবে রেকর্ড ও গুগল শিটে সিঙ্ক করা হয়েছে!' : 'ব্যয় সফলভাবে রেকর্ড ও গুগল শিটে সিঙ্ক করা হয়েছে!');
  renderDashboard();
}

document.getElementById('incomeForm').addEventListener('submit', e => { e.preventDefault(); addTransaction('income', e.target, 'incomeBtn'); });
document.getElementById('expenseForm').addEventListener('submit', e => { e.preventDefault(); addTransaction('expense', e.target, 'expenseBtn'); });

// Fetch Data from Google Sheet
async function fetchFromGoogleSheet() {
  try {
    const res = await fetch(GOOGLE_SCRIPT_URL);
    const data = await res.json();
    if(Array.isArray(data)) {
      saveData(data); 
      renderDashboard();
      alert('গুগল শিট থেকে তথ্য সফলভাবে আপডেট হয়েছে!');
    }
  } catch(err) { 
    console.error("Fetch Error:", err);
    alert('গুগল শিট থেকে ডাটা আনবে ব্যর্থ হয়েছে। Apps Script অ্যাক্সেস চেক করুন।');
  }
}

// Ultra Realistic Dynamic Charts Rendering
function renderDashboard() {
  const d = getData(), now = new Date(), ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const inc = d.filter(x => x.type === 'income').reduce((s, x) => s + x.amount, 0);
  const exp = d.filter(x => x.type === 'expense').reduce((s, x) => s + x.amount, 0);
  const mi = d.filter(x => x.type === 'income' && x.date.startsWith(ym)).reduce((s, x) => s + x.amount, 0);
  const me = d.filter(x => x.type === 'expense' && x.date.startsWith(ym)).reduce((s, x) => s + x.amount, 0);
  
  document.getElementById('totalIncome').textContent = money(inc);
  document.getElementById('totalExpense').textContent = money(exp);
  document.getElementById('balance').textContent = money(inc - exp);
  document.getElementById('monthIncome').textContent = money(mi);
  document.getElementById('monthExpense').textContent = money(me);

  const recent = [...d].sort((a,b) => b.date.localeCompare(a.date) || b.id - a.id).slice(0, 10);
  document.getElementById('recentTransactions').innerHTML = recent.length ? tableHtml(recent, false) : '<div class="empty">এখনো কোনো হিসাব পাওয়া যায়নি।</div>';
  
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  // 1. Line/Area Chart (Smooth Curves & Gradients)
  const monthlyCtx = document.getElementById('monthlyChart').getContext('2d');
  const months = {};
  d.forEach(x => {
    const m = x.date.slice(0, 7);
    if(!months[m]) months[m] = { income: 0, expense: 0 };
    months[m][x.type] += x.amount;
  });
  const labels = Object.keys(months).sort().slice(-12);
  const incomes = labels.map(m => months[m].income);
  const expenses = labels.map(m => months[m].expense);

  const incGradient = monthlyCtx.createLinearGradient(0, 0, 0, 300);
  incGradient.addColorStop(0, 'rgba(52, 211, 153, 0.4)');
  incGradient.addColorStop(1, 'rgba(52, 211, 153, 0.0)');

  const expGradient = monthlyCtx.createLinearGradient(0, 0, 0, 300);
  expGradient.addColorStop(0, 'rgba(248, 113, 113, 0.4)');
  expGradient.addColorStop(1, 'rgba(248, 113, 113, 0.0)');

  if(monthlyChart) monthlyChart.destroy();
  monthlyChart = new Chart(monthlyCtx, {
    type: 'line',
    data: {
      labels: labels.length ? labels : ['কোনো ডাটা নেই'],
      datasets: [
        {
          label: 'আয়',
          data: incomes.length ? incomes : [0],
          borderColor: '#34d399',
          borderWidth: 3,
          backgroundColor: incGradient,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 8
        },
        {
          label: 'ব্যয়',
          data: expenses.length ? expenses : [0],
          borderColor: '#f87171',
          borderWidth: 3,
          backgroundColor: expGradient,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor, font: { family: 'Plus Jakarta Sans', weight: 'bold' } } }
      },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor } },
        y: { grid: { color: gridColor }, ticks: { color: textColor } }
      }
    }
  });
  
  // 2. Modern Doughnut Chart
  const expenseCtx = document.getElementById('expenseChart').getContext('2d');
  const cats = {};
  d.filter(x => x.type === 'expense').forEach(x => cats[x.category] = (cats[x.category] || 0) + x.amount);

  if(expenseChart) expenseChart.destroy();
  expenseChart = new Chart(expenseCtx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(cats).length ? Object.keys(cats) : ['ডাটা নেই'],
      datasets: [{
        data: Object.values(cats).length ? Object.values(cats) : [1],
        backgroundColor: ['#38bdf8', '#f87171', '#34d399', '#fbbf24', '#a78bfa', '#f472b6'],
        borderWidth: 4,
        borderColor: isDark ? '#1e293b' : '#ffffff',
        hoverOffset: 12
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { position: 'right', labels: { color: textColor, font: { family: 'Plus Jakarta Sans', weight: '600' } } }
      }
    }
  });
}

function tableHtml(items, showActions) {
  if(!items.length) return '<div class="empty">কোনো লেনদেন পাওয়া যায়নি।</div>';
  return `<div class="table-wrap"><table><thead><tr><th>তারিখ</th><th>টাইপ</th><th>খাত / উদ্দেশ্য</th><th>মেথড</th><th>পরিমাণ</th><th>নোট</th>${showActions ? '<th>অ্যাকশন</th>' : ''}</tr></thead><tbody>` +
  items.map(x => `<tr>
    <td><b>${esc(x.date)}</b></td>
    <td><span class="badge ${x.type === 'income' ? 'in' : 'ex'}">${x.type === 'income' ? 'আয়' : 'ব্যয়'}</span></td>
    <td>${esc(x.category)}</td>
    <td>${esc(x.method)}</td>
    <td><b>${money(x.amount)}</b></td>
    <td>${esc(x.note)}</td>
    ${showActions ? `<td><button class="btn red small" onclick="deleteOne(${x.id})">Delete</button></td>` : ''}
  </tr>`).join('') + '</tbody></table></div>';
}

function renderTransactions() {
  let d = getData(), type = document.getElementById('typeFilter').value, month = document.getElementById('monthFilter').value, q = document.getElementById('searchFilter').value.trim().toLowerCase();
  if(type !== 'all') d = d.filter(x => x.type === type);
  if(month) d = d.filter(x => x.date.startsWith(month));
  if(q) d = d.filter(x => (x.category + ' ' + x.note + ' ' + x.method).toLowerCase().includes(q));
  d.sort((a,b) => b.date.localeCompare(a.date) || b.id - a.id);
  document.getElementById('allTransactions').innerHTML = tableHtml(d, true);
}

['typeFilter', 'monthFilter', 'searchFilter'].forEach(id => {
  const el = document.getElementById(id);
  if(el) el.addEventListener('input', renderTransactions);
});

function clearFilters() {
  document.getElementById('typeFilter').value = 'all';
  document.getElementById('monthFilter').value = '';
  document.getElementById('searchFilter').value = '';
  renderTransactions();
}

function deleteOne(id) {
  if(confirm('এই লেনদেনটি মুছে ফেলার বিষয়ে নিশ্চিত?')) {
    saveData(getData().filter(x => x.id !== id));
    renderTransactions();
    renderDashboard();
  }
}

function deleteAllTransactions() {
  if(confirm('সতর্কতা: আপনার সকল স্থানীয় ডাটা চিরতরে মুছে যাবে!')) {
    saveData([]);
    renderDashboard();
    alert('সকল ডাটা সফলভাবে মুছে ফেলা হয়েছে।');
  }
}

function downloadBackup() {
  const blob = new Blob([JSON.stringify(getData(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Finance_Backup_' + currentUser + '_' + today + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ----------------------------------------------------------------
// NEW FEATURES: Budget, Savings Goal, and CSV Export Functions
// ----------------------------------------------------------------

function getBudgets() {
  try { return JSON.parse(localStorage.getItem('ff_budgets_' + currentUser)) || {}; } catch(e){ return {}; }
}
function saveBudgets(data) {
  localStorage.setItem('ff_budgets_' + currentUser, JSON.stringify(data));
}

function getGoals() {
  try { return JSON.parse(localStorage.getItem('ff_goals_' + currentUser)) || []; } catch(e){ return []; }
}
function saveGoals(data) {
  localStorage.setItem('ff_goals_' + currentUser, JSON.stringify(data));
}

// Save Budget
document.getElementById('budgetForm')?.addEventListener('submit', e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const cat = fd.get('category').trim();
  const amt = Number(fd.get('amount'));
  
  const budgets = getBudgets();
  budgets[cat] = amt;
  saveBudgets(budgets);
  e.target.reset();
  renderBudgetsAndGoals();
  alert(`"${cat}" ক্যাটাগরির জন্য বাজেট সেভ হয়েছে!`);
});

// Delete Budget Limit
function deleteBudget(cat) {
  if(confirm(`আপনি কি "${cat}" ক্যাটাগরির বাজেট মুছে ফেলতে চান?`)) {
    const budgets = getBudgets();
    delete budgets[cat];
    saveBudgets(budgets);
    renderBudgetsAndGoals();
  }
}

// Save Savings Goal
document.getElementById('goalForm')?.addEventListener('submit', e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const goal = {
    id: Date.now(),
    title: fd.get('title').trim(),
    target: Number(fd.get('target')),
    saved: Number(fd.get('saved')) || 0
  };
  
  const goals = getGoals();
  goals.push(goal);
  saveGoals(goals);
  e.target.reset();
  renderBudgetsAndGoals();
  alert('নতুন সঞ্চয় লক্ষ্য সফলভাবে যোগ করা হয়েছে!');
});

// Delete Goal
function deleteGoal(id) {
  if(confirm('এই সঞ্চয় লক্ষ্যটি মুছে ফেলতে চান?')) {
    const goals = getGoals().filter(g => g.id !== id);
    saveGoals(goals);
    renderBudgetsAndGoals();
  }
}

// Check if expense exceeds budget limit
function checkBudgetExceeded(cat, dateStr) {
  const budgets = getBudgets();
  if(!budgets[cat]) return;

  const ym = dateStr.slice(0, 7);
  const totalSpent = getData()
    .filter(x => x.type === 'expense' && x.category.toLowerCase() === cat.toLowerCase() && x.date.startsWith(ym))
    .reduce((s, x) => s + x.amount, 0);

  if(totalSpent > budgets[cat]) {
    setTimeout(() => {
      alert(`⚠️ সতর্কবার্তা: চলতি মাসে "${cat}" খাতে আপনার নির্ধারিত বাজেট (${money(budgets[cat])}) অতিক্রম করেছে! বর্তমান মোট ব্যয়: ${money(totalSpent)}`);
    }, 200);
  }
}

// Render Budget & Savings Goals UI
function renderBudgetsAndGoals() {
  const d = getData(), now = new Date(), ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const budgets = getBudgets();
  const goals = getGoals();
  
  // Calculate expenses per category for current month
  const monthExp = {};
  d.filter(x => x.type === 'expense' && x.date.startsWith(ym)).forEach(x => {
    const key = x.category.trim();
    monthExp[key] = (monthExp[key] || 0) + x.amount;
  });

  // Render Budgets Progress
  let bHtml = '';
  const cats = Object.keys(budgets);
  if(!cats.length) {
    bHtml = '<div class="empty">কোনো ক্যাটাগরি বাজেট যুক্ত করা হয়নি।</div>';
  } else {
    cats.forEach(c => {
      const limit = budgets[c];
      const spent = monthExp[c] || 0;
      const pct = Math.min(Math.round((spent / limit) * 100), 100);
      const isExceeded = spent > limit;
      
      bHtml += `
        <div class="progress-card">
          <div class="progress-header">
            <span><b>${esc(c)}</b> ${isExceeded ? '<span class="badge ex">⚠️ বাজেট ছাড়িয়েছে</span>' : ''}</span>
            <div>
              <span>${money(spent)} / ${money(limit)}</span>
              <button class="btn red small" style="margin-left: 8px;" onclick="deleteBudget('${esc(c)}')"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>
          <div class="progress-bar">
            <div class="progress-fill ${isExceeded ? 'danger' : ''}" style="width: ${pct}%"></div>
          </div>
        </div>`;
    });
  }
  const budgetListEl = document.getElementById('budgetList');
  if(budgetListEl) budgetListEl.innerHTML = bHtml;

  // Render Savings Goals
  let gHtml = '';
  if(!goals.length) {
    gHtml = '<div class="empty">কোনো সঞ্চয় লক্ষ্য যোগ করা হয়নি।</div>';
  } else {
    goals.forEach(g => {
      const pct = Math.min(Math.round((g.saved / g.target) * 100), 100);
      gHtml += `
        <div class="progress-card">
          <div class="progress-header">
            <span><b>🎯 ${esc(g.title)}</b></span>
            <button class="btn red small" onclick="deleteGoal(${g.id})"><i class="fa-solid fa-trash"></i></button>
          </div>
          <div style="font-size: 13px; color: var(--text-muted); margin: 6px 0;">
            জমা: ${money(g.saved)} / টার্গেট: ${money(g.target)} (${pct}%)
          </div>
          <div class="progress-bar">
            <div class="progress-fill success" style="width: ${pct}%"></div>
          </div>
        </div>`;
    });
  }
  const goalListEl = document.getElementById('goalList');
  if(goalListEl) goalListEl.innerHTML = gHtml;
}

// Export Data to Excel/CSV
function exportToCSV() {
  const data = getData();
  if (!data.length) {
    alert('এক্সপোর্ট করার মতো কোনো লেনদেন পাওয়া যায়নি!');
    return;
  }
  
  let csvContent = "\uFEFFতারিখ,টাইপ,খাত/উদ্দেশ্য,মেথড,পরিমাণ,নোট\n";
  data.forEach(x => {
    csvContent += `"${x.date}","${x.type === 'income' ? 'আয়' : 'ব্যয়'}","${x.category}","${x.method}","${x.amount}","${x.note || ''}"\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Transaction_Report_${currentUser}_${today}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

renderDashboard();
