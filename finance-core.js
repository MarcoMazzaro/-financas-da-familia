/* Shared accounting rules. Bank cash, card spending and asset positions are separate ledgers. */
const FinanceCore = (() => {
  const cents = value => Math.round(Number(value) * 100);
  const sum = rows => rows.reduce((s, r) => s + cents(r.value), 0) / 100;
  function cashBalance(account, rows, cutoff) {
    return (cents(account.openingBalance) + rows.filter(t => t.date > account.openingDate && t.date <= cutoff && !t.future).reduce((s,t)=>s+cents(t.value),0)) / 100;
  }
  function invoiceTotal(card, rows) { return (cents(card.openingInvoice) + rows.filter(t=>t.cardId===card.id).reduce((s,t)=>s+cents(t.value),0))/100; }
  function cardSpending(rows) { return sum(rows.filter(t=>t.kind!=='payment')); }
  function cashSeries(account, rows, cutoff, period='day', includeFuture=false) {
    const eligible=rows.filter(t=>t.date>account.openingDate && (t.date<=cutoff&&!t.future || includeFuture&&t.date>cutoff));
    const end=includeFuture?eligible.reduce((last,t)=>t.date>last?t.date:last,cutoff):cutoff;
    const day=new Date(account.openingDate+'T00:00:00Z');day.setUTCDate(day.getUTCDate()+1);
    const groups=[];let balance=cents(account.openingBalance),count=0;
    while(day.toISOString().slice(0,10)<=end){
      const date=day.toISOString().slice(0,10),daily=eligible.filter(t=>t.date===date);
      const credit=daily.filter(t=>t.value>0).reduce((s,t)=>s+cents(t.value),0),debit=-daily.filter(t=>t.value<0).reduce((s,t)=>s+cents(t.value),0);
      balance+=credit-debit;
      const key=period==='month'?date.slice(0,7):String(Math.floor(count/({week:7,fortnight:15}[period]||1)));
      let group=groups.at(-1);
      // Split at the reporting date so forecast values never color actual data.
      const forecast=date>cutoff;
      if(!group||group.key!==key||group.forecast!==forecast){group={key,from:date,to:date,credit:0,debit:0,balance:balance/100,forecast};groups.push(group);}
      group.to=date;group.credit+=credit/100;group.debit+=debit/100;group.balance=balance/100;
      count++;day.setUTCDate(day.getUTCDate()+1);
    }
    return groups.map(g=>({...g,credit:cents(g.credit)/100,debit:cents(g.debit)/100}));
  }
  function mergeRecords(existing, incoming) {
    const map = new Map(existing.map(r=>[r.id,r])); let added=0,duplicates=0;
    for(const record of incoming) {
      if(!record.id || !Number.isFinite(record.value)) throw Error('Registro sem identificador ou valor válido.');
      const old=map.get(record.id);
      if(old) {
        if(old.value!==record.value || old.description!==record.description || old.date!==record.date) throw Error('Conflito com registro já importado: '+record.id);
        duplicates++;
      } else {map.set(record.id,record);added++;}
    }
    return {records:[...map.values()],added,duplicates};
  }
  function validate(d) {
    if(d.schemaVersion!==2 || !Array.isArray(d.bankTransactions) || !Array.isArray(d.cardTransactions) || !Array.isArray(d.investmentSnapshots) || !Array.isArray(d.accounts) || !d.accounts.length || !Array.isArray(d.cards) || !Array.isArray(d.investmentIncome) || !Array.isArray(d.investmentCrossReferences) || !Array.isArray(d.checks) || !Array.isArray(d.sources) || !Array.isArray(d.findings)) throw Error('Formato de dados incompatível.');
    for(const list of [d.bankTransactions,d.cardTransactions]){
      const ids=new Set();
      for(const r of list){if(!r.id||ids.has(r.id)||!Number.isFinite(r.value)||typeof r.description!=='string')throw Error('Valor inválido ou registro duplicado.');ids.add(r.id);}
    }
    for(const a of d.accounts)if(!Number.isFinite(a.openingBalance)||!/^\d{4}-\d{2}-\d{2}$/.test(a.openingDate))throw Error('Conta inválida.');
    for(const c of d.cards)if(!Number.isFinite(c.openingInvoice)||!Number.isFinite(c.invoiceTotal))throw Error('Fatura inválida.');
    for(const t of d.bankTransactions)if(!Array.isArray(t.details)||!/^\d{4}-\d{2}-\d{2}$/.test(t.date))throw Error('Movimento bancário inválido.');
    for(const s of d.investmentSnapshots)if(!Array.isArray(s.positions)||!Number.isFinite(s.total))throw Error('Posição inválida.');
    if(d.recognitionEvidence!==undefined&&!Array.isArray(d.recognitionEvidence))throw Error('Regras de reconhecimento inválidas.');
    return true;
  }
  return {sum,cashBalance,invoiceTotal,cardSpending,cashSeries,mergeRecords,validate};
})();
if(typeof module!=='undefined') module.exports=FinanceCore;
