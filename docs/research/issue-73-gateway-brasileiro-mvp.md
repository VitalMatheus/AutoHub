# Issue #73 — gateway brasileiro para pagamentos do MVP

**Data da consulta:** 03/09/2026 (America/Recife)  
**Escopo:** escolher um gateway brasileiro para as mensalidades do AutoHub, aceitando PIX e cartão de crédito à vista, com webhook, idempotência, sandbox, expiração, estorno/chargeback, custos, liquidação e cadastro.

## Conclusão

Recomendo **Asaas** como primeiro gateway do MVP, atrás de uma pequena porta de adaptação no módulo de cobranças. Ele oferece uma API única para cliente, cobrança PIX e cartão, QR Code dinâmico, fatura hospedada ou checkout próprio, sandbox com Webhooks e eventos explícitos para confirmação, recebimento, estorno e chargeback. Isso se encaixa no modelo do MVP sem introduzir recorrência automática, parcelamento ou split.

O AutoHub deve considerar `PAYMENT_RECEIVED` como evidência de valor disponível e `PAYMENT_CONFIRMED` como estado intermediário; a implementação não deve marcar a mensalidade como paga por redirect nem apenas pela resposta síncrona da criação. A decisão de qual evento produz o settlement definitivo é uma regra do AutoHub, não deve vazar para o domínio como enum do Asaas.

## Requisitos do AutoHub e critérios

O documento de produto exige uma nova tentativa manual para a mesma mensalidade, PIX ou cartão de crédito em uma parcela, confirmação por webhook autoritativo, autenticação e replay protection do webhook, e reabertura da mesma mensalidade em reversão ou chargeback. Estorno iniciado pelo produto, cartão armazenado, parcelamento e cobrança recorrente ficam fora do MVP. [Especificação comercial do MVP](../specs/platform-commercial-administration.md#payment)

| Critério | Requisito mínimo |
| --- | --- |
| Meios | PIX e cartão de crédito à vista; sem parcelas |
| Criação | Uma cobrança externa por tentativa, ligada ao `SubscriptionCharge` por referência idempotente |
| Confirmação | Só webhook autenticado mais consulta server-to-server do recurso |
| Repetição | Reenvio de webhook e retry da requisição não podem gerar settlement duplicado |
| Expiração | Guardar vencimento/expiração externa; expiração não paga a mensalidade e permite nova tentativa |
| Reversão | Estorno e chargeback reabrem a mesma mensalidade e ficam no histórico |
| Segurança | Segredo somente no backend, HTTPS, assinatura/token validado e payload externo não confiável |
| Dinheiro | Decimal/string no AutoHub; valor e moeda conferidos contra a mensalidade antes de liquidar |

## Evidências do Asaas

### PIX, cartão e expiração

- O endpoint de cobrança aceita cobranças avulsas por PIX ou cartão e exige cliente, valor e `dueDate`; `externalReference` identifica a cobrança no sistema integrador. [Criar nova cobrança](https://docs.asaas.com/reference/criar-nova-cobranca)
- Para PIX, a API retorna QR Code dinâmico e código copia-e-cola por consulta; o QR Code é de uso único e, na documentação consultada, expira 12 meses depois do vencimento da cobrança. [Cobranças via PIX / QR Code dinâmico](https://docs.asaas.com/docs/cobrancas-via-pix)
- Para cartão avulso, o integrador envia somente `value`; `installmentCount`, `installmentValue` e `totalValue` são para parcelamento e não devem ser enviados. Pode-se usar a fatura hospedada (`invoiceUrl`) para evitar que o AutoHub manipule dados de cartão. [Cobranças via cartão de crédito](https://docs.asaas.com/docs/cobrancas-via-cartao-de-credito)
- O cartão exige HTTPS quando os dados são capturados pela aplicação. Para o MVP, a recomendação é começar pela fatura/checkout hospedado; checkout transparente deve ser uma decisão posterior de segurança e UX.

### Webhooks, idempotência e estados

- Os eventos de cobrança incluem criação, análise de risco, confirmação, recebimento, recusa de captura, vencimento, estorno, chargeback e reversão da disputa. [Eventos para cobranças](https://docs.asaas.com/docs/webhook-para-cobrancas)
- `PAYMENT_CONFIRMED` significa que o pagamento foi efetuado, mas o saldo ainda não está disponível; `PAYMENT_RECEIVED` significa que a cobrança foi recebida e o valor está disponível na conta Asaas. [Eventos para cobranças](https://docs.asaas.com/docs/webhook-para-cobrancas)
- O payload possui um `id` único de evento, indicado para impedir processamento duplicado. O endpoint deve persistir esse identificador antes de aplicar a transição de negócio e responder sucesso somente após uma operação idempotente. [Eventos para cobranças](https://docs.asaas.com/docs/webhook-para-cobrancas)
- O webhook pode ser protegido por um token configurado, enviado no header `asaas-access-token`; a própria documentação recomenda não reutilizar a API Key como token de webhook. [Eventos para assinaturas — validação](https://docs.asaas.com/docs/eventos-para-assinaturas)
- O Sandbox funciona com Webhooks e permite validar recebimento, estados assíncronos, idempotência, falhas e reprocessamentos. A documentação alerta para não concluir uma operação somente pela resposta inicial da API. [FAQ do Sandbox](https://docs.asaas.com/docs/faq-sandbox)

### Estorno e chargeback

- A API permite estorno total ou parcial de cobrança paga por cartão ou PIX. As taxas não são devolvidas e um estorno PIX pode falhar por saldo insuficiente; portanto, o AutoHub não deve iniciar estorno no MVP. [Estornar cobrança](https://docs.asaas.com/reference/estornar-cobranca)
- O chargeback expõe status como `REQUESTED`, `IN_DISPUTE`, `DISPUTE_LOST`, `REVERSED` e `DONE`, além do motivo. A integração deve preservar os valores originais e tolerar enums novos. [Chargeback](https://docs.asaas.com/docs/chargeback)
- Os eventos `PAYMENT_CHARGEBACK_REQUESTED`, `PAYMENT_CHARGEBACK_DISPUTE` e `PAYMENT_AWAITING_CHARGEBACK_REVERSAL` permitem refletir a contestação e sua evolução. [Eventos para cobranças](https://docs.asaas.com/docs/webhook-para-cobrancas)

### Sandbox, liquidação e cadastro

- Sandbox e produção são ambientes separados: clientes, cobranças, chaves, Webhooks, saldo e configurações não são compartilhados. PIX e cartão têm fluxos de teste; cartão usa números fictícios e o Sandbox não movimenta dinheiro real. [FAQ do Sandbox](https://docs.asaas.com/docs/faq-sandbox) e [teste de cartão](https://docs.asaas.com/docs/testando-pagamento-com-cartao-de-credito)
- O Sandbox permite confirmar/receber cobranças pela interface e gerar saldo fictício para testar fluxos; chargeback é testável mediante solicitação ao Asaas. [O que pode ser testado](https://docs.asaas.com/docs/o-que-pode-ser-testado)
- A documentação separa “confirmado” de “recebido/disponível”. A integração deve salvar ambos os timestamps/status externos e escolher o segundo para a receita liquidada do AutoHub. [Eventos para cobranças](https://docs.asaas.com/docs/webhook-para-cobrancas)
- O cliente da cobrança pode ser cadastrado com nome, e-mail e `cpfCnpj`; o Checkout também pode coletar os dados do pagador. Para a primeira integração, o AutoHub deve enviar os dados cadastrais mínimos já conhecidos e não assumir que a conta pagadora é a mesma entidade da oficina. [Como informar os dados do cliente](https://docs.asaas.com/docs/como-informar-os-dados-do-cliente)
- A chave de API deve ser criada pela interface e usada via HTTPS; chaves podem ser desabilitadas após inatividade e expirar permanentemente depois de seis meses. Isso exige segredo em variável de ambiente e procedimento operacional de rotação. [Chaves de API](https://docs.asaas.com/docs/chaves-de-api)

### Custos

As fontes oficiais consultadas não fornecem nesta pesquisa uma tabela contratual única e permanente para a combinação de cobrança PIX/cartão, prazo de recebimento e antecipação. O próprio Asaas orienta consultar as condições aplicadas ao contrato dentro da conta; há uma política pública de recebimentos PIX que menciona gratuidade limitada e possível cobrança a partir do 101º recebimento em determinados cenários. [PIX PJ — Asaas](https://www.asaas.com/pix-asaas) e [taxas de recebimento PIX](https://central.ajuda.asaas.com/hc/pt-br/articles/32040230167067-Quais-s%C3%A3o-as-taxas-para-utilizar-as-transfer%C3%AAncias-Pix)

**Fato:** o custo efetivo depende da modalidade, contrato, prazo de liquidação e eventual antecipação.  
**Inferência:** para mensalidades de R$ 79,00, a decisão não deve ser tomada por uma taxa genérica publicada; deve comparar uma simulação comercial real incluindo PIX, cartão à vista, estorno e prazo de disponibilidade.

## Alternativas consideradas e rejeitadas para o primeiro gateway

### Mercado Pago

É uma alternativa tecnicamente viável: a API exige `X-Idempotency-Key` para criar pagamentos PIX e cartão; Webhooks são recomendados, usam assinatura secreta `x-signature`, HTTPS POST e podem ser simulados no painel. [PIX](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/payment-brick/payment-submission/pix), [cartões](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/cards) e [Webhooks](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/notifications)

Fica como segunda opção porque o fluxo de Checkout/Orders, credenciais de teste, notificações por tópico e consulta do recurso exigem uma adaptação mais específica ao produto escolhido; a documentação também informa que IPN está sendo descontinuado. Os preços e prazos de recebimento variam conforme configuração/contrato, portanto não há vantagem de custo demonstrada nesta pesquisa. [Notificações](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications)

### Pagar.me

Também atende PIX, cartão, Webhooks e teste de chargeback: a documentação descreve QR Code PIX com expiração configurável, chargeback em transação de teste e notificações de disputa. [PIX](https://docs.pagar.me/reference/pix-2), [transação de teste](https://docs.pagar.me/v3/reference/atualizando-uma-transa%C3%A7%C3%A3o-de-teste) e [chargeback](https://docs.pagar.me/page/chargeback-novo-status-na-cobran%C3%A7a)

Fica rejeitado para a primeira entrega por exigir escolha de versão/afiliação da conta e por apresentar custos e prazos fortemente dependentes do contrato: a própria central informa que taxas, antifraude, cobertura de fraude e prazos são consultados na Dashboard. [Taxas e prazos](https://pagarme.helpjuice.com/pt_BR/p1-manual-da-dashboard/taxas-como-vejo-as-minhas-taxas)

Isso não é uma rejeição definitiva. Pagar.me deve voltar à comparação se o AutoHub precisar de marketplace/split, antifraude configurável ou conciliação mais sofisticada.

## Contrato mínimo recomendado para o adaptador

O domínio do AutoHub deve conhecer somente conceitos próprios:

```text
createAttempt(charge, method) -> PendingAttempt
getAttempt(attempt) -> ProviderAttempt
handleWebhook(request) -> AcceptedWebhook
```

`PendingAttempt` deve conter `provider`, `providerPaymentId`, `externalReference`, `method`, `amount`, `currency`, `expiresAt` e uma URL/QR Code quando aplicável. O adaptador deve enviar uma chave de idempotência derivada da tentativa, nunca uma chave nova em cada retry.

`handleWebhook` deve:

1. validar HTTPS, token do Asaas e formato básico;
2. persistir/deduplicar o ID do evento externo;
3. consultar a cobrança no Asaas antes de confiar em valor, cliente ou status;
4. conferir `providerPaymentId`, `externalReference`, valor e moeda;
5. mapear somente estados próprios: `PENDING`, `CONFIRMED`, `SETTLED`, `EXPIRED`, `FAILED`, `REVERSED`, `CHARGEBACK`;
6. aplicar uma transação idempotente que cria ou reabre o settlement e o histórico;
7. responder rapidamente após a transação; eventos desconhecidos ficam registrados sem quebrar a fila.

O adaptador não deve expor ao domínio enums `PAYMENT_*`, `chargeback.reason`, QR Code ou headers do provedor. O frontend recebe do backend apenas a tentativa pendente e seu estado derivado.

## Pressupostos e pendências

**Pressupostos:**

- O pagador é a conta comercial do AutoHub, enquanto cada oficina é cliente/beneficiária do serviço; não haverá split entre oficinas.
- O MVP exibirá uma fatura/checkout hospedado para cartão inicialmente, reduzindo o escopo PCI e o risco de armazenar PAN/CVV.
- A mensalidade só é considerada receita recebida quando o provedor informar que o valor está disponível (`PAYMENT_RECEIVED`).

**Pendências antes da implementação:**

- Confirmar com o comercial do Asaas as tarifas efetivas para PIX e cartão à vista, prazo de liquidação, custo de estorno e regras de chargeback.
- Confirmar o cadastro produtivo exigido para a conta AutoHub: razão social/nome, CNPJ ou CPF, endereço, representante, conta bancária e validações adicionais aplicáveis ao contrato.
- Escolher se a expiração apresentada ao usuário será a `dueDate` do AutoHub ou a `expirationDate` específica do QR Code.
- Obter credenciais Sandbox, configurar URL pública HTTPS e testar aprovação, recusa, expiração, webhook repetido, timeout, estorno e chargeback.
- Registrar a decisão final em ADR antes de integrar o provedor no código.

## Fontes oficiais consultadas

- Asaas: [cobranças](https://docs.asaas.com/docs/guia-de-cobrancas), [PIX](https://docs.asaas.com/docs/cobrancas-via-pix), [cartão](https://docs.asaas.com/docs/cobrancas-via-cartao-de-credito), [Webhooks](https://docs.asaas.com/docs/webhook-para-cobrancas), [Sandbox](https://docs.asaas.com/docs/faq-sandbox), [estorno](https://docs.asaas.com/reference/estornar-cobranca), [chargeback](https://docs.asaas.com/docs/chargeback), [dados do cliente](https://docs.asaas.com/docs/como-informar-os-dados-do-cliente), [chaves](https://docs.asaas.com/docs/chaves-de-api).
- Mercado Pago Developers: [PIX e idempotência](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/payment-brick/payment-submission/pix), [cartão](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/cards), [Webhooks e assinatura](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/notifications), [notificações](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications).
- Pagar.me: [PIX](https://docs.pagar.me/reference/pix-2), [teste](https://docs.pagar.me/v3/reference/atualizando-uma-transa%C3%A7%C3%A3o-de-teste), [chargeback](https://docs.pagar.me/page/chargeback-novo-status-na-cobran%C3%A7a), [taxas e prazos](https://pagarme.helpjuice.com/pt_BR/p1-manual-da-dashboard/taxas-como-vejo-as-minhas-taxas).

