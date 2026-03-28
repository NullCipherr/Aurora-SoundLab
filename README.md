<div align="center">
  <h1>🎧 Aurora SoundLab</h1>
  <p><i>Laboratório de ambientes sonoros em tempo real para foco, relaxamento e narrativa</i></p>

  <p>
    <img src="https://img.shields.io/badge/React-18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
    <img src="https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
    <img src="https://img.shields.io/badge/Web%20Audio%20API-Real%20Time-FF6B35?style=for-the-badge" alt="Web Audio API" />
    <img src="https://img.shields.io/badge/Express-4-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  </p>
</div>

---

## 📚 Documentação Completa

A documentação técnica integral do projeto (arquitetura, fluxos, API, segurança, dados, operação, Docker, testes e roadmap) está em:

- [docs/README.md](docs/README.md)
- [docs/ARQUITETURA_E_PRODUTO.md](docs/ARQUITETURA_E_PRODUTO.md)
- [docs/API.md](docs/API.md)
- [docs/OPERACAO_DEPLOY_MANUTENCAO.md](docs/OPERACAO_DEPLOY_MANUTENCAO.md)
- [docs/DOCUMENTACAO_COMPLETA.md](docs/DOCUMENTACAO_COMPLETA.md) (versão unificada)

Use este arquivo como fonte principal para onboarding, manutenção e handoff.

---

## ⚡ Visão Geral

O **Aurora SoundLab** é uma plataforma criativa de mixagem sonora em tempo real, onde o usuário monta paisagens como:

- cafeteria chuvosa
- nave espacial
- floresta mágica
- escritório futurista
- biblioteca antiga

O projeto combina uma experiência visual rica no frontend com uma API Node.js para persistência de presets, compartilhamento e estatísticas.

## ✨ Principais Recursos

- **Mixer interativo em tempo real**:
  - Sliders para controlar volume por camada sonora.
  - Reprodução procedural com Web Audio API.
- **Cenários prontos e customizáveis**:
  - Temas visuais que mudam conforme o ambiente selecionado.
  - Mix padrão por cenário para começar rápido.
- **Visualização sonora**:
  - Canvas animado reagindo ao áudio.
- **Sistema de presets**:
  - Salvar combinações do usuário.
  - Reaplicar presets com um clique.
  - Favoritar presets.
- **Compartilhamento**:
  - Geração de link compartilhável por preset.
  - Carregamento de preset compartilhado via query string (`?share=...`).
- **Métricas de uso**:
  - Total de presets, favoritos e compartilhamentos.
  - Contagem de uso por cenário.

## 🛠️ Stack Tecnológica

- **Frontend**: React 18 + Vite
- **Áudio**: Web Audio API (engine procedural)
- **Backend**: Node.js + Express
- **Persistência**: arquivos JSON locais (sem banco externo)
- **Monorepo**: npm workspaces (`client` + `server`)

## 📂 Estrutura do Projeto

```text
.
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   └── SoundVisualizer.jsx
│   │   ├── hooks/
│   │   │   └── useSoundEngine.js
│   │   ├── lib/
│   │   │   ├── api.js
│   │   │   └── audioExport.js
│   │   ├── styles/
│   │   │   └── app.css
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── server/
│   ├── data/                  # JSONs de persistência (gerados em runtime)
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── mixes.js
│   │   │   └── presets.js
│   │   ├── app.js
│   │   ├── index.js
│   │   ├── soundLibrary.js
│   │   └── storage.js
│   └── package.json
├── package.json               # scripts raiz para subir tudo
└── README.md
```

## 🚀 Como Rodar Localmente

### Pré-requisitos

- Node.js 20+
- npm 10+
- Docker 24+ (opcional para execução containerizada)
- Docker Compose v2 (opcional)

### Execução

1. Entre na pasta do projeto:
   ```bash
   cd Aurora-SoundLab
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Suba frontend + backend juntos:
   ```bash
   npm run dev
   ```

4. Acesse:
   - Frontend: `http://localhost:5173`
   - API: `http://localhost:4000`

### Solução rápida de erro `EADDRINUSE` (porta 4000 em uso)

Se aparecer `listen EADDRINUSE: address already in use :::4000`, significa que já existe outro processo usando essa porta.

1. Verifique o processo:
   ```bash
   lsof -i :4000 -n -P
   ```

2. Encerre o processo (substitua pelo PID retornado):
   ```bash
   kill -9 <PID>
   ```

3. Ou inicie o server em outra porta:
   ```bash
   PORT=4001 npm run dev -w server
   ```

## 🐳 Execução com Docker

### Subir aplicação completa (client + server)

```bash
docker compose up -d --build
```

Ou pelos scripts da raiz:

```bash
npm run docker:build
npm run docker:up
```

### Acessos

- Frontend: `http://localhost:5173`
- API: `http://localhost:4000`

### Comandos úteis

```bash
docker compose logs -f
docker compose down
```

Ou:

```bash
npm run docker:logs
npm run docker:down
```

### Persistência de dados

- A API grava os dados no volume nomeado `aurora_server_data`.
- Isso mantém presets/mixes mesmo após recriar containers.

### Observação de ambiente

- O `docker-compose.yml` está configurado para uso local com `NODE_ENV=development`.
- Em produção, mantenha `NODE_ENV=production` atrás de proxy HTTPS (Nginx/Traefik) para respeitar os controles de segurança do backend.

## 📜 Scripts

### Raiz

- `npm run dev`: sobe `server` e `client` ao mesmo tempo com `concurrently`
- `npm run build`: gera build de produção do frontend
- `npm run test`: executa testes automatizados de server + client
- `npm run test:watch`: executa testes em modo watch no server + client
- `npm run test:server`: executa somente testes do backend
- `npm run test:client`: executa somente testes do frontend
- `npm run start`: inicia apenas o backend
- `npm run docker:build`: build dos serviços Docker
- `npm run docker:up`: sobe os serviços Docker em background
- `npm run docker:down`: derruba os serviços Docker
- `npm run docker:logs`: acompanha logs dos serviços Docker

### Client (`-w client`)

- `npm run dev -w client`: inicia Vite
- `npm run build -w client`: build de produção
- `npm run preview -w client`: preview local do build
- `npm run test -w client`: executa testes do client
- `npm run test:watch -w client`: executa testes do client em watch

### Server (`-w server`)

- `npm run dev -w server`: inicia API com watch
- `npm run start -w server`: inicia API em modo normal
- `npm run test -w server`: executa testes do server
- `npm run test:watch -w server`: executa testes do server em watch

## ✅ Estratégia de Testes Automatizados

- Framework: `Vitest` em ambos os workspaces.
- Backend (`server/src/app.test.js`):
  - contrato de health check (`GET /api/health`);
  - presença de `X-Request-Id` para rastreabilidade;
  - retorno de categorias oficiais;
  - bloqueio de endpoint autenticado para usuário anônimo;
  - fallback consistente de 404.
- Frontend (`client/src/lib/api.test.js`):
  - envio de CSRF em métodos mutáveis;
  - não envio de CSRF em `GET`;
  - rotação de token CSRF quando o backend devolve novo token.

## 🔌 Endpoints Principais

- `GET /api/health`: health check da API
- `GET /api/sounds`: biblioteca de sons
- `GET /api/scenarios`: cenários padrão
- `POST /api/auth/register`: cria conta e abre sessão por cookie `HttpOnly`
- `POST /api/auth/login`: login com proteção anti brute-force/cooldown
- `GET /api/auth/me`: usuário autenticado da sessão atual
- `GET /api/auth/csrf`: rotaciona token CSRF
- `POST /api/auth/logout`: invalida sessão
- `POST /api/auth/password/forgot`: inicia reset (resposta anti-enumeração)
- `POST /api/auth/password/reset`: redefine senha com token de uso único
- `POST /api/auth/mfa/setup`: inicia setup MFA TOTP
- `POST /api/auth/mfa/enable`: ativa MFA
- `POST /api/auth/mfa/disable`: desativa MFA
- `GET /api/mixes`: lista mixes do usuário autenticado (ownership server-side)
- `POST /api/mixes`: cria mix do usuário autenticado
- `POST /api/mixes/:id/share`: cria link compartilhável seguro
- `POST /api/mixes/:id/share/revoke`: revoga link compartilhável
- `GET /api/mixes/shared/:shareId`: abre mix compartilhada (somente dados públicos)
- `POST /api/mixes/shared/:shareId/clone`: clona compartilhamento permitido

## 🔐 Segurança Implementada

- Hash de senha forte com `bcrypt` (migração automática de hashes legados).
- Sessão por cookie `HttpOnly` + `SameSite=Lax` + `Secure` em produção.
- CSRF token obrigatório para operações mutáveis (POST/PUT/DELETE).
- Rate limit no login + cooldown progressivo + desafio captcha quando necessário.
- MFA/TOTP opcional com suporte a obrigatoriedade para contas `admin`.
- Verificação de ownership no backend (sem confiar em `userId` de frontend).
- Validação de entrada com `zod` em body/query sensíveis.
- Headers de segurança via `helmet` (CSP, HSTS em produção, frame-ancestors, etc.).
- Sanitização de erro (sem stack trace para cliente) + trilha de auditoria auth/mix.
- Links de compartilhamento com `shareId` forte, expiração e revogação.

## ⚙️ Variáveis de Ambiente (Server)

- `PORT` (default `4000`)
- `FRONTEND_ORIGIN` (default `http://localhost:5173`)
- `NODE_ENV` (`development`/`production`)
- `MFA_SECRET_KEY` (obrigatório em produção para MFA)
- `SESSION_TTL_MS` e `SESSION_IDLE_TTL_MS` (opcional)
- `BCRYPT_ROUNDS` (default `12`)
- `HCAPTCHA_SECRET` (opcional para captcha real em produção)

## 📄 Licença

Este projeto é proprietário (All Rights Reserved).

O código-fonte não pode ser copiado, modificado, distribuído ou utilizado para fins comerciais sem autorização explícita do autor.

© 2026 Andrei Costa — Todos os direitos reservados.
