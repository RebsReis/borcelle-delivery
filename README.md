# Borcelle Hamburgueria — Protótipo

Protótipo navegável da plataforma de pedidos online da **Borcelle Hamburgueria**, para apresentação. Roda só no navegador: cardápio, pedidos e pagamentos são **simulados** e nada é cobrado.

Design System *Urban Burger & Vintage Street Food*: Anton + Montserrat, paleta `#D4261B` / `#F2E3D0` / `#321B13`, tokens em `src/app/globals.css`.

## O que dá para demonstrar

- **Home** com hero de impacto, tipografia gigante ao fundo, faixa animada e oferta em formato de ticket
- **Cardápio** com busca, categorias fixas com rolagem automática, selos, promoções, recomendados e produto indisponível
- **Personalização** (janela no desktop, painel deslizante no celular): ponto da carne, retirar ingredientes, adicionais, molhos, acompanhamento e bebida, com limites e preço atualizando ao vivo
- **Carrinho** salvo no aparelho, com edição, sugestões de venda (batata, bebida, bacon, virar combo) e cupons
- **Checkout em 5 etapas**: identificação sem cadastro, delivery ou retirada, agora ou agendado, endereço com CEP (ViaCEP) e área de entrega, pagamento e revisão
- **Pagamentos simulados**: PIX (QR ilustrativo, copia e cola, contagem regressiva e botão "Simular pagamento aprovado"), cartão de crédito com parcelas, débito, cartão na entrega e dinheiro com troco
- **Acompanhamento** com linha do tempo que avança sozinha (recebido → confirmado → em preparação → pronto → saiu para entrega → entregue, em ~2 min)
- Meus pedidos, Minha conta (dados salvos no aparelho), aviso de cookies (LGPD), app instalável (PWA)

### Dados para testar

| O quê | Valor |
|---|---|
| Cupons | `BEMVINDO10` (10% acima de R$ 40), `FRETEGRATIS` (acima de R$ 60), `BORCELLE5` (R$ 5 acima de R$ 30) |
| CEPs atendidos | São Paulo capital (01000-000 a 05999-999 e Zona Leste 08000-000 a 08499-999) e São José dos Campos (12209-000 a 12248-999) |
| Cartão aprovado | `4111 1111 1111 1111`, qualquer nome, validade futura e CVV |
| Cartão recusado | `4000 0000 0000 0002` |

## Rodar

Requer Node 20+.

```bash
npm install
npm run dev
```

Abra http://localhost:3000. Para apresentar no celular, publique na Vercel: importe este repositório em vercel.com/new e clique em **Deploy** (sem nenhuma configuração).

## Personalizar

Tudo em `src/lib/mock/data.ts`:

- **Produtos, preços, categorias e adicionais**
- **Fotos:** preencha `image` em cada produto com o caminho de uma imagem em `public/images/` (ex.: `image: "/images/double-bacon.webp"`). Sem foto, aparece uma ilustração da marca.
- **Foto do hero:** salve `public/images/hero.webp` (produto recortado, fundo transparente).
- **Regiões de entrega, taxas e cupons**
- **Dados da loja** (endereço, WhatsApp, tempo de preparo)

## Versão completa

A branch [`plataforma-completa`](../../tree/plataforma-completa) guarda a versão com backend real (FastAPI + PostgreSQL, Mercado Pago com webhooks, testes automatizados), caso o projeto avance além do protótipo.

## Stack

Next.js 15 · React 19 · TypeScript · Tailwind CSS · GSAP + ScrollTrigger · Zustand · React Hook Form + Zod
