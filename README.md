# -financas-da-familia
Despesas financeira de uma família 

## Continuidade no Codex — 15/10/2026

Contexto: conversa “Estrutura controle financeiro”. Prioridades: simplificar investimentos no iPad, CDI oficial automático, conciliação sem duplicidade e revisão de contas/cartões.

A aplicação é uma demonstração estática com dados no localStorage (`familyDemoV1`), sem login ou sincronização. Os dados existentes são preservados.

### Implementado nesta etapa

- Formulário de investimentos em duas colunas em tablets; taxa prefixada e vencimento acessíveis; formulário limpo ao alternar aplicações.
- Consulta existente à série SGS 4389 do Banco Central mantida, com indicação persistente de falha e uso da referência salva. Tesouro Selic não recebe projeção automática baseada em CDI.
- Conciliação de investimentos na aba Conciliação: prévia, diferença de saldo, confirmação explícita e histórico de posições/movimentos, sem criar aplicação nem transação bancária.
- CSV no modelo `data;tipo;valor;id`; data ISO, valores positivos, tipos `aplicacao`, `resgate`, `rendimento`, `imposto`, `taxa`. ID estável por movimento da instituição. Aceita também CSV com vírgulas e campos entre aspas. Valores decimais com vírgula devem usar delimitador ponto e vírgula ou aspas.
- IDs repetidos em extratos posteriores são ignorados; conflitos de conteúdo bloqueiam; posições devem ser conciliadas em ordem cronológica. O saldo informado substitui a posição somente após confirmação. Diferenças são exibidas para revisão, não corrigidas automaticamente.
- Contas bancárias rejeitam nomes vazios ou repetidos. A tela explicita que limite de cartão não é saldo disponível.

### Pendências explícitas

- Validar visualmente no Safari/iPad real, retrato e paisagem. A alteração de CSS ainda não foi validada nesse dispositivo.
- Adaptadores por instituição para PDF, Excel e OFX; amostras anonimizadas necessárias para reconhecer os layouts reais.
- Cadastro próprio de cartões com conta de pagamento, limite, fechamento, vencimento e conciliação de faturas. Contas antigas que representem cartões exigem classificação pelo usuário; não há migração automática.
- Vincular movimentos de aplicação/resgate a transferências bancárias existentes. Nesta etapa o importador não cria lançamentos bancários, evitando duplicação por construção.
- Tributos, vencimentos e rentabilidade líquida nas projeções. Projeções atuais são simplificadas e brutas.

Validação automatizada: `node tests.cjs` (sintaxe, validação CSV, prévia sem mutação, confirmação dupla, deduplicação, conflitos e ausência de lançamentos bancários).

## Protótipo local com conta, cartões e investimentos

`prototype-v2.html`, `prototype-v2.js` e `finance-core.js` implementam uma versão local com três registros separados: caixa bancário, gastos/faturas de cartões e posições de investimentos. Pagamento de fatura impacta caixa uma vez; compras e estornos ficam no cartão. Limite de crédito é separado do saldo próprio. Posições de períodos diferentes não são somadas. Proventos têm registro próprio.

A interface tem busca, filtro por portador, parcelas, histórico por posição, detalhes de origem, conferências, revisão de categorias, inclusão manual de movimento bancário e cópia/restauração local. A consulta de CDI não envia dados financeiros ao Banco Central. Taxas contratuais ausentes não são substituídas por 100% do CDI.

O modelo HTML é compilado com um JSON privado fornecido localmente: `node build-prototype.cjs <dados-privados.json> <saida.html>`. O HTML resultante incorpora dados pessoais e **não deve ser versionado nem publicado**. Os arquivos de dados e documentos de origem permanecem fora deste repositório; o GitHub Pages existente não foi alterado nesta etapa.

Teste das regras: `node finance-core.test.cjs`. A interface local foi verificada em Chromium nas larguras de 1024, 768 e 390 pixels, com filtros, contagens, persistência das revisões e efeito de movimento manual no saldo. Safari/iPad real ainda não foi testado.
