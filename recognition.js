// Local learning only: confirmed reviews are evidence; automatic suggestions never train rules.
const Recognition=(()=>{
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim().replace(/\s+/g,' ');
 function identity(t,ledger,accountId='default'){
  const direction=t.value<0?'out':'in';
  if(ledger==='card'){
   if(t.kind==='payment')return null;
   const merchant=norm(t.description);
   if(!merchant)return null;
   return {key:['card',t.cardId||'',merchant].join('|'),label:t.description,strength:'automatic'};
  }
  const desc=norm(t.description),details=t.details||[];
  const scope=['bank',t.accountId||accountId,direction,desc];
  const party=details.find(s=>/^(FAV\.|REM\.):\s*\S/.test(s));
  if(party)return {key:[...scope,norm(party)].join('|'),label:party,strength:'automatic'};
  const merchant=details.find(s=>! /^(DOC\.:|Pagamento Pix|Recebimento Pix|Transferência Pix|\*|CPF:|SAQ\.DIG\.|Registro manual)/i.test(s) && /[A-Za-zÀ-ÿ]{3}/.test(s));
  if(/COMPRA/.test(desc)&&merchant)return {key:[...scope,norm(merchant)].join('|'),label:merchant,strength:'automatic'};
  const namedDoc=details.find(s=>/^DOC\.:/.test(s)&&/[A-Za-z]{3}/.test(s.replace(/^DOC\.:\s*/,''))&&!/^DOC\.:\s*(Pix|IOF|LC[-/])/i.test(s));
  if(namedDoc&&!/PIX|TIT COMPE/.test(desc))return {key:[...scope,norm(namedDoc)].join('|'),label:namedDoc.replace(/^DOC\.:\s*/,''),strength:'automatic'};
  if(/IOF|JUROS CHQ ESPECIAL/.test(desc))return {key:scope.join('|'),label:t.description,strength:'automatic'};
  // Generic boleto/Pix text does not identify a beneficiary. Amount can only suggest.
  return {key:[...scope,'amount',Math.round(Math.abs(t.value)*100)].join('|'),label:t.description+' · valor de referência',strength:'suggestion'};
 }
 function train(state){
  const evidence=new Map((state.recognitionEvidence||[]).map(e=>[e.id,e]));
  for(const ledger of ['bank','card'])for(const t of ledger==='bank'?state.bankTransactions:state.cardTransactions){
   const id=ledger+':'+t.id;evidence.delete(id);
   if(!t.categoryConfirmed||!t.category||t.category==='A revisar')continue;
   const match=identity(t,ledger,state.accounts?.[0]?.id);if(!match)continue;
   evidence.set(id,{id,recordId:t.id,ledger,...match,category:t.category,note:t.note||''});
  }
  const groups=new Map();for(const e of evidence.values()){if(!groups.has(e.key))groups.set(e.key,[]);groups.get(e.key).push(e);}
  state.recognitionEvidence=[...evidence.values()];
  state.recognitionRules=[...groups.entries()].map(([key,entries])=>{const cats=[...new Set(entries.map(e=>e.category))];return {key,label:entries[0].label,ledger:entries[0].ledger,strength:entries[0].strength,categories:cats,category:cats.length===1?cats[0]:null,conflict:cats.length>1,evidenceCount:entries.length};});
  return state.recognitionRules;
 }
 function apply(state){
  const rules=new Map((state.recognitionRules||[]).map(r=>[r.key,r]));let automatic=0,suggestions=0;
  for(const ledger of ['bank','card'])for(const t of ledger==='bank'?state.bankTransactions:state.cardTransactions){
   if(t.categoryConfirmed)continue;
   if(t.categorySource==='learned'){t.category=t.categoryBeforeRule||'A revisar';delete t.categorySource;delete t.recognitionRule;delete t.categoryBeforeRule;}
   delete t.recognitionSuggestion;
   if(t.recognitionDisabled)continue;
   const match=identity(t,ledger,state.accounts?.[0]?.id),rule=match&&rules.get(match.key);
   if(!rule||rule.conflict||!rule.category)continue;
   if(rule.strength==='automatic'){
    t.categoryBeforeRule=t.category;t.category=rule.category;t.categorySource='learned';t.recognitionRule=rule.key;automatic++;
   }else{t.recognitionSuggestion={category:rule.category,reason:'Histórico genérico e valor semelhante; confirme o beneficiário.'};suggestions++;}
  }
  return {automatic,suggestions};
 }
 function refresh(state){train(state);return apply(state);}
 return {identity,train,apply,refresh};
})();
if(typeof module!=='undefined')module.exports=Recognition;
