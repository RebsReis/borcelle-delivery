# Pagamentos — Mercado Pago

## 1. Credenciais

1. Crie uma aplicação em https://www.mercadopago.com.br/developers/panel/app (produto: *Checkout Transparente* / pagamentos online).
2. Em **Credenciais de teste**, copie *Public Key* e *Access Token* (começam com `TEST-`).
3. No `backend/.env`:
   ```
   MP_ACCESS_TOKEN=TEST-...
   MP_PUBLIC_KEY=TEST-...
   ```
4. Reinicie o backend. O site passa a mostrar "Ambiente de testes" e as formas online aparecem no checkout.

Para produção, troque pelas credenciais de produção (`APP_USR-...`). Credenciais privadas ficam só no backend; o frontend recebe apenas a Public Key pela rota `/api/store`.

## 2. Webhooks

O Mercado Pago só entrega webhooks em URL **HTTPS pública**.

- Em desenvolvimento, exponha a API: `cloudflared tunnel --url http://localhost:8000` ou `ngrok http 8000`, e coloque a URL em `PUBLIC_API_URL`.
- No painel da aplicação: **Webhooks > Configurar notificações**, URL `https://SEU-DOMINIO/api/payments/webhooks/mercadopago`, evento **Pagamentos**. Copie a **assinatura secreta** para `MP_WEBHOOK_SECRET`.

O backend valida o cabeçalho `x-signature` (HMAC-SHA256 sobre `id:{data.id};request-id:{x-request-id};ts:{ts};`), descarta duplicados (`webhook_events`) e confirma o status consultando a API do Mercado Pago.

Sem webhook, a reconciliação (`RECONCILE_INTERVAL_SECONDS`, padrão 60 s) e o botão "Já paguei, verificar" do PIX consultam os pagamentos pendentes.

## 3. Formas de pagamento

| Forma | Como funciona |
|---|---|
| PIX | `POST /v1/payments` com `payment_method_id=pix` e expiração (`PIX_EXPIRATION_MINUTES`). A tela mostra QR Code, copia e cola, contagem regressiva e atualiza sozinha. Expirado → pedido cancelado; o cliente pode gerar novo PIX. |
| Cartão de crédito / débito | Card Payment Brick tokeniza o cartão no navegador (número e CVV não passam pelo nosso servidor). O backend cria o pagamento com o token. Parcelas limitadas por `max_installments` e parcela mínima nas configurações da loja. |
| Carteira Mercado Pago | Checkout Pro (`/checkout/preferences`): redireciona ao Mercado Pago e volta para o acompanhamento. |
| Cartão na entrega / Dinheiro | Sem cobrança online; pedido nasce "recebido". Dinheiro aceita troco com cálculo automático. |

Apple Pay e Google Pay **não** são oferecidos pelo Checkout Transparente do Mercado Pago no Brasil. Se forem necessários, use um gateway que os suporte e implemente o `PaymentProvider` correspondente (veja ARQUITETURA.md).

Cada forma pode ser ligada ou desligada em `store_settings` (`pay_pix`, `pay_credit_online`, `pay_debit_online`, `pay_card_on_delivery`, `pay_cash`, `pay_wallet`). Na fase 2 isso fica no painel.

## 4. Testar no sandbox

Cartões de teste: https://www.mercadopago.com.br/developers/pt/docs/checkout-api/integration-test/test-cards

O nome do titular define o resultado: `APRO` (aprovado), `OTHE` (recusado), `CONT` (pendente), `CALL`, `FUND`, `SECU`, `EXPI`, `FORM`. CPF de teste: `12345678909`.

Roteiro mínimo antes de publicar:

1. Cartão `APRO` → pedido vai para "Pedido recebido".
2. Cartão `OTHE` → "Pagamento recusado"; gerar PIX pela tela funciona.
3. Cartão `CONT` → fica "em análise"; muda quando o Mercado Pago decidir.
4. PIX → QR Code gerado. No sandbox o PIX não é pago de verdade; para aprovar, use o usuário de teste comprador e o fluxo de teste do painel, ou confirme pelo status consultado.
5. Deixar um PIX expirar (use `PIX_EXPIRATION_MINUTES=5`) → pedido cancelado automaticamente.
6. Estorno: `POST /api/admin/orders/{id}/refund` (docs/OPERACAO.md).
7. Repetir o clique em "Confirmar" → um único pedido e uma única cobrança.
