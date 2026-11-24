# Publicação em produção

## Opção A — um servidor (VPS) com Docker

1. Servidor com Docker e um domínio, por exemplo `borcelle.com.br` (site) e `api.borcelle.com.br` (API).
2. Clone o repositório e crie `backend/.env` a partir de `backend/.env.example`:
   - `DATABASE_URL` com senha forte (troque também no `docker-compose.yml`, ou use um Postgres gerenciado)
   - `FRONTEND_URL=https://borcelle.com.br`, `PUBLIC_API_URL=https://api.borcelle.com.br`, `CORS_ORIGINS=https://borcelle.com.br`
   - `ADMIN_API_KEY`, credenciais do Mercado Pago de produção e `MP_WEBHOOK_SECRET`
3. No `docker-compose.yml`, ajuste os `args` do frontend: `NEXT_PUBLIC_API_URL=https://api.borcelle.com.br`, `NEXT_PUBLIC_SITE_URL=https://borcelle.com.br` (e os IDs de GTM/Pixel, se houver). Remova a porta pública `5432` do banco.
4. Coloque um proxy com HTTPS na frente (Caddy é o mais simples):
   ```
   borcelle.com.br { reverse_proxy localhost:3000 }
   api.borcelle.com.br {
     reverse_proxy localhost:8000 { flush_interval -1 }   # mantém o SSE em tempo real
   }
   ```
5. `docker compose up -d --build`.
6. Configure o webhook no painel do Mercado Pago (docs/PAGAMENTOS.md) e rode o roteiro de testes.

## Opção B — serviços gerenciados

- **Frontend:** Vercel (raiz `frontend/`, variáveis `NEXT_PUBLIC_*` e `API_INTERNAL_URL`).
- **Backend:** Render, Railway ou Fly.io com `backend/Dockerfile`.
- **Banco:** Postgres gerenciado (Neon, Supabase, RDS). Rode `alembic upgrade head` a cada deploy (o Dockerfile já faz).

## Checklist

- [ ] HTTPS em site e API
- [ ] Dados reais da loja, regiões, horários, preços e fotos revisados (o seed é demonstrativo)
- [ ] Cupons de demonstração removidos ou ajustados
- [ ] Credenciais de produção do Mercado Pago + webhook testado
- [ ] `ADMIN_API_KEY` forte e guardada fora do repositório
- [ ] Política de privacidade revisada juridicamente (o texto em `/privacidade` é um modelo)
- [ ] Backup diário do PostgreSQL
- [ ] Teste completo de compra no celular, tablet e desktop

## Observações de segurança

- O limitador de requisições é em memória (uma instância). Com várias instâncias, use Redis ou o limitador do proxy.
- `npm audit` aponta um aviso no PostCSS embutido no próprio Next.js 15. Ele só é usado no build, com CSS do próprio projeto; some ao migrar para o Next 16.
