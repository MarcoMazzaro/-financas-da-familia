// Derive future installments from the paid reference invoice, not original purchase dates.
const Installments=(()=>{
 const cents=n=>Math.round(n*100);
 function incomeDueDate(year,month,day,previousBusinessDay=false,extraHolidays=[]){
  const last=new Date(Date.UTC(year,month,0)).getUTCDate(),date=new Date(Date.UTC(year,month-1,Math.min(day,last)));
  if(previousBusinessDay){
   // Gregorian Easter gives the movable banking holidays. Fixed dates follow FEBRABAN.
   const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),n=h+l-7*m+114;
   const easter=new Date(Date.UTC(year,Math.floor(n/31)-1,n%31+1)),holidays=new Set(extraHolidays);
   for(const md of ['01-01','04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-25','12-31'])holidays.add(year+'-'+md);
   for(const offset of [-48,-47,-2,60]){const t=new Date(easter);t.setUTCDate(t.getUTCDate()+offset);holidays.add(t.toISOString().slice(0,10));}
   while([0,6].includes(date.getUTCDay())||holidays.has(date.toISOString().slice(0,10)))date.setUTCDate(date.getUTCDate()-1);
  }
  return date.toISOString().slice(0,10);
 }
 function dueAfter(card,offset){
  const [year,month]=card.dueDate.split('-').map(Number),first=new Date(Date.UTC(year,month-1+offset,1));
  const last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  return [first.getUTCFullYear(),String(first.getUTCMonth()+1).padStart(2,'0'),String(Math.min(card.dueDay||11,last)).padStart(2,'0')].join('-');
 }
 function schedule(card,transactions){
  const months=new Map(),items=[],rows=transactions.filter(t=>t.cardId===card.id);
  for(const t of rows){
   const i=t.installment;
   if(!i||!Number.isInteger(i.current)||!Number.isInteger(i.total)||i.current<1||i.total<=i.current||i.total>120||!Number.isFinite(t.value))continue;
   const purchase=['purchase','refund'].includes(t.kind),fee=t.kind==='fee'&&t.value>0&&/ANUIDADE/i.test(t.description);
   if(!purchase&&!fee)continue;
   const remaining=i.total-i.current,unit=cents(t.value);
   items.push({id:t.id,description:t.description,holder:t.holder,last4:t.last4,current:i.current,total:i.total,remaining,unit:unit/100,balance:unit*remaining/100,firstDue:dueAfter(card,1),lastDue:dueAfter(card,remaining),kind:fee?'fee':unit<0?'refund':'purchase',source:t.source});
   for(let offset=1;offset<=remaining;offset++){
    const due=dueAfter(card,offset);
    if(!months.has(due))months.set(due,{due,purchases:0,credits:0,fees:0,entries:[]});
    const m=months.get(due);if(fee)m.fees+=unit;else if(unit<0)m.credits-=unit;else m.purchases+=unit;
    m.entries.push({id:t.id,holder:t.holder,last4:t.last4,description:t.description,installment:i.current+offset,total:i.total,value:unit/100,kind:fee?'fee':unit<0?'refund':'purchase'});
   }
  }
  const result=[...months.values()].sort((a,b)=>a.due.localeCompare(b.due)).map(m=>({...m,purchases:m.purchases/100,credits:m.credits/100,netPurchases:(m.purchases-m.credits)/100,fees:m.fees/100,total:(m.purchases-m.credits+m.fees)/100}));
  const purchaseTotal=result.reduce((s,m)=>s+cents(m.netPurchases),0)/100,feeTotal=result.reduce((s,m)=>s+cents(m.fees),0)/100;
  return {cardId:card.id,months:result,items,purchaseTotal,feeTotal,total:(cents(purchaseTotal)+cents(feeTotal))/100,reportedDifference:Number.isFinite(card.futureInstallmentBalance)?(cents(purchaseTotal)-cents(card.futureInstallmentBalance))/100:null,nextFieldDifference:result.length&&Number.isFinite(card.nextInstallments)?(cents(card.nextInstallments)-cents(result[0].netPurchases))/100:null,feeRoundingDifference:Number.isFinite(card.futureFeeBalance)?(cents(feeTotal)-cents(card.futureFeeBalance))/100:null};
 }
 function forecastRows(state,endDate){
  const rows=[...state.bankTransactions];
  for(const card of state.cards){
   const brand=/mastercard/i.test(card.name)?'MASTERCARD':/visa/i.test(card.name)?'VISA':null;
   for(const month of schedule(card,state.cardTransactions).months){
    if(month.due<=state.asOf)continue;
    const booked=state.bankTransactions.filter(t=>t.date===month.due&&t.value<0&&(t.cardId===card.id||t.invoiceCardId===card.id||t.kind==='card_payment'&&brand&&[t.description,...(t.details||[])].join(' ').toUpperCase().includes(brand))).reduce((s,t)=>s+cents(-t.value),0);
    const remaining=Math.max(0,cents(month.total)-booked);
    if(remaining)rows.push({id:'forecast:'+card.id+':'+month.due,cardId:card.id,date:month.due,value:-remaining/100,description:'Previsão de parcelas e anuidade · '+card.name,future:true,kind:'card_forecast'});
   }
  }
  const defaultEnd=new Date(state.asOf+'T00:00:00Z');defaultEnd.setUTCFullYear(defaultEnd.getUTCFullYear()+1);
  const horizon=endDate||defaultEnd.toISOString().slice(0,10),accountId=state.accounts?.[0]?.id;
  for(const income of state.recurringIncomes||[]){
   if(income.active===false||income.accountId!==accountId||!Number.isFinite(income.amount)||income.amount<=0||!/^\d{4}-\d{2}-\d{2}$/.test(income.startDate||''))continue;
   const [year,month,day]=income.startDate.split('-').map(Number);
   const start=new Date(state.asOf+'T00:00:00Z');let offset=Math.max(0,(start.getUTCFullYear()-year)*12+start.getUTCMonth()-(month-1));
   for(let guard=0;guard<24;guard++,offset++){
    const first=new Date(Date.UTC(year,month-1+offset,1));
    const due=incomeDueDate(first.getUTCFullYear(),first.getUTCMonth()+1,income.paymentDay||day,income.businessDayRule==='previous',state.additionalHolidays||[]);
    if(due>horizon)break;if(due<=state.asOf||due<income.startDate)continue;
    if(Array.isArray(income.months)&&!income.months.includes(first.getUTCMonth()+1))continue;
    const booked=state.bankTransactions.filter(t=>t.value>0&&t.date===due&&(!t.accountId||t.accountId===income.accountId)&&(t.recurringIncomeId===income.id||t.kind==='salary'&&t.description===income.name)).reduce((s,t)=>s+cents(t.value),0);
    const remaining=Math.max(0,cents(income.amount)-booked);
    if(remaining)rows.push({id:'income-forecast:'+income.id+':'+due,recurringIncomeId:income.id,accountId:income.accountId,date:due,value:remaining/100,description:income.name,future:true,kind:'income_forecast'});
   }
  }
  return rows;
 }
 return {schedule,dueAfter,forecastRows,incomeDueDate};
})();
if(typeof module!=='undefined')module.exports=Installments;
