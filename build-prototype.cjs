// Builds an offline prototype from a user-supplied local dataset. Never commit datasets.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const F=require('./finance-core.js');
const [input,output]=process.argv.slice(2);
if(!input||!output){console.error('Usage: node build-prototype.cjs <private-data.json> <output.html>');process.exit(1);}
const data=JSON.parse(fs.readFileSync(input,'utf8'));F.validate(data);
const core=fs.readFileSync(path.join(__dirname,'finance-core.js'),'utf8'),ui=fs.readFileSync(path.join(__dirname,'prototype-v2.js'),'utf8');
new vm.Script(core);new vm.Script(ui);
const encode=s=>s.replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
let html=fs.readFileSync(path.join(__dirname,'prototype-v2.html'),'utf8');
html=html.replace('__PRIVATE_DATA__',()=>encode(JSON.stringify(data))).replace('__FINANCE_CORE__',()=>core).replace('__RECOGNITION__',()=>fs.readFileSync(path.join(__dirname,'recognition.js'),'utf8')).replace('__INSTALLMENTS__',()=>fs.readFileSync(path.join(__dirname,'installments.js'),'utf8')).replace('__PROTOTYPE_UI__',()=>ui);
fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output,html);
console.log('Local prototype built. Contains private data; do not publish it.');
