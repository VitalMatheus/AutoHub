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
