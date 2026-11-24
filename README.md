# Borcelle Delivery

Plataforma própria de pedidos online da **Borcelle Hamburgueria**: cardápio interativo, personalização de produtos, carrinho, checkout em etapas, pagamentos pelo Mercado Pago e acompanhamento do pedido em tempo real.

Identidade visual: Design System *Urban Burger & Vintage Street Food* (Anton + Montserrat, paleta `#D4261B` / `#F2E3D0`), em `frontend/src/app/globals.css`.

## Status

| Fase | Escopo | Situação |
|---|---|---|
| **1** | Cardápio, busca e categorias, personalização com grupos obrigatórios/opcionais, carrinho persistente com upsell e cupons, checkout em 5 etapas, CEP + áreas de entrega, agendamento, PIX / cartão / dinheiro / cartão na entrega / carteira Mercado Pago, webhooks, acompanhamento em tempo real, PWA, LGPD, analytics | ✅ Pronta |
| 2 | Área do cliente com login, painel administrativo (dashboard, Kanban, produtos, marketing, configurações), fidelidade | A fazer |

Até a fase 2, a operação da loja (mudar status, estornar) é feita pela API administrativa provisória — veja [docs/OPERACAO.md](docs/OPERACAO.md).

## Stack

- **Frontend:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · GSAP + ScrollTrigger · Zustand · React Hook Form + Zod · Mercado Pago SDK React (Card Payment Brick)
- **Backend:** FastAPI · SQLAlchemy 2 · Alembic · PostgreSQL 16 · SSE para status do pedido
- **Integrações:** Mercado Pago, ViaCEP, Meta Conversions API e WhatsApp Cloud API (opcionais)

```
backend/   API FastAPI (app/), migrations (alembic/), testes (tests/)
frontend/  Next.js (src/app páginas, src/components, src/store, src/lib)
docs/      Arquitetura, pagamentos, operação e publicação
```

## Rodar localmente

### Com Docker (mais simples)

```bash
cp backend/.env.example backend/.env    # preencha o que tiver
docker compose up --build
```

Site em http://localhost:3000 e API em http://localhost:8000/docs. O banco é criado, migrado e populado com o cardápio demonstrativo automaticamente.

### Sem Docker

Requisitos: Python 3.12+, Node 22+, PostgreSQL 16.

```bash
# Banco
createuser -P borcelle            # senha: borcelle
createdb -O borcelle borcelle

# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --port 8000

# Frontend (outro terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

## Testes

```bash
createdb -O borcelle borcelle_test
cd backend && pytest -q
```

Os 18 testes rodam contra um PostgreSQL real, com o Mercado Pago simulado. Cobrem: preço recalculado no servidor, grupos obrigatórios e limites, opção de outro produto, produto indisponível, CEP fora da área, cupons (percentual, mínimo, esgotado), total divergente, troco, idempotência, loja fechada e agendamento, PIX aprovado por webhook assinado, assinatura inválida, webhook duplicado, cartão recusado com nova tentativa, parcelas, PIX expirado, transições de status, estorno e métodos desligados sem credenciais.

Para testar pagamentos no **sandbox real** do Mercado Pago, siga [docs/PAGAMENTOS.md](docs/PAGAMENTOS.md).

## O que depende de credenciais externas

| Recurso | Variável | Sem a credencial |
|---|---|---|
| PIX, cartão online, carteira Mercado Pago | `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY` | Formas online somem do checkout; um aviso aparece no topo do site. Dinheiro e cartão na entrega continuam funcionando. |
| Confirmação por webhook | `MP_WEBHOOK_SECRET` + `PUBLIC_API_URL` em HTTPS | Webhooks são recusados; a reconciliação automática (a cada 60 s) e o botão "Já paguei" confirmam o pagamento consultando o Mercado Pago. |
| Autocompletar endereço | ViaCEP (público, sem chave) | Cliente digita o endereço; a área de entrega continua validada pela faixa de CEP. |
| Notificações no WhatsApp | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | Nenhuma mensagem é enviada; o botão "Falar no WhatsApp" continua. |
| Meta Conversions API | `META_PIXEL_ID`, `META_CAPI_TOKEN` | Sem envio server-side. |
| GA4 / GTM / Meta Pixel | `NEXT_PUBLIC_GTM_ID`, `NEXT_PUBLIC_META_PIXEL_ID` | Scripts não carregam. Com IDs, só carregam após o aceite de cookies. |

Pagamentos **nunca** são simulados como aprovados. Com credenciais `TEST-...`, o site mostra "Ambiente de testes".

## Fotos dos produtos

Enquanto as fotos não são cadastradas, o site mostra uma ilustração da marca. Para incluir:

- **Hero:** salve `frontend/public/images/hero.webp` (produto recortado, fundo transparente, ~1600 px de largura) e gere o build de novo.
- **Produtos:** preencha `image_url` de cada produto (URL pública WebP/AVIF, quadrada, ≥ 800 px). Na fase 2 isso é feito pelo painel com upload.

## Publicação

Veja [docs/PUBLICACAO.md](docs/PUBLICACAO.md).

## Documentação

- [Arquitetura e banco de dados](docs/ARQUITETURA.md)
- [Pagamentos e Mercado Pago](docs/PAGAMENTOS.md)
- [Operação da loja (fase 1)](docs/OPERACAO.md)
- [Publicação em produção](docs/PUBLICACAO.md)
