const assert=require('node:assert/strict'),I=require('./installments.js');
const base={asOf:'2026-10-15',accounts:[{id:'a'}],cards:[],cardTransactions:[],bankTransactions:[],recurringExpenses:[{id:'water',accountId:'a',name:'Conta variável',amount:100,frequency:'monthly',paymentDay:1,businessDayRule:'next',anchorDate:'2026-10-01',active:true,match:{description:'Conta',detailToken:'CONVENIO'}}]};
let rows=I.expenseForecastRows(base,'2026-12-31');assert.equal(rows.length,2);assert.equal(rows[0].date,'2026-11-03','Weekend followed by national holiday moves to next business day');assert.equal(rows[0].value,-100);assert.equal(base.bankTransactions.length,0);
base.bankTransactions.push({id:'booked',date:'2026-11-03',description:'Conta',details:['CONVENIO'],value:-90,future:true});rows=I.expenseForecastRows(base,'2026-12-31');assert.equal(rows.length,1,'A known scheduled bill replaces, not tops up, a variable estimate');
base.recurringExpenses[0].active=false;assert.equal(I.expenseForecastRows(base,'2026-12-31').length,0);
base.recurringExpenses=[{id:'weekly',accountId:'a',name:'Weekly',amount:50,frequency:'weekly',anchorDate:'2026-10-09',active:true,match:{description:'Pix',detailToken:'recipient'}}];
rows=I.expenseForecastRows(base,'2026-10-31');assert.deepEqual(rows.map(t=>t.date),['2026-10-16','2026-10-23','2026-10-30']);assert.equal(rows.reduce((s,t)=>s+t.value,0),-150);
base.bankTransactions.push({id:'weekly-booked',date:'2026-10-23',description:'Pix',details:['recipient'],value:-50,future:true});assert.equal(I.expenseForecastRows(base,'2026-10-31').length,2);
console.log('Passed monthly estimates, next business day, booked bill precedence, no real postings, pause, weekly cadence and duplicate suppression.');
