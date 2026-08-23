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
  renderDashboard(); // Re-render charts with correct color themes
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
      users[ADMIN_EMAIL] = { password: "123456", sheetUrl: "", createdAt: new Date().toISOString() };
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
}));

// Transaction Actions
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

  const data = getData();
  data.push(t);
  saveData(data);

  form.reset();
  form.querySelector('[name="date"]').value = today;
  btn.innerHTML = originalText;
  btn.disabled = false;

  alert(type === 'income' ? 'আয় সফলভাবে রেকর্ড করা হয়েছে!' : 'ব্যয় সফলভাবে রেকর্ড করা হয়েছে!');
  renderDashboard();
}

document.getElementById('incomeForm').addEventListener('submit', e => { e.preventDefault(); addTransaction('income', e.target, 'incomeBtn'); });
document.getElementById('expenseForm').addEventListener('submit', e => { e.preventDefault(); addTransaction('expense', e.target, 'expenseBtn'); });

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

  // Gradient Fills
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

renderDashboard();
