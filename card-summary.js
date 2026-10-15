const CardSummary=(()=>{
 const cents=n=>Math.round(n*100),total=rows=>rows.reduce((s,r)=>s+cents(r.value),0)/100;
 function person(row){
  const name=String(row.holder||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  if(/\bFLAVIA\b/.test(name))return 'Flávia';if(/\bMARCO\b/.test(name))return 'Marco';return 'Não identificado';
 }
 function groups(rows,key){const map=new Map();for(const r of rows){const label=key(r);map.set(label,(map.get(label)||0)+cents(r.value));}return [...map].map(([label,value])=>({label,value:value/100})).filter(r=>r.value!==0).sort((a,b)=>b.value-a.value);}
 function invoice(rows){
  const spending=rows.filter(r=>r.kind!=='payment'),purchases=spending.filter(r=>['purchase','refund'].includes(r.kind)),charges=spending.filter(r=>!['purchase','refund'].includes(r.kind));
  return {people:groups(purchases,person),categories:groups(spending,r=>r.category||'A revisar'),purchaseTotal:total(purchases),chargeTotal:total(charges),total:total(spending)};
 }
 function month(month){return groups(month.entries||[],r=>r.kind==='fee'?'Anuidade estimada':person(r));}
 return {person,invoice,month};
})();
if(typeof module!=='undefined')module.exports=CardSummary;
