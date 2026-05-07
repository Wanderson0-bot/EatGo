# EatGo Backend

Backend Node.js/Express para a plataforma EatGo, alinhado ao front atual e ao schema MySQL.

## Recursos

- Autenticação da gestão com JWT
- Rotas públicas para estabelecimentos e cardápio
- Rotas protegidas para gestão do estabelecimento
- CRUD de cardápio
- Leitura e atualização de pedidos
- Criação de pedidos do marketplace
- Rate limit em auth e criação de pedidos
- Headers de segurança com `helmet`
- Validação de payload com `zod`

## Estrutura

- `src/server.js`: bootstrap do servidor
- `src/app.js`: app Express e middlewares
- `src/config`: ambiente e conexão com MySQL
- `src/routes`: rotas públicas, auth e gestão
- `src/middlewares`: auth, validação e erros
- `src/services`: token e senha

## Como usar

1. Copie `.env.example` para `.env`
2. Ajuste as credenciais do MySQL
3. Instale as dependências:

```bash
npm install
```

4. Rode o projeto:

```bash
npm run dev
```

## Gerar hash de senha

Para criar um usuário da gestão no banco, gere primeiro a senha em hash:

```bash
npm run hash:password -- minha-senha-forte
```

## Endpoints principais

- `GET /health`
- `POST /api/auth/partner/login`
- `GET /api/auth/me`
- `GET /api/public/establishments`
- `GET /api/public/establishments/:id`
- `GET /api/public/establishments/:id/menu`
- `PATCH /api/management/establishment`
- `DELETE /api/management/establishment`
- `GET /api/management/menu-items`
- `POST /api/management/menu-items`
- `PATCH /api/management/menu-items/:id`
- `DELETE /api/management/menu-items/:id`
- `GET /api/management/orders`
- `PATCH /api/management/orders/:id/status`
- `POST /api/orders`

## Observações

- O login da gestão exige um registro em `usuarios_estabelecimento`
- A senha deve ser salva como hash usando o helper de `password.service.js`
- O front atual ainda usa `localStorage`; esta API já deixa a base pronta para substituir isso
