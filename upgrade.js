// Preserve existing browser data. Statement positions never create bank transactions.
data.investmentStatements ||= [];
let statementPreview = null;
const originalRender = render;
render = function () {
  data.investmentStatements ||= [];
  originalRender();
  renderCDIState();
  const select = document.getElementById('statementInvestment');
  const selected = select.value;
  select.innerHTML = data.investments.map(i => `<option value="${i.id}">${escapeHTML(i.name)}</option>`).join('');
  select.value = [...select.options].some(o => o.value === selected) ? selected : select.options[0]?.value || '';
  document.getElementById('statementHistory').innerHTML = data.investmentStatements.map(s => `<p>${dateBR(s.date)} · ${escapeHTML(s.name)} · ${fmt(s.balance)} · ${s.movements.length} movimentos registrados</p>`).join('') || '<p>Nenhum extrato de investimento conciliado.</p>';
};
let cdiState = 'loading';
function renderCDIState() {
  if (cdiState === 'error') cdiStatus.textContent = data.cdiDate ? `Consulta indisponível. Última taxa salva: ${data.cdiDate}. Projeção usa essa referência.` : 'Consulta indisponível. Projeção CDI suspensa.';
}
const originalCDI = updateCDI;
updateCDI = async function () {
  await originalCDI();
  cdiState = /sem conexão|Não foi possível/.test(cdiStatus.textContent) ? 'error' : 'ok';
  renderCDIState();
};
investmentFields = function () {
  const equity = ['Ação', 'FII', 'ETF'].includes(invType.value);
  const fixed = invFixed({type: invType.value});
  document.querySelectorAll('.inv-equity').forEach(e => e.hidden = !equity);
  document.querySelectorAll('.inv-fixed').forEach(e => e.hidden = !fixed);
  document.querySelector('[name="fixedRate"]').parentElement.hidden = !fixed;
  document.querySelector('[name="cdiPercent"]').parentElement.hidden = !fixed || invType.value === 'Tesouro Prefixado';
  document.querySelector('[name="maturity"]').parentElement.hidden = !fixed;
  document.querySelector('[name="fixedRate"]').required = invType.value === 'Tesouro Prefixado';
};
const originalEstimate = invEstimate;
invEstimate = function (i) {
  if (i.type === 'Tesouro Selic' && !i.fixedRate) return null;
  if (i.type === 'Tesouro Prefixado' && !i.fixedRate) return null;
  return originalEstimate(i);
};
document.getElementById('statementForm').addEventListener('input', () => {
  statementPreview = null;
  document.getElementById('statementPreview').textContent = 'Dados alterados. Gere uma nova prévia.';
});
const originalEditInvestment = editInvestment;
editInvestment = function(id) { investmentForm.reset(); originalEditInvestment(id); };
const originalToggle = toggle;
toggle = function(id) {
  if (id === 'investmentForm') { cancelInvestment(); investmentForm.hidden = false; investmentFields(); return; }
  originalToggle(id);
};
function parseStatementCSV(text) {
  const delimiter = text.split(/\r?\n/)[0].includes(';') ? ';' : ',';
  const rows = []; let row = [], cell = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let n = 0; n < text.length; n++) {
    const c = text[n];
    if (c === '"') { if (quoted && text[n+1] === '"') { cell += '"'; n++; } else quoted = !quoted; }
    else if (!quoted && (c === delimiter || c === '\n')) { row.push(cell.trim()); cell = ''; if(c === '\n') { rows.push(row); row = []; } }
    else if(c !== '\r') cell += c;
  }
  if(quoted) throw Error('Aspas não fechadas no CSV.');
  row.push(cell.trim()); if(row.some(Boolean)) rows.push(row);
  if(rows.shift()?.join(',') !== 'data,tipo,valor,id') throw Error('Cabeçalho esperado: data;tipo;valor;id');
  const types = ['aplicacao','resgate','rendimento','imposto','taxa'];
  const ids = new Set();
  return rows.filter(r => r.some(Boolean)).map((r, index) => {
    const [date,type,raw,id] = r;
    const value = Number(raw?.replace(',', '.'));
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date;
    if(r.length !== 4 || !validDate || !types.includes(type) || !raw || !Number.isFinite(value) || value < 0 || !id || ids.has(id)) throw Error(`Linha ${index+2}: data, tipo, valor ou ID inválido/repetido.`);
    ids.add(id); return {date,type,value,id};
  });
}
async function previewStatement(event) {
  event.preventDefault(); statementPreview = null;
  const output = document.getElementById('statementPreview');
  try {
    const form = event.target, investmentId = Number(form.investment.value);
    const investment = data.investments.find(i => i.id === investmentId);
    if(!investment) throw Error('Cadastre e selecione a aplicação existente.');
    const date = form.date.value, balance = Number(form.balance.value);
    if(!date || date > iso(new Date()) || !Number.isFinite(balance) || balance < 0) throw Error('Confira a data e o saldo do extrato.');
    const file = form.file.files[0];
    if(!file || !/\.csv$/i.test(file.name)) throw Error('Selecione um CSV no modelo indicado. PDF, Excel e OFX aguardam adaptadores.');
    const movements = parseStatementCSV(await file.text());
    if(movements.some(m => m.date > date)) throw Error('Há movimento posterior à data do extrato.');
    const previous = data.investmentStatements.filter(s => s.investmentId === investmentId);
    if(previous.some(s => s.date >= date)) throw Error('Já existe conciliação nessa data ou posterior. Importe extratos em ordem cronológica.');
    for(const m of movements) {
      const old = previous.flatMap(s => s.movements).find(x => x.id === m.id);
      if(old && (old.date !== m.date || old.type !== m.type || old.value !== m.value)) throw Error(`ID ${m.id} conflita com movimento já conciliado.`);
    }
    const fresh = movements.filter(m => !previous.some(s => s.movements.some(x => x.id === m.id)));
    const expected = Number(investment.value) + fresh.reduce((s,m) => s + (['aplicacao','rendimento'].includes(m.type)?1:-1)*m.value,0);
    statementPreview = {investmentId,date,balance,movements:fresh,name:investment.name,base:Number(investment.value)};
    output.innerHTML = `<p>Saldo cadastrado: ${fmt(investment.value)} · Calculado com novos movimentos: ${fmt(expected)}</p><p>Extrato: ${fmt(balance)} · Diferença: ${fmt(balance-expected)}</p><p>${fresh.length} novos movimentos; ${movements.length-fresh.length} já conciliados. Confirme somente após conferir a diferença. O saldo do extrato será a nova posição; nenhum lançamento bancário será criado.</p><button type="button" class="primary" onclick="confirmStatement()">Confirmar posição do extrato</button>`;
  } catch(error) { output.textContent = error.message; }
}
function confirmStatement() {
  if(!statementPreview) return;
  const s = statementPreview, investment = data.investments.find(i => i.id === s.investmentId);
  if(!investment || Number(investment.value) !== s.base) { statementPreview = null; document.getElementById('statementPreview').textContent = 'A posição mudou. Gere a prévia novamente.'; return; }
  data.investmentStatements.push({...s,confirmedAt:new Date().toISOString()});
  investment.value = s.balance; investment.positionDate = s.date;
  statementPreview = null; document.getElementById('statementPreview').textContent = 'Posição conciliada. Histórico preservado.'; persist();
}
const originalRemoveInvestment = removeInvestment;
removeInvestment = function(id) {
  if(data.investmentStatements.some(s => s.investmentId === id)) { alert('Esta aplicação tem histórico conciliado e não pode ser excluída.'); return; }
  originalRemoveInvestment(id);
};
go('painel');
