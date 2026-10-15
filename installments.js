// Derive future installments from the paid reference invoice, not original purchase dates.
const Installments=(()=>{
 const cents=n=>Math.round(n*100);
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
 function forecastRows(state){
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
  return rows;
 }
 return {schedule,dueAfter,forecastRows};
})();
if(typeof module!=='undefined')module.exports=Installments;
