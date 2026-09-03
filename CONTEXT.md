# Gestão de Oficinas

Este contexto descreve o vocabulário do SaaS que administra oficinas mecânicas independentes, seus atendimentos e seus registros financeiros básicos.

## Language

**Super Admin**:
Usuário da empresa proprietária da plataforma que administra Organizations e seus Users, sem acesso ordinário aos dados operacionais das oficinas.
_Avoid_: Administrador da oficina, administrador global

**Organization Admin**:
Usuário responsável pela administração e operação de uma única Organization.
_Avoid_: Owner, responsável, usuário comum

**Organization**:
Uma oficina mecânica que opera como unidade independente dentro da plataforma e é proprietária de seus dados.
_Avoid_: Tenant, conta da oficina

**Commercial Account**:
Cliente contratante do AutoHub. No MVP corresponde a exatamente uma Organization, embora permaneça separado internamente para preservar a fronteira comercial.
_Avoid_: Organization, Tenant, oficina

**Plan**:
Oferta comercial interna do AutoHub. O MVP expõe somente o AutoHub Básico e não oferece administração de Plans ao usuário.
_Avoid_: pacote, assinatura

**Plan Version**:
Conjunto imutável das condições padrão de um Plan usado para originar uma contratação, sem aparecer como conceito de navegação no MVP.
_Avoid_: edição do plano, Subscription

**Subscription**:
Relação comercial entre a Commercial Account de uma única Organization e o produto AutoHub Básico, preservando preço, vencimento e vigência contratados.
_Avoid_: plano, oficina, cobrança

**Contracted Price**:
Valor mensal acordado com uma Organization e preservado pela Subscription; alterações futuras não reescrevem mensalidades já emitidas.
_Avoid_: preço atual do Plan, desconto pontual, valor de uma mensalidade emitida

**Financial Standing**:
Situação financeira derivada da única mensalidade aberta e da data de referência: Current, Due Soon, Overdue ou Payment Blocked.
_Avoid_: Organization operational status, situação administrativa

**Monthly Closing**:
Retrato financeiro calculado para um instante de referência em America/Recife. Não implica uma série histórica ou fechamento contábil no MVP.
_Avoid_: média mensal, projeção, fechamento contábil

**Subscription Charge**:
Mensalidade integral de uma Subscription, com valor e vencimento. Uma Organization possui no máximo uma Subscription Charge aberta no MVP.
_Avoid_: Payment, mensalidade paga, recebimento

**Charge Settlement**:
Registro imutável da quitação integral ou reversão de uma Subscription Charge, originado pelo gateway ou por baixa administrativa excepcional.
_Avoid_: Payment, cobrança, pagamento parcial, edição de recebimento

**Due Soon**:
Condição financeira de uma Organization nos cinco dias civis anteriores ao vencimento de sua única mensalidade aberta.
_Avoid_: atraso, notificação enviada, período de tolerância

**Overdue Tolerance**:
Cinco dias civis completos após o vencimento durante os quais a mensalidade está atrasada, mas a Organization ainda pode operar.
_Avoid_: extensão do vencimento, Payment Grace Period contratual

**Delinquent Subscription**:
Subscription cuja única Subscription Charge aberta passou do vencimento sem quitação integral.
_Avoid_: assinatura suspensa, oficina inativa

**Payment Grace Period**:
Termo legado para a tolerância após o vencimento. No MVP, use Overdue Tolerance: cinco dias civis fixos, sem alterar a data de vencimento.
_Avoid_: Trial Period, prorrogação do vencimento

**Commercial Access Restriction**:
Condição derivada da Subscription e de sua única Subscription Charge aberta que permite o acesso ou produz Payment Block depois da Overdue Tolerance.
_Avoid_: Organization operational status, suspensão administrativa

**Payment Block**:
Bloqueio comercial automático aplicado após cinco dias civis completos de atraso e removido pela quitação integral da mensalidade aberta, sem alterar o Organization operational status.
_Avoid_: suspensão administrativa, cancelamento, exclusão

**Effective Access**:
Permissão resultante da combinação entre o Organization operational status e a Commercial Access Restriction, sem alterar nenhum dos dois estados de origem.
_Avoid_: status da assinatura, papel do usuário

**Effective Cancellation**:
Encerramento da vigência comercial depois do período já pago; impede novas mensalidades sem apagar a Organization ou perdoar uma mensalidade aberta.
_Avoid_: pedido de cancelamento, exclusão da oficina

**Trial Period**:
Conceito fora do MVP. O intervalo até o primeiro vencimento é configurado diretamente e não constitui um Trial Period separado.
_Avoid_: período até o primeiro vencimento, cortesia

**Awaiting First Payment**:
Termo legado fora da superfície do MVP; a primeira mensalidade segue o mesmo ciclo de Due Soon, vencimento, Overdue Tolerance e Payment Block das demais.
_Avoid_: Trial Period, Overdue Tolerance, assinatura cancelada

**Pending Commercial Setup**:
Condição temporária de uma Organization existente cujo preço ou primeiro vencimento ainda precisa ser confirmado pelo Super Admin; não gera dívida retroativa nem bloqueio comercial.
_Avoid_: Trial Period, inadimplência, assinatura cancelada

**Organization operational status**:
Condição independente da relação comercial que determina se uma Organization está ativa, inativa ou temporariamente suspensa para uso da plataforma.
_Avoid_: situação da assinatura, inadimplência

**Primary Contact**:
Organization Admin explicitamente indicado como contato comercial principal de uma Commercial Account, sem permissões adicionais.
_Avoid_: proprietário, novo papel de usuário

**Audit Event**:
Registro imutável de uma ação administrativa relevante, identificando ator, momento, ação e entidade afetada sem armazenar segredos ou payloads irrestritos.
_Avoid_: log técnico, histórico editável

**Customer**:
Pessoa ou empresa atendida por uma Organization e responsável por um ou mais Vehicles.
_Avoid_: Client, proprietário

**Vehicle**:
Veículo de um Customer que recebe orçamentos e serviços de uma Organization.
_Avoid_: Automóvel, carro

**Service**:
Item do catálogo de trabalho oferecido por uma Organization.
_Avoid_: Trabalho, mão de obra

**Product**:
Peça ou produto do catálogo de uma Organization que pode ser vendido ou aplicado a um Vehicle, com quantidade disponível e um limite de reposição para orientar a oficina.
_Avoid_: Item de estoque, material

**Stock quantity**:
Quantidade atualmente disponível de um Product para venda ou aplicação pela Organization.
_Avoid_: saldo financeiro, quantidade vendida

**Stock minimum**:
Limite definido pela Organization para indicar que a quantidade de um Product está próxima de acabar.
_Avoid_: estoque ideal, pedido de compra

**Low stock**:
Condição em que a Stock quantity de um Product é igual ou inferior ao seu Stock minimum.
_Avoid_: produto indisponível, alerta de compra

**Quote**:
Proposta comercial de uma Organization para serviços, produtos ou itens manuais destinados a um Vehicle.
_Avoid_: Estimate, proposta

**Quote Item**:
Linha comercial de um Quote que registra descrição, quantidade e preço acordado.
_Avoid_: Item, linha

**Work Order**:
Registro do trabalho autorizado ou executado por uma Organization em um Vehicle.
_Avoid_: Ordem, serviço, OS

**Work Order Item**:
Linha histórica de um Work Order que registra o serviço, produto ou item manual e seus valores no momento da execução.
_Avoid_: Item, linha

**Payment**:
Registro financeiro parcial ou integral de um valor recebido ou esperado para um Work Order. Somente um Payment confirmado representa dinheiro recebido e reduz o saldo; correções preservam o registro original.
_Avoid_: Cobrança, receita, transação

**Work Order installment**:
Parcela planejada opcional do Work Order balance, com valor e vencimento próprios. Não reduz o saldo até que um Payment confirmado seja registrado.
_Avoid_: Payment, receita recebida, parcela de Expense

**Expense**:
Compromisso ou desembolso da Organization, registrado com categoria padronizada, valor, vencimento e pagamentos associados. Seu saldo pendente é reduzido à medida que pagamentos parciais ou integrais são registrados.
_Avoid_: Payment, custo contábil, compra de estoque

**Expense payment**:
Baixa parcial ou integral efetivamente paga de uma Expense. Somente Expense payments confirmados representam saída de caixa; correções preservam o registro original.
_Avoid_: Payment de Work Order, parcela prometida, despesa

**Financial reversal**:
Correção que neutraliza um Payment ou Expense payment confirmado sem apagar ou reescrever o lançamento original.
_Avoid_: edição, exclusão, ajuste de saldo sem origem

**Expense installment**:
Parcela planejada opcional de uma Expense, com valor e vencimento próprios, que pode receber uma ou mais Expense payments. Não representa saída de caixa enquanto não houver baixa confirmada.
_Avoid_: Expense payment, parcelamento de cartão

**Expense category**:
Classificação padronizada de uma Expense usada para consolidar relatórios gerenciais, como peças e insumos, pessoal, aluguel, utilidades, impostos, taxas financeiras, manutenção, marketing e outros.
_Avoid_: etiqueta livre, centro de custo

**Work Order balance**:
Valor ainda não recebido de um Work Order, derivado do total menos seus Payments confirmados.
_Avoid_: lucro, contas a receber da Organization

**Cash result**:
Diferença, em um período, entre Payments confirmados pela data de recebimento e Expenses pagas pela data de pagamento.
_Avoid_: lucro contábil, saldo bancário, DRE contábil

**Simplified managerial income statement**:
Visão gerencial periódica que organiza receitas recebidas, despesas pagas e Cash result, acompanhada separadamente por valores pendentes. Não constitui demonstração contábil ou fiscal.
_Avoid_: DRE contábil, balanço, fluxo de caixa projetado

**Expense due date**:
Data em que uma Expense ou parcela é esperada para pagamento; não representa saída de caixa.
_Avoid_: data de criação, data de pagamento

**Accounts receivable**:
Conjunto dos saldos positivos de Work Orders e Direct Sales não canceladas.
_Avoid_: receita recebida, Payments pendentes

**Accounts payable**:
Conjunto dos saldos positivos de Expenses não canceladas, incluindo parcelas vencidas e futuras.
_Avoid_: despesas pagas, saída de caixa

**Quote approval**:
Registro, feito pela Organization, de que o Customer autorizou os termos de um Quote por algum canal de atendimento. O Customer não precisa possuir acesso à aplicação para essa autorização.
_Avoid_: aprovação automática, assinatura digital

**Stock consumption**:
Baixa da Stock quantity correspondente aos Products efetivamente usados em um Work Order concluído.
_Avoid_: reserva de estoque, venda registrada

**Stock adjustment**:
Correção explícita da Stock quantity após um Stock consumption, preservando o registro histórico do atendimento que originou a baixa.
_Avoid_: reabrir o Work Order, apagar movimentação

**Service history**:
Registro dos serviços concluídos ou entregues para um Vehicle, derivado dos seus Work Orders e preservando o Customer associado no momento do atendimento.
_Avoid_: histórico técnico, histórico do frontend

**Recent activity**:
Acontecimentos operacionais relevantes da oficina que já possuem registro confiável no sistema, como cadastro, criação, aprovação, conclusão ou pagamento.
_Avoid_: movimentação recente, evento estimado

**Primary supplier**:
Supplier preferencial entre os vários associados a um Product, usado como sugestão em novas compras sem substituir a origem histórica de cada Stock entry.
_Avoid_: fornecedor exclusivo, origem da peça instalada

**Supplier**:
Pessoa ou empresa da qual uma Organization adquire Products ou outros bens e serviços, preservada no histórico mesmo depois de desativada.
_Avoid_: Customer, favorecido textual, fabricante

**Supplier Product**:
Relação comercial entre um Supplier e um Product que pode registrar código externo, último custo e garantia padrão; uma das relações pode ser indicada como Primary supplier.
_Avoid_: Stock entry, origem da peça instalada

**Purchase**:
Aquisição de Products de um Supplier que origina Stock entries e uma Expense correspondente dentro da mesma operação.
_Avoid_: Expense isolada, Stock adjustment, orçamento

**Draft Purchase**:
Purchase editável que ainda não altera estoque nem financeiro.
_Avoid_: pedido enviado, entrada de estoque, conta a pagar

**Confirmed Purchase**:
Purchase imutável que criou atomicamente suas Stock entries e Expense; sua correção exige reversão compatível com o histórico financeiro e de consumo.
_Avoid_: Draft Purchase, compra paga

**Stock entry**:
Origem histórica de uma quantidade adquirida de um Product, identificando Purchase, Supplier, custo, data, lote opcional e garantia. Seu saldo permite rastrear quais unidades ainda podem ser consumidas.
_Avoid_: Stock quantity, Stock movement, Supplier Product

**Warranty expiry**:
Data final de garantia preservada em uma Stock entry, sugerida pela condição padrão do Supplier Product e ajustável conforme os termos da Purchase.
_Avoid_: garantia do Product, data presumida da instalação

**Opening stock**:
Quantidade preexistente de um Product sem Purchase ou Supplier comprovável, preservada para operação e consumida somente depois das Stock entries rastreáveis disponíveis.
_Avoid_: Stock entry, compra presumida, estoque com garantia

**Stock allocation**:
Associação histórica entre a quantidade de Product consumida em um Work Order Item ou Direct Sale Item e as Stock entries que a forneceram.
_Avoid_: reserva, fornecedor principal, ajuste de estoque

**Parts gross margin**:
Diferença gerencial, para um Work Order concluído ou entregue, entre o total dos seus itens e o custo histórico das peças consumidas. Não inclui mão de obra, impostos ou despesas indiretas.
_Avoid_: Cash result, lucro contábil, Work Order balance

**Direct Sale**:
Venda numerada de Products feita diretamente pela Organization, sem Quote, Vehicle ou Work Order. Pode identificar um Customer e preserva total, recebimentos, saldo e origem do estoque consumido.
_Avoid_: Work Order simplificada, Quote, venda de serviço

**Direct Sale Item**:
Linha histórica de uma Direct Sale que preserva Product, descrição, quantidade, preço negociado, desconto e Stock allocations.
_Avoid_: Product atual, Work Order Item, item manual

**Sale payment**:
Recebimento parcial ou integral ligado a uma Direct Sale. Somente um Sale payment confirmado reduz o saldo e representa receita recebida.
_Avoid_: Payment de Work Order, parcela planejada, Expense payment

**Direct Sale installment**:
Parcela planejada opcional do saldo de uma Direct Sale, com valor e vencimento próprios. Exige Customer identificado e não reduz o saldo até haver Sale payment confirmado.
_Avoid_: Sale payment, venda paga

**Direct Sale receipt**:
Comprovante não fiscal imprimível que apresenta a Direct Sale, seus itens, pagamentos e saldo sem substituir NF-e ou NFC-e.
_Avoid_: nota fiscal, ordem de serviço, orçamento

**User-facing status**:
Nome em português usado pela oficina para representar um estado interno de Quote ou Work Order, sem expor enums técnicos.
_Avoid_: status cru, enum
