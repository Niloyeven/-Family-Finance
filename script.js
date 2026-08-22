const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxuUfcicei74kNdvb9ddZ6lV_VBYdEu7WWorgHEctow4v1EIjpa2Y1FFOAXa-70uJBc/exec';

let isRegisterMode = false;
let currentUser = null;
let monthlyChart, expenseChart;
const today = new Date().toISOString().split('T')[0];
document.querySelectorAll('input[type="date"]').forEach(x => x.value = today); 

// DOM Elements
const totalIncomeEl = document.getElementById('totalIncome');
const totalExpenseEl = document.getElementById('totalExpense');
const balanceEl = document.getElementById('balance');
const monthIncomeEl = document.getElementById('monthIncome');
const monthExpenseEl = document.getElementById('monthExpense');
const recentTransactionsEl = document.getElementById('recentTransactions');
const allTransactionsEl = document.getElementById('allTransactions');
const typeFilterEl = document.getElementById('typeFilter');
const monthFilterEl = document.getElementById('monthFilter');
const searchFilterEl = document.getElementById('searchFilter');
const userInfoEl = document.getElementById('userInfo');

// Multi-User Local Storage Handlers
function getUsers(){ try { return JSON.parse(localStorage.getItem('ff_users')) || {}; } catch(e){ return {}; } }
function saveUsers(users){ localStorage.setItem('ff_users', JSON.stringify(users)); }

function getUserStorageKey(){ return currentUser ? 'ff_data_' + currentUser : null; }
function getData(){
  const key = getUserStorageKey();
  if(!key) return [];
  try { return JSON.parse(localStorage.getItem(key)) || []; } catch(e){ return []; }
}
function saveData(data){
  const key = getUserStorageKey();
  if(key) localStorage.setItem(key, JSON.stringify(data));
}

// Authentication Logic
function toggleAuthMode(){
  isRegisterMode = !isRegisterMode;
  document.getElementById('authTitle').innerText = isRegisterMode ? '📝 নতুন অ্যাকাউন্ট তৈরি' : '🔑 লগইন করুন';
  document.getElementById('authSub').innerText = isRegisterMode ? 'অ্যাকাউন্ট খুলতে ইমেইল ও পাসওয়ার্ড দিন' : 'আপনার ড্যাশবোর্ডে প্রবেশ করতে লগইন করুন';
  document.getElementById('authSubmitBtn').innerText = isRegisterMode ? 'অ্যাকাউন্ট তৈরি করুন' : 'লগইন করুন';
  document.getElementById('toggleText').innerText = isRegisterMode ? 'আগে থেকেই অ্যাকাউন্ট আছে?' : 'একাউন্ট নেই?';
  document.getElementById('toggleBtn').innerText = isRegisterMode ? 'লগইন করুন' : 'নতুন অ্যাকাউন্ট তৈরি করুন';
}

function handleAuth(e){
  e.preventDefault();
  const email = document.getElementById('authEmail').value.trim().toLowerCase();
  const pass = document.getElementById('authPassword').value;
  const users = getUsers();

  if(isRegisterMode){
    if(users[email]) return alert('এই ইমেইল দিয়ে ইতোমধ্যে অ্যাকাউন্ট খোলা আছে!');
    users[email] = { password: pass, createdAt: new Date().toISOString() };
    saveUsers(users);
    alert('অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে! এখন লগইন করুন।');
    toggleAuthMode();
  } else {
    if(!users[email] || users[email].password !== pass){
      return alert('ভুল ইমেইল অথবা পাসওয়ার্ড দিয়েছেন!');
    }
    currentUser = email;
    localStorage.setItem('ff_current_session', currentUser);
    initUserSession();
  }
}

function initUserSession(){
  document.getElementById('authSection').style.display = 'none';
  userInfoEl.innerHTML = `<i class="fa-solid fa-user"></i> ${currentUser}`;
  renderDashboard();
  fetchFromGoogleSheet();
}

function logoutUser(){
  currentUser = null;
  localStorage.removeItem('ff_current_session');
  document.getElementById('authSection').style.display = 'flex';
  document.getElementById('authForm').reset();
}

// Auto Session Check
const savedSession = localStorage.getItem('ff_current_session');
if(savedSession && getUsers()[savedSession]){
  currentUser = savedSession;
  initUserSession();
} else {
  document.getElementById('authSection').style.display = 'flex';
}

function money(n){return '৳ '+Number(n||0).toLocaleString('en-BD',{minimumFractionDigits:0,maximumFractionDigits:2})}
function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

document.querySelectorAll('.nav button[data-page]').forEach(btn=>btn.addEventListener('click',()=>{
 document.querySelectorAll('.nav button[data-page]').forEach(b=>b.classList.remove('active'));btn.classList.add('active');
 document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));document.getElementById(btn.dataset.page).classList.add('active');
 if(btn.dataset.page==='dashboard') renderDashboard();
 if(btn.dataset.page==='transactions') renderTransactions();
}));

async function addTransaction(type,form,btnId){
 const btn = document.getElementById(btnId);
 const originalText = btn.innerText;
 btn.innerText = "সংরক্ষণ হচ্ছে...";
 btn.disabled = true;

 const fd=new FormData(form);
 const t={
   id:Date.now(),
   user: currentUser,
   type,
   amount:Number(fd.get('amount')),
   category:fd.get('category').trim(),
   method:fd.get('method'),
   date:fd.get('date'),
   note:fd.get('note').trim(),
   createdAt:new Date().toISOString()
 };

 const data=getData();data.push(t);saveData(data);

 if(GOOGLE_SCRIPT_URL && GOOGLE_SCRIPT_URL.trim() !== ''){
   try {
     await fetch(GOOGLE_SCRIPT_URL, {
       method: 'POST',
       mode: 'no-cors',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify(t)
     });
   } catch(err) { console.error("Google Sheet Sync Failed:", err); }
 }

 form.reset();form.querySelector('[name="date"]').value=today;
 btn.innerText = originalText;
 btn.disabled = false;

 alert(type==='income'?'আয় সফলভাবে সংরক্ষণ হয়েছে।':'ব্যয় সফলভাবে সংরক্ষণ হয়েছে।');
 renderDashboard();
}

document.getElementById('incomeForm').addEventListener('submit',e=>{e.preventDefault();addTransaction('income',e.target,'incomeBtn')});
document.getElementById('expenseForm').addEventListener('submit',e=>{e.preventDefault();addTransaction('expense',e.target,'expenseBtn')});

async function fetchFromGoogleSheet(){
 if(!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.trim() === '') return;
 try {
   const res = await fetch(GOOGLE_SCRIPT_URL);
   const data = await res.json();
   if(Array.isArray(data)){
     const userOnlyData = data.filter(x => !x.user || x.user === currentUser);
     if(userOnlyData.length) { saveData(userOnlyData); renderDashboard(); }
   }
 } catch(err) { console.error(err); }
}

function renderDashboard(){
 const d=getData(), now=new Date(), ym=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
 const inc=d.filter(x=>x.type==='income').reduce((s,x)=>s+x.amount,0);
 const exp=d.filter(x=>x.type==='expense').reduce((s,x)=>s+x.amount,0);
 const mi=d.filter(x=>x.type==='income'&&x.date.startsWith(ym)).reduce((s,x)=>s+x.amount,0);
 const me=d.filter(x=>x.type==='expense'&&x.date.startsWith(ym)).reduce((s,x)=>s+x.amount,0);
 
 totalIncomeEl.textContent=money(inc);
 totalExpenseEl.textContent=money(exp);
 balanceEl.textContent=money(inc-exp);
 monthIncomeEl.textContent=money(mi);
 monthExpenseEl.textContent=money(me);

 const recent=[...d].sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id).slice(0,10);
 recentTransactionsEl.innerHTML=recent.length?tableHtml(recent,false):'<div class="empty">এখনো কোনো হিসাব যোগ করা হয়নি।</div>';
 
 const months={};d.forEach(x=>{const m=x.date.slice(0,7);if(!months[m])months[m]={income:0,expense:0};months[m][x.type]+=x.amount});
 const labels=Object.keys(months).sort().slice(-12), incomes=labels.map(m=>months[m].income), expenses=labels.map(m=>months[m].expense);
 if(monthlyChart)monthlyChart.destroy();monthlyChart=new Chart(document.getElementById('monthlyChart'),{type:'bar',data:{labels,datasets:[{label:'আয়',data:incomes,backgroundColor:'#16a34a'},{label:'ব্যয়',data:expenses,backgroundColor:'#dc2626'}]},options:{responsive:true,plugins:{legend:{position:'top'}}}});
 
 const cats={};d.filter(x=>x.type==='expense').forEach(x=>cats[x.category]=(cats[x.category]||0)+x.amount);
 if(expenseChart)expenseChart.destroy();expenseChart=new Chart(document.getElementById('expenseChart'),{type:'doughnut',data:{labels:Object.keys(cats),datasets:[{data:Object.values(cats)}]},options:{responsive:true,plugins:{legend:{position:'bottom'}}}});
}

function tableHtml(items,showActions){
 if(!items.length)return '<div class="empty">কোনো হিসাব পাওয়া যায়নি।</div>';
 return `<div class="table-wrap"><table><thead><tr><th>তারিখ</th><th>ধরন</th><th>উদ্দেশ্য / খাত</th><th>মাধ্যম</th><th>পরিমাণ</th><th>নোট</th>${showActions?'<th>Action</th>':''}</tr></thead><tbody>`+
 items.map(x=>`<tr><td>${esc(x.date)}</td><td><span class="badge ${x.type==='income'?'in':'ex'}">${x.type==='income'?'আয়':'ব্যয়'}</span></td><td>${esc(x.category)}</td><td>${esc(x.method)}</td><td>${money(x.amount)}</td><td>${esc(x.note)}</td>${showActions?`<td><button class="btn red small" onclick="deleteOne(${x.id})">Delete</button></td>`:''}</tr>`).join('')+'</tbody></table></div>';
}

function renderTransactions(){
 let d=getData(),type=typeFilterEl.value,month=monthFilterEl.value,q=searchFilterEl.value.trim().toLowerCase();
 if(type!=='all')d=d.filter(x=>x.type===type);if(month)d=d.filter(x=>x.date.startsWith(month));if(q)d=d.filter(x=>(x.category+' '+x.note+' '+x.method).toLowerCase().includes(q));
 d.sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);allTransactionsEl.innerHTML=tableHtml(d,true);
}

[typeFilterEl,monthFilterEl,searchFilterEl].forEach(x=>x.addEventListener('input',renderTransactions));

function clearFilters(){typeFilterEl.value='all';monthFilterEl.value='';searchFilterEl.value='';renderTransactions()}
function deleteOne(id){if(confirm('এই হিসাবটি মুছে ফেলতে চান?')){saveData(getData().filter(x=>x.id!==id));renderTransactions();renderDashboard()}}
function deleteAllTransactions(){if(confirm('সতর্কতা: আপনার সব হিসাব মুছে যাবে। আপনি কি নিশ্চিত?')){saveData([]);renderDashboard();alert('সব হিসাব মুছে ফেলা হয়েছে।')}}
function downloadBackup(){const blob=new Blob([JSON.stringify(getData(),null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='Finance_Backup_'+currentUser+'_'+today+'.json';a.click();URL.revokeObjectURL(a.href)}
