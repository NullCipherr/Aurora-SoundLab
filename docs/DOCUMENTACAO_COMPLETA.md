# Aurora SoundLab - Documentação Completa

## 1. Resumo Executivo

O **Aurora SoundLab** é uma plataforma web de criação de ambientes sonoros imersivos com:

- geração de áudio procedural em tempo real no frontend (Web Audio API);
- gerenciamento de mixes e histórico via API Node.js/Express;
- autenticação com sessão em cookie HttpOnly, proteção CSRF, MFA opcional e trilha de auditoria;
- exportação de áudio para múltiplos formatos e compartilhamento por link público.

Este documento é a referência técnica central do projeto e cobre arquitetura, execução, contratos de API, segurança, dados, operação, manutenção e roadmap.

---

## 2. Objetivos do Produto

### 2.1 Problema que o projeto resolve

Usuários que estudam, trabalham, escrevem ou criam conteúdo geralmente precisam de trilhas sonoras personalizadas para manter foco, reduzir distrações e induzir estados mentais específicos.

### 2.2 Proposta de valor

- Criar atmosferas sonoras personalizadas em poucos cliques.
- Salvar, recuperar, duplicar, favoritar e compartilhar mixes.
- Exportar o resultado em formatos prontos para consumo e distribuição.

### 2.3 Públicos-alvo

- criadores de conteúdo;
- profissionais de produto e design;
- estudantes e leitores;
- equipes que precisam de “soundscapes” para rituais de foco.

---

## 3. Stack Técnica

### 3.1 Frontend

- React 18
- Vite 5
- CSS custom (sem framework externo)
- Web Audio API + Canvas API

### 3.2 Backend

- Node.js (ESM)
- Express 4
- zod (validação de entrada)
- helmet (hardening de headers)
- express-rate-limit (proteção de login)
- cookie-parser, cors
- bcryptjs, speakeasy, nanoid

### 3.3 Persistência

- Arquivos JSON locais em `server/data` (com escrita atômica e serialização por fila)

### 3.4 Testes

- Vitest em `client` e `server`
- Supertest para contratos HTTP do backend

### 3.5 Infra local

- Docker + Docker Compose
- Nginx no container do frontend

---

## 4. Arquitetura do Sistema

## 4.1 Visão macro

1. Frontend React renderiza landing, auth/checkout e studio.
2. Frontend chama API com `fetch`, `credentials: include` e token CSRF em métodos mutáveis.
3. API Express valida autenticação/sessão e processa regras de negócio.
4. API persiste dados em JSON local no servidor.

## 4.2 Separação por responsabilidades

- `client/src/App.jsx`: orquestra UI e fluxos de produto.
- `client/src/hooks/useSoundEngine.js`: engine de áudio procedural em runtime.
- `client/src/lib/api.js`: camada única de acesso HTTP + CSRF.
- `client/src/lib/audioExport.js`: render offline e codificação de exportação.
- `server/src/app.js`: composição da API (middlewares, rotas, tratamento de erro).
- `server/src/index.js`: bootstrap de execução (listen de porta).
- `server/src/routes/*`: contratos HTTP de domínio.
- `server/src/auth.js`: núcleo de autenticação, sessão, CSRF, MFA e auditoria.
- `server/src/storage.js`: IO atômico e seguro dos arquivos de dados.

---

## 5. Estrutura de Pastas Atual

```text
.
├── client/
│   ├── index.html
│   ├── Dockerfile
│   ├── vite.config.js
│   ├── vitest.config.js
│   ├── package.json
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── components/
│       │   └── SoundVisualizer.jsx
│       ├── hooks/
│       │   └── useSoundEngine.js
│       ├── lib/
│       │   ├── api.js
│       │   ├── api.test.js
│       │   └── audioExport.js
│       └── styles/
│           └── app.css
├── server/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── app.js
│       ├── app.test.js
│       ├── auth.js
│       ├── soundLibrary.js
│       ├── storage.js
│       └── routes/
│           ├── auth.js
│           ├── mixes.js
│           └── presets.js
├── docker-compose.yml
├── package.json
├── package-lock.json
└── README.md
```

---

## 6. Frontend - Documentação Funcional e Técnica

## 6.1 Modos públicos e privados

O app opera em dois contextos:

- **não autenticado**:
  - `publicView = "landing"`: página comercial;
  - `publicView = "auth"`: tela dedicada para login/cadastro;
  - `publicView = "checkout"`: wizard de assinatura com múltiplas etapas.
- **autenticado**:
  - studio completo (cenários, mixer, visual, mixes, exportação, histórico, conta e resumo).

## 6.2 Etapas de checkout (UI)

Etapas atuais:

1. Cadastre-se ou login
2. Ativação
3. Escolher plano
4. Confirmar plano
5. Informações de cartão
6. Confirmar compra
7. Concluído

Importante:

- a etapa de ativação é validação local de código de 6 dígitos (sem envio real por e-mail/SMS);
- a etapa de cartão é validação de formato no frontend (sem gateway real de pagamento);
- a conclusão aciona autenticação final e entrada no studio.

## 6.3 Ferramentas do studio

- **Cenários**: presets por categoria.
- **Mixer**: volume por camada, mute por trilha e medidor de intensidade.
- **Visual**: visualizador em canvas usando `AnalyserNode`.
- **Mixes**: CRUD, favoritos, duplicação e aplicação.
- **Exportar**: WAV/WEBM/OGG/MP4/AAC (conforme suporte).
- **Histórico**: últimas reproduções.
- **Conta**: perfil, visão de studio e sessão.
- **Resumo**: métricas agregadas por categoria.

## 6.4 Engine de áudio (runtime)

`useSoundEngine`:

- cria `AudioContext`, `GainNode` master e `AnalyserNode`;
- gera camadas por `soundId` com filtros, ruído, drones e pulsos;
- aplica volume por trilha com rampas (`setTargetAtTime`) para evitar clicks;
- faz suspend do contexto em idle para reduzir consumo de CPU/bateria;
- destrói recursos no unmount.

## 6.5 Exportação de áudio

`audioExport.js`:

- renderização via `OfflineAudioContext`;
- encoder WAV manual (PCM 16-bit);
- fallback para `MediaRecorder` nos demais formatos suportados;
- suporte de formato calculado por `MediaRecorder.isTypeSupported`.

---

## 7. Backend - Documentação Técnica

## 7.1 Inicialização e middlewares

`createApp()` (`server/src/app.js`) configura:

- `trust proxy = 1`;
- `X-Request-Id` por requisição;
- `helmet` com CSP e HSTS (em produção);
- `cors` com credenciais habilitadas;
- parse de cookie e JSON (`100kb`);
- exigência de HTTPS em produção;
- proteção CSRF em mutações de `/api` (com exceções controladas);
- roteamento por domínio (`auth`, `presets`, `mixes`);
- fallback 404 e handler global de erro.

## 7.2 Modelo de autenticação

- sessão em cookie (`aurora.sid` em dev, `__Host-aurora.sid` em prod);
- valor do cookie é `sid` aleatório;
- persistência da sessão usa hash SHA-256 do `sid`;
- token CSRF por sessão (hash armazenado no backend);
- idle timeout + expiração absoluta da sessão.

## 7.3 Segurança implementada

- validação de senha forte e anti senhas comuns;
- hash de senha com bcrypt;
- migração automática de hash legado (scrypt -> bcrypt);
- throttling de login com backoff exponencial;
- captcha condicional após múltiplas falhas;
- MFA TOTP com segredo cifrado (AES-256-GCM);
- auditoria de eventos de auth e mixes;
- validação de payloads com zod;
- checagem de ownership em operações por usuário.

## 7.4 Persistência em JSON

Arquivos em `server/data`:

- `users.json`
- `sessions.json`
- `mixes.json`
- `history.json`
- `login-attempts.json`
- `password-resets.json`
- `auth-audit.json`

Garantias:

- escrita serializada por arquivo (fila em memória);
- escrita atômica via arquivo temporário + rename;
- permissões restritas (`0o600` para arquivos, `0o700` diretório);
- autorrecuperação para JSON inválido via fallback.

---

## 8. API HTTP - Referência Completa

Base URL local: `http://localhost:4000/api`

### 8.1 Saúde e catálogos

- `GET /health`
  - Auth: não
  - Resposta: `{ ok: true, service: "aurora-soundlab-api" }`

- `GET /sounds`
  - Auth: não
  - Resposta: array da biblioteca sonora

- `GET /scenarios`
  - Auth: não
  - Resposta: mapa `{ [presetKey]: preset }`

- `GET /presets/cinematic`
  - Auth: não
  - Resposta: array de presets

- `GET /presets/categories`
  - Auth: não
  - Resposta: array de categorias

### 8.2 Auth

- `POST /auth/register`
  - Auth: não
  - CSRF: isento
  - Body: `{ username, email?, password }`
  - Status: `201`

- `POST /auth/login`
  - Auth: não
  - CSRF: isento
  - Body: `{ username, password, mfaCode?, captchaToken? }`
  - Status: `200`

- `GET /auth/me`
  - Auth: sim
  - Status: `200`

- `GET /auth/csrf`
  - Auth: sim
  - Efeito: gira sessão/csrf
  - Status: `200`

- `POST /auth/logout`
  - Auth: sim
  - CSRF: obrigatório
  - Status: `204`

- `POST /auth/password/forgot`
  - Auth: não
  - CSRF: isento
  - Body: `{ usernameOrEmail }`
  - Status: `202`

- `POST /auth/password/reset`
  - Auth: não
  - CSRF: isento
  - Body: `{ token, newPassword }`
  - Status: `204`

- `POST /auth/email/request-verification`
  - Auth: sim
  - CSRF: obrigatório
  - Status: `202`

- `POST /auth/email/verify`
  - Auth: não
  - CSRF: isento
  - Body: `{ token }`
  - Status: `204`

- `POST /auth/mfa/setup`
  - Auth: sim
  - CSRF: obrigatório
  - Status: `200` (`otpauthUrl`)

- `POST /auth/mfa/enable`
  - Auth: sim
  - CSRF: obrigatório
  - Body: `{ code }`
  - Status: `204`

- `POST /auth/mfa/disable`
  - Auth: sim
  - CSRF: obrigatório
  - Body: `{ code }`
  - Status: `204`

### 8.3 Overview

- `GET /overview`
  - Auth: sim
  - Resposta: totais de mixes/favoritos/reproduções/compartilhamentos + `byCategory`

### 8.4 Mixes

- `GET /mixes?category=<cat>&favorite=true|false`
  - Auth: sim
  - Lista mixes do usuário

- `POST /mixes`
  - Auth: sim
  - CSRF: obrigatório
  - Body: `{ name, description?, category, scenarioKey?, theme?, source?, mixer }`

- `PUT /mixes/:id`
  - Auth: sim
  - CSRF: obrigatório

- `DELETE /mixes/:id`
  - Auth: sim
  - CSRF: obrigatório

- `POST /mixes/:id/favorite`
  - Auth: sim
  - CSRF: obrigatório
  - Efeito: toggle favorito

- `POST /mixes/:id/duplicate`
  - Auth: sim
  - CSRF: obrigatório

- `POST /mixes/:id/play`
  - Auth: sim
  - CSRF: obrigatório
  - Efeito: incrementa playCount e registra histórico

- `GET /mixes/history/list`
  - Auth: sim
  - Retorna últimos 30 eventos

### 8.5 Compartilhamento

- `POST /mixes/:id/share`
  - Auth: sim
  - CSRF: obrigatório
  - Body: `{ expiresInHours?, allowClone? }`

- `POST /mixes/:id/share/revoke`
  - Auth: sim
  - CSRF: obrigatório

- `GET /mixes/shared/:shareId`
  - Auth: não
  - Retorna versão pública da mix compartilhada

- `POST /mixes/shared/:shareId/clone`
  - Auth: sim
  - CSRF: obrigatório
  - Clona mix compartilhada para a conta autenticada

---

## 9. Contratos de Dados (Resumo)

## 9.1 User

Campos principais:

- `id`, `username`, `email`, `role`
- `passwordHash`, `passwordAlgo`
- `emailVerifiedAt`, `emailVerification`
- `mfa.enabled`, `mfa.secret`, `mfa.pendingSecret`
- `lastIpHash`, `lastUserAgentHash`, `lastLoginAt`

## 9.2 Session

- chave: hash do SID
- `userId`, `csrfHash`
- `createdAt`, `lastActivityAt`, `expiresAt`
- `ipHash`, `userAgentHash`

## 9.3 Mix

- `id`, `userId`
- `name`, `description`, `category`
- `scenarioKey`, `theme`, `source`
- `mixer` (map soundId -> 0..1)
- `favorite`, `playCount`
- `share` (metadados de compartilhamento)
- `createdAt`, `updatedAt`

## 9.4 Histórico

- `id`, `userId`, `mixId`, `mixName`, `playedAt`

---

## 10. Variáveis de Ambiente

## 10.1 Server

- `PORT` (padrão `4000`)
- `FRONTEND_ORIGIN` (padrão `http://localhost:5173`)
- `NODE_ENV` (`development` ou `production`)
- `SESSION_TTL_MS`
- `SESSION_IDLE_TTL_MS`
- `BCRYPT_ROUNDS`
- `RESET_TOKEN_TTL_MS`
- `EMAIL_TOKEN_TTL_MS`
- `AUDIT_LOG_LIMIT`
- `MFA_SECRET_KEY` (obrigatório em produção para MFA confiável)
- `HCAPTCHA_SECRET` (opcional)

## 10.2 Client

- `VITE_API_URL` (padrão `http://localhost:4000/api`)

---

## 11. Scripts de Execução

## 11.1 Raiz

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

## 11.2 Client

- `npm run dev -w client`
- `npm run build -w client`
- `npm run preview -w client`
- `npm run test -w client`
- `npm run test:watch -w client`

## 11.3 Server

- `npm run dev -w server`
- `npm run start -w server`
- `npm run test -w server`
- `npm run test:watch -w server`

---

## 12. Execução Local

1. `npm install`
2. `npm run dev`
3. Acessar:
   - client: `http://localhost:5173`
   - api: `http://localhost:4000`

---

## 13. Execução com Docker

## 13.1 Subida

```bash
docker compose up -d --build
```

## 13.2 Serviços

- `aurora-server`: porta `4000`
- `aurora-client`: porta `5173` (nginx:80)

## 13.3 Healthcheck

Server usa `wget` em `/api/health` com header `X-Forwarded-Proto: https` para compatibilidade com regra de HTTPS.

## 13.4 Persistência

Volume nomeado: `aurora_server_data`.

## 13.5 Buildx

Se aparecer aviso sobre buildx, instalar plugin local do Docker CLI para remover warning de build clássico.

---

## 14. Testes Automatizados

## 14.1 Backend (`server/src/app.test.js`)

- health check
- header `X-Request-Id`
- categorias oficiais
- bloqueio de endpoint autenticado sem sessão
- fallback 404

## 14.2 Frontend (`client/src/lib/api.test.js`)

- envio de CSRF em mutações
- não envio de CSRF em GET
- rotação de token CSRF via resposta da API

## 14.3 Execução rápida

```bash
npm run test
```

---

## 15. Segurança - Checklist de Produção

- [ ] rodar API atrás de HTTPS real (reverse proxy)
- [ ] definir `NODE_ENV=production`
- [ ] configurar `MFA_SECRET_KEY` forte e rotacionável
- [ ] configurar `FRONTEND_ORIGIN` correto
- [ ] habilitar `HCAPTCHA_SECRET` se captcha for obrigatório
- [ ] monitorar tamanho dos JSONs de dados
- [ ] definir política de backup para `server/data`
- [ ] revisar CSP conforme domínios reais de produção

---

## 16. Operação e Manutenção

## 16.1 Backup

Backup periódico de:

- `server/data/users.json`
- `server/data/sessions.json`
- `server/data/mixes.json`
- `server/data/history.json`
- `server/data/login-attempts.json`
- `server/data/password-resets.json`
- `server/data/auth-audit.json`

## 16.2 Monitoramento mínimo

- disponibilidade de `/api/health`
- taxa de erros 4xx/5xx
- crescimento dos arquivos JSON
- eventos de login suspeito e falhas de MFA

## 16.3 Rotina recomendada

- revisar dependências mensalmente;
- executar testes antes de deploy;
- revisar logs de auditoria com periodicidade;
- validar restore de backup em ambiente de staging.

---

## 17. Limitações Conhecidas (Estado Atual)

- checkout possui fluxo de UX completo, mas sem integração com gateway real de pagamento;
- etapa de ativação no checkout é local (sem serviço real de e-mail/SMS);
- persistência em JSON é adequada para MVP/projeto local, não para alta escala;
- não há painel administrativo dedicado;
- não há cobertura de testes E2E de interface neste momento.

---

## 18. Roadmap Sugerido

## 18.1 Curto prazo

- integrar checkout a Stripe/Mercado Pago;
- ativação real por e-mail;
- política de plano/assinatura persistida no backend;
- cobertura de testes de rotas de mixes com cenários de erro.

## 18.2 Médio prazo

- migração de persistência para banco relacional (PostgreSQL);
- trilha de auditoria com retenção/consulta paginada;
- onboarding guiado no frontend com analytics de conversão.

## 18.3 Longo prazo

- colaboração em equipe em tempo real;
- biblioteca de presets versionada;
- marketplace de soundscapes;
- observabilidade estruturada (metrics + traces).

---

## 19. Guia de Troubleshooting

## 19.1 Porta ocupada (`EADDRINUSE`)

```bash
lsof -i :4000 -n -P
kill -9 <PID>
```

Ou:

```bash
PORT=4001 npm run dev -w server
```

## 19.2 Erro de CSRF

- garantir sessão ativa (`/auth/me`)
- chamar `/auth/csrf` após login
- confirmar header `X-CSRF-Token` em mutações

## 19.3 Build Docker com warning de buildx

- instalar plugin `docker-buildx` no Docker CLI local

## 19.4 API sem resposta no client

- validar `VITE_API_URL`
- validar `FRONTEND_ORIGIN` no server
- verificar CORS e cookies no navegador

---

## 20. Licença

Projeto proprietário (All Rights Reserved).

Uso, cópia, modificação ou distribuição somente com autorização expressa do autor.

---

## 21. Referências Internas

Arquivos-chave para leitura rápida:

- `client/src/App.jsx`
- `client/src/hooks/useSoundEngine.js`
- `client/src/lib/api.js`
- `client/src/lib/audioExport.js`
- `server/src/app.js`
- `server/src/auth.js`
- `server/src/routes/auth.js`
- `server/src/routes/mixes.js`
- `server/src/storage.js`

