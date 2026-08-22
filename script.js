// আপনার প্রদানকৃত নতুন Web App URL
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxuUfcicei74kNdvb9ddZ6lV_VBYdEu7WWorgHEctow4v1EIjpa2Y1FFOAXa-70uJBc/exec';

const STORAGE_KEY='family_finance_transactions_v1';
let monthlyChart, expenseChart;
const today=new Date().toISOString().split('T')[0];
document.querySelectorAll('input[type="date"]').forEach(x=>x.value=today);

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

function getData(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY))||[]}catch(e){return[]}}
function saveData(data){localStorage.setItem(STORAGE_KEY,JSON.stringify(data))}
function money(n){return '৳ '+Number(n||0).toLocaleString('en-BD',{minimumFractionDigits:0,maximumFractionDigits:2})}
function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

document.querySelectorAll('.nav button').forEach(btn=>btn.addEventListener('click',()=>{
 document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');
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
   } catch(err) {
     console.error("Google Sheet Sync Failed:", err);
   }
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
 if(!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.trim() === ''){
   alert("দয়া করে প্রথমে সঠিক Google Apps Script URL কোডে বসান।");
   return;
 }
 try {
   const res = await fetch(GOOGLE_SCRIPT_URL);
   const data = await res.json();
   if(Array.isArray(data)){
     saveData(data);
     renderDashboard();
    //  alert("গুগল শিট থেকে তথ্য সফলভাবে সিঙ্ক হয়েছে!");
   }
 } catch(err) {
   alert("গুগল শিট থেকে তথ্য আনতে সমস্যা হয়েছে। Apps Script-এ 'Who has access' অপশনটি 'Anyone' দেয়া আছে কি না নিশ্চিত করুন।");
   console.error(err);
 }
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
function deleteAllTransactions(){if(confirm('সতর্কতা: সব আয়-ব্যয়ের হিসাব স্থায়ীভাবে মুছে যাবে। আপনি নিশ্চিত?')){localStorage.removeItem(STORAGE_KEY);renderDashboard();alert('সব হিসাব মুছে ফেলা হয়েছে।')}}
function downloadBackup(){const blob=new Blob([JSON.stringify(getData(),null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='Family_Finance_Backup_'+today+'.json';a.click();URL.revokeObjectURL(a.href)}

// অ্যাপ লোড করার সিকোয়েন্স
renderDashboard();
fetchFromGoogleSheet();