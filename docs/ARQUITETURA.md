# Arquitetura

## Visão geral

```
Navegador (Next.js / PWA)
  │  REST + SSE
  ▼
FastAPI ──► PostgreSQL
  │
  ├──► Mercado Pago (pagamentos, consultas, estornos)
  │◄── Webhooks do Mercado Pago (assinatura HMAC validada)
  ├──► ViaCEP (endereço)
  └──► Meta CAPI / WhatsApp Cloud API (opcionais, em segundo plano)
```

Princípios:

- **O servidor é a fonte da verdade do preço.** O navegador envia só IDs de produtos e opções; `services/pricing.py` recalcula tudo (promoção, adicionais, limites de grupos, taxa, cupom, pedido mínimo). Se o total esperado pelo cliente divergir, o pedido é recusado com 409.
- **Valores em centavos (inteiros)** em todo o sistema.
- **Retrato do pedido:** `order_items` e `order_item_options` copiam nome e preço no momento da compra.
- **Idempotência:** `POST /api/orders` exige o cabeçalho `Idempotency-Key` (único no banco). Repetir a chave devolve o mesmo pedido. Cada cobrança usa `X-Idempotency-Key` própria no Mercado Pago.
- **Status do pagamento nunca vem do navegador nem do corpo do webhook:** sempre de `GET /v1/payments/{id}`.

## Backend (`backend/app`)

| Arquivo | Responsabilidade |
|---|---|
| `models.py` | Tabelas, enums e constraints |
| `schemas.py` | Contratos da API (Pydantic) |
| `services/pricing.py` | Cálculo e validação do carrinho |
| `services/store.py` | Aberto/fechado, feriados, pausa, horários de agendamento |
| `services/delivery.py` | ViaCEP e regiões por faixa de CEP |
| `services/orders.py` | Criação de pedido, cobranças, transições, expiração, estorno |
| `services/notify.py` | WhatsApp e Meta CAPI |
| `payments/base.py` | Contrato `PaymentProvider` (troca de gateway) |
| `payments/mercadopago.py` | Implementação Mercado Pago |
| `routers/` | `public` (loja, cardápio, CEP, cotação), `orders` (pedido, SSE, nova tentativa), `payments` (webhooks), `admin` (fase 1) |
| `ratelimit.py` | Limite por IP nas rotas sensíveis |

### Trocar ou adicionar gateway

Implemente `PaymentProvider` (`create_pix`, `create_card`, `create_redirect`, `get_payment`, `cancel`, `refund`, `verify_webhook`, `webhook_payment_id`) em `payments/<gateway>.py`, registre em `payments/__init__.py` e crie a rota de webhook correspondente.

### Transições de status

```
awaiting_payment → received → confirmed → preparing → ready → out_for_delivery → delivered
        └──────────────┴───────────┴───────────┴─────────┴──→ cancelled
```

Pagamento na entrega já nasce `received`. Na retirada, `out_for_delivery` é exibido como "Disponível para retirada".

### Endpoints

| Método | Rota | Uso |
|---|---|---|
| GET | `/api/store` | Status, previsões, formas de pagamento ativas, ambiente |
| GET | `/api/store/slots` | Horários de agendamento |
| GET | `/api/menu` | Categorias, produtos e grupos de opções |
| GET | `/api/delivery/cep/{cep}` | Endereço + área atendida e taxa |
| POST | `/api/cart/quote` | Cotação do carrinho |
| POST | `/api/orders` | Cria pedido (exige `Idempotency-Key`) |
| GET | `/api/orders/{public_id}` | Consulta pedido |
| GET | `/api/orders/{public_id}/events` | SSE com mudanças de status |
| POST | `/api/orders/{public_id}/sync` | Confere pagamento pendente no provedor |
| POST | `/api/orders/{public_id}/payments` | Nova tentativa de pagamento |
| POST | `/api/payments/webhooks/mercadopago` | Webhook |
| * | `/api/admin/...` | Operação provisória (fase 1) |

Documentação interativa: `http://localhost:8000/docs`.

## Banco de dados

Tabelas da fase 1: `categories`, `products`, `option_groups`, `options`, `product_option_groups`, `store_settings`, `business_hours`, `holidays`, `delivery_zones`, `coupons`, `customers`, `addresses`, `orders`, `order_items`, `order_item_options`, `order_status_history`, `payments`, `webhook_events`, `audit_logs`; sequência `order_number_seq` (número exibido do pedido, começa em 1001).

Constraints relevantes: preços ≥ 0, promoção menor que o preço, limites de grupo coerentes, faixa de CEP válida, `uq_payment_provider_id`, `uq_webhook_event`, `orders.idempotency_key` único.

Previstas para a fase 2 (nova migration): usuários administrativos e papéis, fidelidade, banners, campanhas.

Migrations: `alembic revision --autogenerate -m "..."` e `alembic upgrade head`.

## Frontend (`frontend/src`)

| Pasta | Conteúdo |
|---|---|
| `app/` | Páginas: `/`, `/cardapio`, `/carrinho`, `/checkout`, `/pedido/[id]`, `/pedidos`, `/conta`, `/privacidade`; manifest, robots, sitemap |
| `components/` | Header + navegação inferior, Hero, Menu, ProductSheet, Cart, checkout, acompanhamento, UI base |
| `store/` | Zustand: carrinho persistido (`localStorage`), perfil salvo no aparelho |
| `lib/` | Cliente da API, formatação, cotação, analytics, animações |

Tokens do Design System em `app/globals.css`; o Tailwind só referencia essas variáveis.

Animações (GSAP + ScrollTrigger): revelação dos títulos com máscara, entrada do hambúrguer (scale 0,92 → 1), parallax da tipografia de fundo, stagger nos cards, voo até o carrinho, valores animados, transição entre etapas do checkout, carimbo de confirmação. Tudo respeita `prefers-reduced-motion`; nada bloqueia a compra.

PWA: `manifest.webmanifest`, ícones em `public/icons`, `public/sw.js` (cache de estáticos e página offline; a API nunca é cacheada).

## Analytics

Eventos: `view_item`, `add_to_cart`, `remove_from_cart`, `begin_checkout`, `add_payment_info`, `purchase` (GA4 via `dataLayer`) e equivalentes no Meta Pixel. Só disparam com consentimento. `purchase` dispara uma única vez por pedido, na página de acompanhamento, quando o pagamento está aprovado ou o pedido pago na entrega foi recebido. O backend envia `Purchase` à Conversions API com o mesmo `event_id` (o `public_id`) para a Meta deduplicar.
