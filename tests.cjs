const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const elements = new Map();
const element = id => { if(!elements.has(id)) elements.set(id,{textContent:'',innerHTML:'',addEventListener(){}}); return elements.get(id); };
const context = vm.createContext({console,Date,Number,Set,Error,document:{getElementById:element},data:{investmentStatements:[],investments:[{id:1,name:'CDB',value:100}]},render(){},updateCDI(){},invEstimate(){},editInvestment(){},toggle(){},removeInvestment(){},go(){},persist(){},fmt:String,dateBR:String,escapeHTML:String,iso:d=>d.toISOString().slice(0,10)});
const html=fs.readFileSync('index.html','utf8');
new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
vm.runInContext(fs.readFileSync('upgrade.js','utf8'), context);
async function run() {
  assert.equal(vm.runInContext(`parseStatementCSV('data;tipo;valor;id\\n2026-01-02;rendimento;10,50;abc')[0].value`,context),10.5);
  assert.throws(()=>vm.runInContext(`parseStatementCSV('data;tipo;valor;id\\n2026-02-30;taxa;1;x')`,context));
  assert.throws(()=>vm.runInContext(`parseStatementCSV('data;tipo;valor;id\\n2026-01-02;taxa;1;x\\n2026-01-02;taxa;1;x')`,context));
  context.event={preventDefault(){},target:{investment:{value:'1'},date:{value:'2026-01-02'},balance:{value:'110'},file:{files:[{name:'a.csv',text:async()=> 'data;tipo;valor;id\n2026-01-02;rendimento;10;x'}]}}};
  await vm.runInContext('previewStatement(event)',context);
  assert.equal(context.data.investments[0].value,100,'Preview must not mutate position');
  vm.runInContext('confirmStatement(); confirmStatement()',context);
  assert.equal(context.data.investments[0].value,110);
  assert.equal(context.data.investmentStatements.length,1,'Double confirmation must be idempotent');
  context.event.target.date.value='2026-01-03';
  await vm.runInContext('previewStatement(event)',context);
  assert.equal(vm.runInContext('statementPreview.movements.length',context),0,'Repeated IDs must be skipped');
  context.event.target.file.files[0].text=async()=> 'data;tipo;valor;id\n2026-01-02;rendimento;20;x';
  await vm.runInContext('previewStatement(event)',context);
  assert.equal(vm.runInContext('statementPreview',context),null,'Conflicting IDs must block confirmation');
  assert.equal(context.data.tx,undefined,'Investment import must not create bank transactions');
  console.log('Passed: syntax, CSV validation, preview isolation, double confirmation, deduplication, ID conflict and no bank postings.');
}
run().catch(e=>{console.error(e);process.exitCode=1});
