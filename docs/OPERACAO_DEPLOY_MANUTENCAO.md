# Operação, Deploy e Manutenção

## 1. Pré-requisitos

- Node.js 20+
- npm 10+
- Docker + Docker Compose (opcional)

## 2. Execução Local

```bash
npm install
npm run dev
```

Acessos:

- Frontend: `http://localhost:5173`
- API: `http://localhost:4000`

## 3. Scripts do Monorepo

### Raiz

- `npm run dev`
- `npm run build`
- `npm run test`
- `npm run test:watch`
- `npm run test:server`
- `npm run test:client`
- `npm run start`
- `npm run docker:build`
- `npm run docker:up`
- `npm run docker:down`
- `npm run docker:logs`

### Client

- `npm run dev -w client`
- `npm run build -w client`
- `npm run preview -w client`
- `npm run test -w client`
- `npm run test:watch -w client`

### Server

- `npm run dev -w server`
- `npm run start -w server`
- `npm run test -w server`
- `npm run test:watch -w server`

## 4. Deploy via Docker Compose

### 4.1 Subida

```bash
docker compose up -d --build
```

### 4.2 Serviços

- `aurora-server`
  - porta: `4000`
  - healthcheck: `/api/health`
- `aurora-client`
  - porta: `5173` (nginx interno na porta `80`)

### 4.3 Persistência

- volume nomeado: `aurora_server_data`
- armazena os JSONs de dados do backend.

### 4.4 Comandos úteis

```bash
docker compose ps
docker compose logs -f
docker compose down
```

## 5. Variáveis de Ambiente

## 5.1 Server

- `PORT` (default `4000`)
- `FRONTEND_ORIGIN` (default `http://localhost:5173`)
- `NODE_ENV` (`development` ou `production`)
- `SESSION_TTL_MS`
- `SESSION_IDLE_TTL_MS`
- `BCRYPT_ROUNDS`
- `RESET_TOKEN_TTL_MS`
- `EMAIL_TOKEN_TTL_MS`
- `AUDIT_LOG_LIMIT`
- `MFA_SECRET_KEY`
- `HCAPTCHA_SECRET`

## 5.2 Client

- `VITE_API_URL`

## 6. Testes e Qualidade

## 6.1 Suítes atuais

- Backend (`server/src/app.test.js`): contratos de saúde, headers, auth e 404.
- Frontend (`client/src/lib/api.test.js`): política de CSRF e rotação de token.

## 6.2 Execução

```bash
npm run test
```

## 7. Segurança Operacional

Checklist mínimo de produção:

- [ ] rodar com `NODE_ENV=production`
- [ ] expor backend somente via HTTPS (proxy reverso)
- [ ] configurar `MFA_SECRET_KEY` forte
- [ ] configurar `FRONTEND_ORIGIN` real
- [ ] revisar CSP e headers de segurança
- [ ] habilitar captcha real quando aplicável
- [ ] definir rotina de backup para `server/data`

## 8. Backup e Recuperação

Arquivos críticos:

- `users.json`
- `sessions.json`
- `mixes.json`
- `history.json`
- `login-attempts.json`
- `password-resets.json`
- `auth-audit.json`

Recomendação:

- backup periódico automatizado;
- restauração testada em staging;
- política de retenção definida por ambiente.

## 9. Troubleshooting

## 9.1 Porta 4000 em uso

```bash
lsof -i :4000 -n -P
kill -9 <PID>
```

Ou rodar server em outra porta:

```bash
PORT=4001 npm run dev -w server
```

## 9.2 Erro de CSRF

- validar sessão ativa em `/api/auth/me`;
- obter token atualizado em `/api/auth/csrf`;
- enviar `X-CSRF-Token` em métodos mutáveis.

## 9.3 Aviso de buildx no Docker

Se aparecer aviso de plugin ausente, instalar `docker-buildx` no Docker CLI local.

## 9.4 Client não comunica com API

- conferir `VITE_API_URL`;
- conferir `FRONTEND_ORIGIN`;
- validar CORS e cookies no navegador.

## 10. Limitações e Próximos Passos

Limitações atuais:

- checkout sem gateway real;
- ativação sem serviço real de envio;
- persistência JSON para cenários de baixa/média escala.

Próximos passos:

- integrar pagamento real (Stripe/Mercado Pago);
- migrar para banco relacional;
- ampliar cobertura de testes (rotas + E2E).
