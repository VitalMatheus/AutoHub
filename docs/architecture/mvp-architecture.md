# Arquitetura do MVP — SaaS para oficinas mecânicas

## 1. Visão geral da arquitetura

O MVP será um monólito modular em NestJS. Cada capacidade de negócio terá um módulo próprio, mas todos os módulos serão implantados como uma única aplicação e compartilharão uma única instância PostgreSQL acessada exclusivamente pelo Prisma.

```text
Frontend externo
      ↓ HTTPS / REST / JSON
NestJS (Controllers → Services → Prisma)
      ↓
PostgreSQL
```

Responsabilidades:

- **Controllers**: contrato HTTP, DTOs, autenticação declarativa e delegação.
- **Services**: regras de negócio, autorização baseada em dados, escopo tenant e transações.
- **Prisma**: persistência, relações e acesso seguro ao PostgreSQL.
- **Guards**: autenticação e autorização por papel; não substituem o escopo tenant dos Services.
- **Common**: preocupações transversais pequenas e comprovadamente compartilhadas.

Não haverá acesso direto ao banco pelo frontend, comunicação entre módulos por HTTP, microserviços, CQRS, Event Sourcing, Repository Pattern ou uma Clean Architecture completa.

## 2. Decisões arquiteturais

### Monólito modular

Um processo NestJS e um banco reduzem custo operacional e mantêm transações simples. Os módulos fornecem limites de organização, não unidades independentes de deploy.

### Identidade e tenancy

- Um `User` possui e-mail globalmente único e pertence a no máximo uma `Organization`.
- `SUPER_ADMIN` possui `organizationId = null`.
- `ADMIN` possui `organizationId` obrigatório.
- `SUPER_ADMIN` administra Organizations e Users, mas não acessa dados operacionais de oficinas por padrão.
- O tenant vem da identidade autenticada carregada do banco, nunca de campos de autorização enviados pelo cliente.

### Isolamento explícito

Toda operação tenant-owned inclui `organizationId` no filtro Prisma dentro do Service. Relações compostas no banco impedem que entidades de Organizations diferentes sejam vinculadas. Essa decisão é detalhada em [ADR-0003](../adr/0003-scope-tenant-access-explicitly-in-services.md).

### Dinheiro

Valores usam `Decimal(12,2)` no PostgreSQL e Prisma. A API recebe e devolve strings decimais, como `"149.90"`. `float` e `number` JavaScript não participam de cálculos financeiros.

### Identificadores e números legíveis

Entidades usam UUID como identificador técnico. Quote e WorkOrder também recebem números sequenciais por Organization, gerados atomicamente pelos contadores da Organization. Constraints compostas evitam colisões.

### Histórico sem duplicação desnecessária

O histórico de Vehicle é consultado a partir de WorkOrders concluídas ou entregues. Não existe `VehicleHistory`. QuoteItem e WorkOrderItem preservam snapshots de descrição, quantidade e preço, de modo que alterações no catálogo não alterem documentos antigos.

### Exclusão

- Organization, User e catálogos são desativados.
- Customer e Vehicle só podem ser excluídos fisicamente antes de possuir vínculos históricos; depois disso, são desativados.
- Quote é cancelado, não apagado depois de sair de `DRAFT`.
- WorkOrder e Payment nunca são apagados pela API comum.
- Cascata é limitada a filhos sem identidade fora do agregado e a credenciais descartáveis.

### Decisões registradas

- [ADR-0001 — limitar acesso operacional do Super Admin](../adr/0001-limit-super-admin-operational-access.md)
- [ADR-0002 — usar identidades globais de User](../adr/0002-use-global-user-identities.md)
- [ADR-0003 — aplicar escopo tenant explicitamente nos Services](../adr/0003-scope-tenant-access-explicitly-in-services.md)

## 3. Estrutura de pastas

```text
src/
├── main.ts
├── app.module.ts
├── auth/
│   ├── dto/
│   ├── guards/
│   ├── strategies/
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── auth.module.ts
├── platform/
│   ├── organizations/
│   └── users/
├── users/
├── customers/
├── vehicles/
├── service-catalog/
├── products/
├── quotes/
├── work-orders/
├── payments/
├── common/
│   ├── decorators/
│   ├── errors/
│   ├── filters/
│   ├── pagination/
│   └── types/
├── config/
└── prisma/
    ├── prisma.module.ts
    └── prisma.service.ts
prisma/
├── schema.prisma
├── migrations/
└── seed.ts                 # apenas dados não secretos, se necessário
test/
├── integration/
├── e2e/
└── helpers/
docs/
├── agents/
├── adr/
└── architecture/
```

Cada módulo de negócio segue uma forma previsível: `dto/`, `*.controller.ts`, `*.service.ts`, `*.module.ts` e testes próximos ao código quando unitários. Não se cria uma camada por entidade apenas para encaminhar chamadas ao Prisma.

## 4. Modelo de domínio

| Entidade | Papel e relações principais |
| --- | --- |
| Organization | Oficina/tenant; possui Users, Customers, Vehicles, catálogos e documentos. |
| User | Identidade global; pertence opcionalmente a uma Organization. |
| Session | Sessão autenticada; guarda hash do refresh token e estado de revogação. |
| ActionToken | Token de uso único para ativação e futura recuperação de senha. |
| Customer | Cliente atual da Organization; possui Vehicles e aparece historicamente em Quotes/WorkOrders. |
| Vehicle | Veículo atualmente associado a um Customer da mesma Organization. |
| Service | Item ativo/inativo do catálogo de mão de obra. |
| Product | Item ativo/inativo do catálogo de peças/produtos, com controle básico de estoque. |
| Quote | Orçamento numerado para Customer e Vehicle; possui QuoteItems. |
| QuoteItem | Snapshot comercial de Service, Product ou item manual. |
| WorkOrder | Ordem numerada, opcionalmente originada de um único Quote aprovado. |
| WorkOrderItem | Snapshot histórico do serviço/produto aplicado. |
| Payment | Recebimento parcial ou integral ligado a uma WorkOrder. |

Regras centrais:

- Customer e Vehicle de Quote/WorkOrder pertencem à mesma Organization do documento.
- Um Quote aprovado pode gerar no máximo uma WorkOrder.
- A conversão copia itens; edições posteriores não sincronizam os dois documentos.
- Totais são calculados de `quantity × unitPrice` usando aritmética decimal.
- Payments confirmados não podem superar o total da WorkOrder, inclusive sob concorrência.
- `UNPAID`, `PARTIAL` e `PAID` são estados derivados, não uma coluna persistida da WorkOrder.
- Vehicle pode mudar de Customer; documentos antigos preservam o `customerId` histórico.

## 5. Proposta inicial do `schema.prisma`

Esta proposta é para revisão. Ela não deve ser copiada cegamente nem migrada antes da implementação da fase correspondente.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  SUPER_ADMIN
  ADMIN
}

enum UserStatus {
  PENDING_ACTIVATION
  ACTIVE
  DISABLED
}

enum ActionTokenPurpose {
  ACTIVATE_ACCOUNT
  RESET_PASSWORD
}

enum QuoteStatus {
  DRAFT
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}

enum ItemType {
  SERVICE
  PRODUCT
  MANUAL
}

enum WorkOrderStatus {
  OPEN
  WAITING_APPROVAL
  IN_PROGRESS
  WAITING_PARTS
  COMPLETED
  DELIVERED
  CANCELLED
}

enum PaymentMethod {
  CASH
  PIX
  CREDIT_CARD
  DEBIT_CARD
  BANK_TRANSFER
  OTHER
}

enum PaymentStatus {
  PENDING
  CONFIRMED
  CANCELLED
}

model Organization {
  id                      String   @id @default(uuid()) @db.Uuid
  name                    String
  document                String?  @unique
  phone                   String?
  email                   String?
  addressLine1            String?
  addressLine2            String?
  city                    String?
  state                   String?
  postalCode              String?
  active                  Boolean  @default(true)
  nextQuoteNumber         Int      @default(1)
  nextWorkOrderNumber     Int      @default(1)
  createdAt               DateTime @default(now()) @db.Timestamptz(3)
  updatedAt               DateTime @updatedAt @db.Timestamptz(3)

  users           User[]
  customers       Customer[]
  vehicles        Vehicle[]
  services        Service[]
  products        Product[]
  quotes          Quote[]
  quoteItems      QuoteItem[]
  workOrders      WorkOrder[]
  workOrderItems  WorkOrderItem[]
  payments        Payment[]

  @@index([active])
}

model User {
  id             String     @id @default(uuid()) @db.Uuid
  organizationId String?    @db.Uuid
  name           String
  email          String     @unique
  passwordHash   String?
  role           UserRole
  status         UserStatus @default(PENDING_ACTIVATION)
  createdAt      DateTime   @default(now()) @db.Timestamptz(3)
  updatedAt      DateTime   @updatedAt @db.Timestamptz(3)

  organization Organization? @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  sessions     Session[]
  actionTokens ActionToken[]

  @@index([organizationId, status])
}

model Session {
  id               String    @id @default(uuid()) @db.Uuid
  userId           String    @db.Uuid
  refreshTokenHash String
  expiresAt        DateTime  @db.Timestamptz(3)
  revokedAt        DateTime? @db.Timestamptz(3)
  createdAt        DateTime  @default(now()) @db.Timestamptz(3)
  updatedAt        DateTime  @updatedAt @db.Timestamptz(3)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, revokedAt])
  @@index([expiresAt])
}

model ActionToken {
  id        String             @id @default(uuid()) @db.Uuid
  userId    String             @db.Uuid
  purpose   ActionTokenPurpose
  tokenHash String             @unique
  expiresAt DateTime           @db.Timestamptz(3)
  usedAt    DateTime?          @db.Timestamptz(3)
  createdAt DateTime           @default(now()) @db.Timestamptz(3)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, purpose, usedAt])
}

model Customer {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @db.Uuid
  name           String
  document       String?
  phone          String
  email          String?
  notes          String?
  active         Boolean  @default(true)
  createdAt      DateTime @default(now()) @db.Timestamptz(3)
  updatedAt      DateTime @updatedAt @db.Timestamptz(3)

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  vehicles     Vehicle[]
  quotes       Quote[]
  workOrders   WorkOrder[]

  @@unique([organizationId, id])
  @@unique([organizationId, document])
  @@index([organizationId, name])
  @@index([organizationId, phone])
}

model Vehicle {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @db.Uuid
  customerId     String   @db.Uuid
  plate          String
  brand          String
  model          String
  year           Int?
  color          String?
  mileage        Int?
  notes          String?
  active         Boolean  @default(true)
  createdAt      DateTime @default(now()) @db.Timestamptz(3)
  updatedAt      DateTime @updatedAt @db.Timestamptz(3)

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  customer     Customer     @relation(fields: [organizationId, customerId], references: [organizationId, id], onDelete: Restrict)
  quotes       Quote[]
  workOrders   WorkOrder[]

  @@unique([organizationId, id])
  @@unique([organizationId, plate])
  @@index([organizationId, customerId])
}

model Service {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @db.Uuid
  name           String
  description    String?
  defaultPrice   Decimal  @db.Decimal(12, 2)
  active         Boolean  @default(true)
  createdAt      DateTime @default(now()) @db.Timestamptz(3)
  updatedAt      DateTime @updatedAt @db.Timestamptz(3)

  organization  Organization   @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  quoteItems     QuoteItem[]
  workOrderItems WorkOrderItem[]

  @@unique([organizationId, id])
  @@index([organizationId, active, name])
}

model Product {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @db.Uuid
  name           String
  description    String?
  sku            String?
  salePrice      Decimal  @db.Decimal(12, 2)
  stockQuantity  Int      @default(0)
  stockMinimum   Int      @default(0)
  active         Boolean  @default(true)
  createdAt      DateTime @default(now()) @db.Timestamptz(3)
  updatedAt      DateTime @updatedAt @db.Timestamptz(3)

  organization  Organization   @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  quoteItems     QuoteItem[]
  workOrderItems WorkOrderItem[]

  @@unique([organizationId, id])
  @@unique([organizationId, sku])
  @@index([organizationId, active, name])
}

model Quote {
  id             String      @id @default(uuid()) @db.Uuid
  organizationId String      @db.Uuid
  customerId     String      @db.Uuid
  vehicleId      String      @db.Uuid
  number         Int
  status         QuoteStatus @default(DRAFT)
  notes          String?
  createdAt      DateTime    @default(now()) @db.Timestamptz(3)
  updatedAt      DateTime    @updatedAt @db.Timestamptz(3)

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  customer     Customer     @relation(fields: [organizationId, customerId], references: [organizationId, id], onDelete: Restrict)
  vehicle      Vehicle      @relation(fields: [organizationId, vehicleId], references: [organizationId, id], onDelete: Restrict)
  items        QuoteItem[]
  workOrder    WorkOrder?

  @@unique([organizationId, id])
  @@unique([organizationId, number])
  @@index([organizationId, status, createdAt])
  @@index([organizationId, customerId])
  @@index([organizationId, vehicleId])
}

model QuoteItem {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @db.Uuid
  quoteId        String   @db.Uuid
  type           ItemType
  serviceId      String?  @db.Uuid
  productId      String?  @db.Uuid
  description    String
  quantity       Decimal  @db.Decimal(10, 3)
  unitPrice      Decimal  @db.Decimal(12, 2)
  createdAt      DateTime @default(now()) @db.Timestamptz(3)
  updatedAt      DateTime @updatedAt @db.Timestamptz(3)

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  quote        Quote        @relation(fields: [organizationId, quoteId], references: [organizationId, id], onDelete: Cascade)
  service      Service?     @relation(fields: [organizationId, serviceId], references: [organizationId, id], onDelete: Restrict)
  product      Product?     @relation(fields: [organizationId, productId], references: [organizationId, id], onDelete: Restrict)

  @@index([organizationId, quoteId])
}

model WorkOrder {
  id                     String          @id @default(uuid()) @db.Uuid
  organizationId         String          @db.Uuid
  customerId             String          @db.Uuid
  vehicleId              String          @db.Uuid
  quoteId                String?         @db.Uuid
  number                 Int
  status                 WorkOrderStatus @default(OPEN)
  reportedProblem        String?
  diagnosis              String?
  mileage                Int?
  expectedCompletionDate DateTime?       @db.Date
  notes                  String?
  createdAt              DateTime        @default(now()) @db.Timestamptz(3)
  updatedAt              DateTime        @updatedAt @db.Timestamptz(3)

  organization Organization    @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  customer     Customer        @relation(fields: [organizationId, customerId], references: [organizationId, id], onDelete: Restrict)
  vehicle      Vehicle         @relation(fields: [organizationId, vehicleId], references: [organizationId, id], onDelete: Restrict)
  quote        Quote?          @relation(fields: [organizationId, quoteId], references: [organizationId, id], onDelete: Restrict)
  items        WorkOrderItem[]
  payments     Payment[]

  @@unique([organizationId, id])
  @@unique([organizationId, number])
  @@unique([organizationId, quoteId])
  @@index([organizationId, status, createdAt])
  @@index([organizationId, customerId])
  @@index([organizationId, vehicleId])
}

model WorkOrderItem {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @db.Uuid
  workOrderId    String   @db.Uuid
  type           ItemType
  serviceId      String?  @db.Uuid
  productId      String?  @db.Uuid
  description    String
  quantity       Decimal  @db.Decimal(10, 3)
  unitPrice      Decimal  @db.Decimal(12, 2)
  createdAt      DateTime @default(now()) @db.Timestamptz(3)
  updatedAt      DateTime @updatedAt @db.Timestamptz(3)

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  workOrder   WorkOrder   @relation(fields: [organizationId, workOrderId], references: [organizationId, id], onDelete: Cascade)
  service     Service?    @relation(fields: [organizationId, serviceId], references: [organizationId, id], onDelete: Restrict)
  product     Product?    @relation(fields: [organizationId, productId], references: [organizationId, id], onDelete: Restrict)

  @@index([organizationId, workOrderId])
}

model Payment {
  id             String        @id @default(uuid()) @db.Uuid
  organizationId String        @db.Uuid
  workOrderId    String        @db.Uuid
  amount         Decimal       @db.Decimal(12, 2)
  method         PaymentMethod
  status         PaymentStatus @default(CONFIRMED)
  paidAt         DateTime?     @db.Timestamptz(3)
  createdAt      DateTime      @default(now()) @db.Timestamptz(3)

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  workOrder   WorkOrder   @relation(fields: [organizationId, workOrderId], references: [organizationId, id], onDelete: Restrict)

  @@index([organizationId, workOrderId, status])
  @@index([organizationId, paidAt])
}
```

Observações para a migration real:

- Normalizar e-mail, documento e placa antes de persistir.
- Adicionar `CHECK` constraints via SQL da migration para valores positivos, coerência entre `ItemType` e referências opcionais e a regra papel/Organization do User.
- Confirmar com `prisma validate` se relações compostas opcionais da versão adotada exigem ajustes de sintaxe.
- Não executar migration até que o schema e os casos de uso da fase sejam aprovados.

## 6. Estratégia multi-tenant

### Identidade confiável

O access token carrega apenas identificadores mínimos (`sub` e `sid`). A cada requisição protegida, o backend carrega Session, User e Organization e monta um `AuthenticatedPrincipal` com dados validados. `organizationId` e `role` do body, query ou header nunca participam da autorização.

### Fluxo obrigatório em cada operação tenant-owned

1. Guard valida JWT e sessão.
2. Guard rejeita User ou Organization inativos.
3. Controller passa o principal autenticado ao Service.
4. Service exige `principal.organizationId` e consulta com `id + organizationId`.
5. Criações preenchem `organizationId` exclusivamente a partir do principal.
6. Relações são verificadas com chaves compostas da mesma Organization.
7. Recurso ausente ou pertencente a outro tenant retorna `404`, sem revelar existência.

Exemplo conceitual:

```ts
await prisma.customer.findFirstOrThrow({
  where: { id: customerId, organizationId: principal.organizationId },
});
```

Operações de update/delete devem usar filtro composto ou primeiro resolver o recurso no escopo e então executar a mutação em transação. Nunca faça `findUnique({ where: { id } })` em entidade tenant-owned para decidir autorização.

### Defesa em profundidade

- FKs compostas impedem Customer/Vehicle/Quote/WorkOrder de tenants diferentes.
- Índices começam com `organizationId` nas consultas frequentes.
- Testes E2E tentam leitura e mutação cruzada em vários módulos.
- Logs registram falhas de autorização sem incluir senhas, tokens ou dados pessoais desnecessários.
- Row-Level Security pode ser avaliado no futuro, mas não entra no MVP; adicioná-lo agora criaria duas políticas de autorização para manter.

## 7. Estratégia de autenticação e autorização

### Credenciais

- E-mail normalizado em minúsculas e globalmente único.
- Senha entre 12 e 128 caracteres.
- Hash Argon2id; parâmetros vêm de configuração validada.
- `passwordHash` é omitido de toda seleção/serialização pública.

### Ativação e bootstrap

- Primeiro `SUPER_ADMIN`: comando CLI idempotente com credenciais fornecidas fora do código.
- Convite: cria User `PENDING_ACTIVATION` e `ActionToken` de uso único, armazenando apenas hash.
- Ativação define a senha, marca o token como usado e ativa o User em uma transação.
- Recuperação de senha reutilizará `ActionToken`, mas fica fora do primeiro MVP.

### Tokens e sessões

- Access JWT: 15 minutos.
- Refresh token: 30 dias, opaco ou JWT com identificador de sessão; apenas seu hash fica no banco.
- Refresh rotaciona o token em cada uso.
- Logout revoga a sessão corrente.
- Desativação revoga todas as sessões do User; suspensão da Organization revoga sessões de seus Users.
- Múltiplos dispositivos correspondem a múltiplas Sessions.

### Autorização

- `JwtAuthGuard`: autentica e materializa o principal.
- `RolesGuard`: permite `SUPER_ADMIN` ou `ADMIN` conforme metadados da rota.
- Services aplicam autorização contextual e tenant scoping.
- `SUPER_ADMIN` usa endpoints `/platform/*` e não pode usar endpoints operacionais em nome de uma oficina.

Rate limiting mais estrito se aplica a login, refresh e ativação. CORS usa allowlist por ambiente; Helmet é global. Secrets são validados no bootstrap e nunca possuem fallback inseguro em produção.

## 8. Endpoints planejados

Todos usam prefixo `/api/v1`.

### Auth

```text
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
POST   /auth/activate
GET    /auth/me
```

### Plataforma (`SUPER_ADMIN`)

```text
POST   /platform/organizations
GET    /platform/organizations
GET    /platform/organizations/:id
PATCH  /platform/organizations/:id
POST   /platform/organizations/:id/activate
POST   /platform/organizations/:id/deactivate

POST   /platform/users
GET    /platform/users
GET    /platform/users/:id
POST   /platform/users/:id/activate
POST   /platform/users/:id/deactivate
POST   /platform/users/:id/revoke-sessions
```

### Users da Organization

```text
POST   /users
GET    /users
GET    /users/:id
PATCH  /users/:id
POST   /users/:id/activate
POST   /users/:id/deactivate
POST   /users/:id/revoke-sessions
```

### Recursos operacionais

```text
POST   /customers
GET    /customers
GET    /customers/:id
PATCH  /customers/:id
DELETE /customers/:id                  # somente sem histórico

POST   /vehicles
GET    /vehicles
GET    /vehicles/:id
PATCH  /vehicles/:id
DELETE /vehicles/:id                   # somente sem histórico
GET    /vehicles/:id/work-orders

POST   /service-catalog
GET    /service-catalog
GET    /service-catalog/:id
PATCH  /service-catalog/:id
POST   /service-catalog/:id/activate
POST   /service-catalog/:id/deactivate

POST   /products
GET    /products
GET    /products/:id
PATCH  /products/:id
POST   /products/:id/activate
POST   /products/:id/deactivate

POST   /quotes
GET    /quotes
GET    /quotes/:id
PATCH  /quotes/:id
POST   /quotes/:id/items
PATCH  /quotes/:id/items/:itemId
DELETE /quotes/:id/items/:itemId
POST   /quotes/:id/submit
POST   /quotes/:id/approve
POST   /quotes/:id/reject
POST   /quotes/:id/cancel
POST   /quotes/:id/convert-to-work-order

POST   /work-orders
GET    /work-orders
GET    /work-orders/:id
PATCH  /work-orders/:id
POST   /work-orders/:id/items
PATCH  /work-orders/:id/items/:itemId
DELETE /work-orders/:id/items/:itemId
POST   /work-orders/:id/status

POST   /work-orders/:workOrderId/payments
GET    /work-orders/:workOrderId/payments
GET    /payments/:id
POST   /payments/:id/cancel
```

Ações de estado são endpoints explícitos para que suas pré-condições sejam visíveis. Filtros iniciais incluem texto, status, intervalo de criação e relações relevantes. Ordenação usa allowlist.

## 9. Estratégia de erros e respostas HTTP

### Sucesso

- `200 OK`: leitura ou ação concluída com corpo.
- `201 Created`: recurso criado, com header `Location` quando aplicável.
- `204 No Content`: logout ou ação sem representação útil.
- Recurso individual: objeto diretamente, sem envelope.
- Lista: `{ "data": [...], "meta": { "page": 1, "pageSize": 20, "total": 42 } }`.

### Erros

Usar `application/problem+json`:

```json
{
  "type": "https://api.example.com/problems/quote-invalid-transition",
  "title": "Invalid quote transition",
  "status": 409,
  "detail": "An approved quote cannot return to draft.",
  "instance": "/api/v1/quotes/…/submit",
  "code": "QUOTE_INVALID_TRANSITION"
}
```

- `400`: sintaxe, DTO ou parâmetros inválidos.
- `401`: autenticação ausente/inválida.
- `403`: papel autenticado sem permissão para aquela capacidade.
- `404`: recurso inexistente ou pertencente a outra Organization.
- `409`: conflito de estado, unicidade ou concorrência.
- `422`: regra semântica que não representa conflito de estado, usada com parcimônia.
- `429`: limite de requisições.

Um Exception Filter global converte erros conhecidos. Erros Prisma são mapeados sem expor nomes de tabelas, SQL, stack traces ou detalhes internos.

## 10. Estratégia de testes

### Unitários

Obrigatórios para:

- transições de Quote e WorkOrder;
- cálculo decimal de totais e estado de pagamento;
- conversão de Quote em WorkOrder;
- regras de exclusão/desativação;
- ativação, rotação e revogação de sessão.

### Integração com PostgreSQL real

- constraints compostas e unicidade por Organization;
- transações de contadores;
- conversão única de Quote;
- concorrência de Payments sem overpayment;
- `ON DELETE` e preservação histórica;
- queries paginadas e filtradas.

### E2E

Fluxo mínimo:

1. bootstrap/login de `SUPER_ADMIN`;
2. criação de Organization e convite do responsável;
3. ativação/login do Organization Admin;
4. Customer → Vehicle → catálogos → Quote → aprovação → WorkOrder → conclusão → Payment;
5. consulta ao histórico do Vehicle.

Isolamento obrigatório em mais de um módulo:

- User da Organization A tenta ler e alterar Customer da B: `404`.
- User da Organization A tenta vincular Vehicle/Quote/WorkOrder a IDs da B: `404` ou conflito seguro, sem vínculo criado.
- User da Organization A tenta ler WorkOrder/Payment da B: `404`.
- Organization desativada perde acesso imediatamente.
- `ADMIN` recebe `403` em `/platform/*`.

Cada módulo só está pronto quando possui testes de caminho feliz, validação, autorização, isolamento tenant, regras de estado e persistência relevantes. Remover ou enfraquecer teste para obter verde é proibido.

## 11. Docker Compose

Compose inicial apenas para PostgreSQL:

```yaml
services:
  postgres:
    image: postgres:17-alpine
    container_name: autohub-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    volumes:
      - autohub_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  autohub_postgres_data:
```

O NestJS roda localmente e conecta em `localhost`. CI usa PostgreSQL efêmero e aplica migrations antes dos testes. Versões de imagens devem permanecer fixadas; upgrades são alterações deliberadas.

## 12. Variáveis de ambiente

Proposta de `.env.example`:

```dotenv
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

POSTGRES_DB=autohub
POSTGRES_USER=autohub
POSTGRES_PASSWORD=change-me
POSTGRES_PORT=5432
DATABASE_URL=postgresql://autohub:change-me@localhost:5432/autohub?schema=public

JWT_ACCESS_SECRET=replace-with-at-least-32-random-bytes
JWT_ACCESS_TTL=15m
REFRESH_TOKEN_TTL_DAYS=30

ARGON2_MEMORY_COST=65536
ARGON2_TIME_COST=3
ARGON2_PARALLELISM=1

CORS_ORIGINS=http://localhost:5173
SWAGGER_ENABLED=true
LOG_LEVEL=debug
```

O bootstrap valida tipos, presença e limites seguros. `.env` fica ignorado pelo Git; somente `.env.example` é versionado. Produção recebe secrets do ambiente de deploy.

## 13. Arquivo `AGENTS.md`

O conteúdo operacional completo está no [AGENTS.md](../../AGENTS.md). Ele mantém ponteiros curtos para tracker, labels e domínio, além de invariantes de arquitetura, segurança, banco, testes e escopo de mudança.

## 14. Roadmap técnico

### Fase 0 — Bootstrap e infraestrutura

- **Objetivo**: iniciar NestJS/TypeScript, configuração, qualidade, Swagger e PostgreSQL local.
- **Arquivos/módulos**: `src/main.ts`, `app.module.ts`, `config/`, `docker-compose.yml`, `.env.example`, configuração de lint/teste.
- **Dependências**: nenhuma fase anterior.
- **Conclusão**: app inicia, configuração inválida falha cedo, Swagger abre apenas onde permitido e PostgreSQL fica saudável.
- **Testes**: smoke test da aplicação e validação de configuração.

### Fase 1 — Prisma e fundações de persistência

- **Objetivo**: instalar Prisma, criar schema inicial revisado e primeira migration.
- **Arquivos/módulos**: `prisma/schema.prisma`, `prisma/migrations/`, `src/prisma/`.
- **Dependências**: fase 0.
- **Conclusão**: migration sobe banco vazio e `prisma validate`/`generate` passam; constraints de tenancy são verificadas.
- **Testes**: integração de constraints, normalização e conexão.

### Fase 2 — Autenticação e sessões

- **Objetivo**: bootstrap, ativação, login, refresh rotativo, logout e principal autenticado.
- **Arquivos/módulos**: `auth/`, modelos User/Session/ActionToken, comando de bootstrap.
- **Dependências**: fase 1.
- **Conclusão**: tokens expiram e revogam corretamente; senha nunca é exposta; rate limit protege endpoints sensíveis.
- **Testes**: unitários de tokens/senha, integração de sessão e E2E de login/refresh/logout.

### Fase 3 — Organizations e Users

- **Objetivo**: administração da plataforma e convites da oficina.
- **Arquivos/módulos**: `platform/organizations/`, `platform/users/`, `users/`.
- **Dependências**: fase 2.
- **Conclusão**: Guards separam plataforma/oficina; suspensão bloqueia acesso; vínculo de User é imutável pela API comum.
- **Testes**: autorização por papel, convite, ativação, suspensão e isolamento de listagens.

### Fase 4 — Customers

- **Objetivo**: CRUD tenant-scoped com normalização e política de retenção.
- **Arquivos/módulos**: `customers/`.
- **Dependências**: fase 3.
- **Conclusão**: paginação/filtros funcionam; documento é único no tenant; exclusão respeita histórico.
- **Testes**: unitários de regra, integração de unicidade e E2E A→B para leitura e mutação.

### Fase 5 — Vehicles

- **Objetivo**: gestão de Vehicle e relação atual com Customer.
- **Arquivos/módulos**: `vehicles/`.
- **Dependências**: fase 4.
- **Conclusão**: placa normalizada/única; troca de Customer preserva documentos antigos; nenhum vínculo cruzado é possível.
- **Testes**: constraints compostas, mudança de Customer e E2E A→B.

### Fase 6 — Catálogos

- **Objetivo**: Service simples e Product com controle básico de estoque, sem compras, fornecedores ou movimentações avançadas.
- **Arquivos/módulos**: `service-catalog/`, `products/`.
- **Dependências**: fase 3.
- **Conclusão**: CRUD, ativação/desativação, dinheiro decimal e busca paginada funcionam.
- **Testes**: validação de preço, SKU tenant-scoped e isolamento nos dois módulos.

### Fase 7 — Quotes

- **Objetivo**: orçamento, itens snapshot e ciclo de aprovação.
- **Arquivos/módulos**: `quotes/`, utilitário decimal mínimo em `common/` se realmente compartilhado.
- **Dependências**: fases 4–6.
- **Conclusão**: sequência atômica, itens coerentes, estados válidos e totais exatos.
- **Testes**: transições, snapshots, concorrência da numeração, relações cruzadas e isolamento E2E.

### Fase 8 — Work Orders

- **Objetivo**: criar diretamente ou converter Quote aprovado; executar e consultar histórico.
- **Arquivos/módulos**: `work-orders/`, endpoint de histórico em `vehicles/`.
- **Dependências**: fase 7.
- **Conclusão**: conversão é única/transacional, itens são independentes, estados são validados e histórico deriva das ordens.
- **Testes**: conversão concorrente, transições, snapshots, histórico e isolamento E2E.

### Fase 9 — Payments

- **Objetivo**: pagamentos parciais, cancelamento preservado e estado financeiro derivado.
- **Arquivos/módulos**: `payments/`, consultas de total em `work-orders/`.
- **Dependências**: fase 8.
- **Conclusão**: soma confirmada nunca excede total, inclusive concorrente; entrega e pagamento permanecem independentes.
- **Testes**: Decimal, parcial/integral, cancelamento, concorrência, retenção e isolamento E2E.

### Fase 10 — Hardening de segurança e E2E

- **Objetivo**: revisar invariantes transversais e o fluxo completo.
- **Arquivos/módulos**: Guards, filters, config, suites `test/e2e/`.
- **Dependências**: fases 2–9.
- **Conclusão**: matriz de acesso coberta, CORS/Helmet/rate limiting ativos, erros não vazam internals e fluxo principal passa.
- **Testes**: fluxo ponta a ponta, múltiplos ataques A→B, tokens revogados, payloads extras e enumeração de IDs.

### Fase 11 — Contrato para frontend

- **Objetivo**: estabilizar OpenAPI como contrato independente para Lovable ou outro frontend.
- **Arquivos/módulos**: decorators/DTOs Swagger, exemplos, filtros e documentação.
- **Dependências**: fase 10.
- **Conclusão**: OpenAPI descreve autenticação, paginação, erros, enums e strings monetárias; cliente pode ser gerado sem ler o backend.
- **Testes**: geração/validação do documento OpenAPI e smoke test de um cliente gerado.

## Pontos que precisam de decisão antes da implementação

- URL pública usada nos links de ativação em cada ambiente.
- Provedor de e-mail para entregar convites quando o envio automatizado entrar no escopo.
- Parâmetros Argon2id finais após medição no ambiente de deploy.
- Origem CORS de produção e política de publicação do Swagger.
- Ambiente/plataforma de deploy, necessário antes de desenhar o container e o gerenciamento de secrets de produção.
