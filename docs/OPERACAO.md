# Operação da loja — fase 1

O painel administrativo chega na fase 2. Até lá, a operação usa a API administrativa, protegida por `ADMIN_API_KEY` (cabeçalho `X-Admin-Key`). Gere uma chave forte: `openssl rand -hex 32`.

```bash
API=http://localhost:8000
KEY=sua-chave

# Últimos 100 pedidos (filtro opcional ?status=received)
curl -H "X-Admin-Key: $KEY" $API/api/admin/orders

# Avançar status
curl -X PATCH -H "X-Admin-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"status":"confirmed"}' $API/api/admin/orders/PUBLIC_ID/status
# Sequência: confirmed → preparing → ready → out_for_delivery → delivered (ou cancelled)

# Estornar pagamento aprovado
curl -X POST -H "X-Admin-Key: $KEY" $API/api/admin/orders/PUBLIC_ID/refund
```

O cliente vê cada mudança na hora na página do pedido. Toda mudança fica em `order_status_history` e `audit_logs`.

## Configurações (direto no banco até a fase 2)

```sql
-- Pausar novos pedidos
UPDATE store_settings SET is_paused = true, pause_message = 'Voltamos às 19h' WHERE id = 1;

-- Horários (0 = segunda ... 6 = domingo; fechamento menor que abertura = passa da meia-noite)
SELECT * FROM business_hours ORDER BY weekday;

-- Feriado (loja fechada no dia)
INSERT INTO holidays (day, name) VALUES ('2026-12-25', 'Natal');

-- Região de entrega por faixa de CEP
INSERT INTO delivery_zones (name, cep_start, cep_end, fee_cents, eta_min_minutes, eta_max_minutes, min_order_cents, is_active)
VALUES ('Vila Nova', 12230000, 12234999, 800, 35, 50, 0, true);

-- Produto indisponível
UPDATE products SET is_available = false WHERE slug = 'veggie-grao';

-- Foto do produto
UPDATE products SET image_url = 'https://.../double-bacon.webp' WHERE slug = 'double-bacon';
```

Os dados iniciais (`python -m app.seed`) são **demonstrativos**: endereço, telefone, faixas de CEP (São José dos Campos/SP), preços e cupons (`BEMVINDO10`, `FRETEGRATIS`, `BORCELLE5`) precisam ser revisados antes de publicar.
