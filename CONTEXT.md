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
