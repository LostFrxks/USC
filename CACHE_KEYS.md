# USC Cache Keys (Redis)

Prefix: `${REDIS_PREFIX}:` (default `usc:`)
Versioned key namespace: `v1:*`

## Read-through keys
- `v1:categories:list:{limit}:{offset}`
- `v1:products:list:{limit}:{offset}:{search}:{category}:{supplier_company}:{in_stock}`
- `v1:suppliers:list:{limit}:{offset}:{term}`
- `v1:companies:list:{user_id}:{limit}:{offset}:{search}`
- `v1:companies:memberships:{user_id}`
- `v1:profile:me:{user_id}`
- `v1:profile:auth_me:{user_id}`
- `v1:notifications:list:{user_id}:{limit}`
- `v1:orders:list:{user_id}:{buyer_company_id}:{limit}:{offset}`
- `v1:orders:detail:{user_id}:{order_id}:{buyer_company_id}`
- `v1:orders:inbox:{user_id}`
- `v1:orders:outbox:{user_id}`
- `v1:deliveries:list:{user_id}`
- `v1:deliveries:by_order:{user_id}:{order_id}`
- `v1:analytics:summary:{company_id}:{role}:{days}`
- `v1:analytics:insights:{company_id}:{role}:{days}`
- `v1:analytics:assistant:{user_id}:{company_id}:{role}:{days}:{selected_month}:{question_hash}`

## Invalidation patterns after mutations
- Product/category mutations:
  - `v1:products:*`, `v1:categories:*`, `v1:analytics:*`
- Company mutations:
  - `v1:companies:*`, `v1:profile:*`, `v1:suppliers:*`, `v1:analytics:*`, `v1:notifications:*`
- Order/delivery mutations:
  - `v1:orders:*`, `v1:deliveries:*`, `v1:notifications:*`, `v1:products:*`, `v1:analytics:*`

## TTL defaults
See `backend/app/core/config.py` and `backend/.env.example`.
