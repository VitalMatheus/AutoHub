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
Cliente contratante do AutoHub que reúne uma ou mais Organizations sob uma única relação comercial.
_Avoid_: Organization, Tenant, oficina

**Plan**:
Oferta comercial do AutoHub que define preço, periodicidade, limites de uso e funcionalidades incluídas; alterações futuras não modificam as condições já contratadas.
_Avoid_: pacote, assinatura

**Plan Version**:
Conjunto imutável e publicado de condições comerciais de um Plan disponível para novas contratações em determinado período.
_Avoid_: edição do plano, Subscription

**Subscription**:
Relação comercial entre uma Commercial Account e um Plan, preservando as condições contratadas e seu período de vigência.
_Avoid_: plano, oficina, cobrança

**Contracted Price**:
Valor recorrente preservado pela Subscription a partir da Plan Version e de eventual ajuste comercial recorrente.
_Avoid_: preço atual do plano, desconto pontual

**Monthly Closing**:
Retrato das condições comerciais e operacionais no fim de um mês civil em America/Recife, usado nas séries históricas da plataforma.
_Avoid_: média mensal, projeção

**Subscription Charge**:
Obrigação financeira de uma Subscription referente a um período contratado, com valor, vencimento e saldo devido.
_Avoid_: Payment, mensalidade paga, recebimento

**Charge Settlement**:
Registro imutável de um valor recebido ou estornado para liquidar total ou parcialmente uma Subscription Charge.
_Avoid_: Payment, cobrança, edição de recebimento

**Delinquent Subscription**:
Subscription que possui ao menos uma Subscription Charge vencida, não cancelada e ainda não integralmente liquidada.
_Avoid_: assinatura suspensa, oficina inativa

**Payment Grace Period**:
Tolerância contratada após o vencimento de uma renovação durante a qual a Subscription está inadimplente, mas suas Organizations ainda podem operar.
_Avoid_: Trial Period, prorrogação do vencimento

**Commercial Access Restriction**:
Condição derivada da Subscription e de suas Subscription Charges que permite o acesso, alerta sobre a tolerância ou bloqueia comercialmente todas as Organizations cobertas.
_Avoid_: Organization operational status, suspensão administrativa

**Effective Access**:
Permissão resultante da combinação entre o Organization operational status e a Commercial Access Restriction, sem alterar nenhum dos dois estados de origem.
_Avoid_: status da assinatura, papel do usuário

**Effective Cancellation**:
Encerramento da vigência de uma Subscription na data em que o cancelamento produz efeito, independentemente da data em que foi solicitado.
_Avoid_: pedido de cancelamento, exclusão da oficina

**Trial Period**:
Período inicial opcional de 14 dias em que uma Subscription pode ser utilizada antes do primeiro período pago e sem contribuir para a receita recorrente.
_Avoid_: plano gratuito, cortesia

**Awaiting First Payment**:
Condição após o Trial Period, ou desde uma contratação sem teste, em que a Subscription ainda não iniciou seu primeiro período pago e o acesso aguarda a liquidação integral da primeira Subscription Charge.
_Avoid_: Trial Period, Payment Grace Period, assinatura cancelada

**Pending Commercial Setup**:
Condição temporária de uma Commercial Account migrada cujo início e condições de cobrança ainda precisam ser confirmados pelo Super Admin.
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
Registro financeiro parcial ou integral de um valor recebido ou esperado para um Work Order; correções preservam o registro original.
_Avoid_: Cobrança, transação

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
Fornecedor principal atualmente associado a um Product para orientar a oficina sobre quem contatar em caso de defeito; não representa a origem de cada unidade vendida.
_Avoid_: fornecedor da venda, origem garantida da peça

**User-facing status**:
Nome em português usado pela oficina para representar um estado interno de Quote ou Work Order, sem expor enums técnicos.
_Avoid_: status cru, enum
