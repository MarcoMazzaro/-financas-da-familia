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

### Reconhecimento a partir das revisões

`recognition.js` aprende localmente com categorias confirmadas. Ao abrir a versão atualizada, as revisões existentes no mesmo armazenamento local são preservadas e viram evidências. A aba Aprendizado mostra regras, observações e conflitos. Categorias automáticas não treinam novas regras, notas de um pagamento não são copiadas para outro, e classificações manuais são preservadas. Histórico genérico de boleto/Pix com valor semelhante gera somente sugestão; categorias conflitantes suspendem a regra.

Na conta corrente, Importar lançamentos aceita JSON estruturado com `accountId`, `asOf` e `bankTransactions` (cada registro: `id` estável, `date` ISO, `description`, `value` numérico com sinal e `details` como lista de textos). A prévia não altera o estado. A confirmação mescla IDs sem duplicar registros existentes, preserva revisões e aplica regras aos novos movimentos. Não é um leitor universal de PDF/Excel, nem importa novas faturas de cartão. Cópias de segurança incluem as regras locais.

Validação adicional: `node recognition.test.cjs`, além de simulação isolada com revisões fictícias, preservação do estado existente, prévia, nova importação e reimportação. A simulação não acessa o navegador do usuário nem suas revisões reais.

### Parcelas a vencer

A aba Cartões mostra uma projeção mensal derivada das parcelas restantes após a fatura de referência, com vencimento contratual dia 11. Compras e estornos parcelados são calculados em centavos; anuidades brutas são separadas, sem presumir descontos futuros. Pagamentos, parcelas já finalizadas e compras à vista não entram como novas parcelas. Há resumo por portador, detalhe por compra e consolidação mensal dos cartões. Diferenças com campos do emissor ficam visíveis. A projeção não inclui novas compras, assinaturas recorrentes à vista nem futuras alterações contratuais. Teste: `node installments.test.cjs`.

O gráfico da Visão Geral inclui previsão por padrão, inicialmente em semanas por 90 dias, com horizontes de 30/90/180/365 dias. Soma agendamentos bancários às parcelas e anuidades futuras conhecidas dos cartões, em registros temporários sem alterar o extrato. Pagamentos de cartão agendados e identificados abatem a previsão correspondente, inclusive pagamentos parciais. Saldo realizado e previsto ficam separados por cor/tracejado. O cenário não presume receitas ou despesas não cadastradas.

Salários mensais podem ser cadastrados na Visão Geral com nome, valor líquido, primeiro recebimento previsto e conta. Alimentam créditos futuros mês a mês, sem registrar recebimento realizado. Meses mais curtos usam o último dia; recebimentos identificados já agendados abatem a previsão para não duplicar. O cadastro pode ser editado ou pausado e acompanha a cópia local. Sem valor/data confirmados, o gráfico mostra que a receita ainda está pendente. Um valor previamente informado pode preencher o formulário sem entrar na projeção antes de completar o cadastro.
