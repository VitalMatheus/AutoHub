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
Peça ou produto do catálogo de uma Organization que pode ser vendido ou aplicado a um Vehicle.
_Avoid_: Item de estoque, material

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
