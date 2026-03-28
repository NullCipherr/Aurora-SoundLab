# Arquitetura e Produto

## 1. Visão de Produto

O Aurora SoundLab é uma plataforma para criação de ambientes sonoros imersivos.

### Objetivo

Permitir que o usuário monte, personalize, salve, exporte e compartilhe mixes sonoras para foco, leitura, relaxamento e criatividade.

### Públicos-alvo

- criadores de conteúdo;
- profissionais de produto/design;
- estudantes e leitores;
- equipes que usam trilhas sonoras para rituais de foco.

## 2. Arquitetura de Alto Nível

1. Frontend React renderiza landing, auth/checkout e studio.
2. Camada `client/src/lib/api.js` centraliza chamadas HTTP com cookie de sessão e CSRF.
3. Backend Express processa autenticação, autorização e regras de negócio.
4. Persistência em JSON local (`server/data`) com escrita atômica.

## 3. Stack Técnica

### Frontend

- React 18 + Vite 5
- CSS custom
- Web Audio API
- Canvas API

### Backend

- Node.js (ESM) + Express
- zod para validação de entrada
- helmet/cors/cookie-parser
- bcryptjs, speakeasy, express-rate-limit, nanoid

### Testes

- Vitest no client e server
- Supertest para contrato HTTP do server

## 4. Estrutura por Responsabilidade

- `client/src/App.jsx`: fluxo de produto e orquestração da UI.
- `client/src/hooks/useSoundEngine.js`: engine de áudio procedural em runtime.
- `client/src/lib/audioExport.js`: render offline e exportação em múltiplos formatos.
- `client/src/components/SoundVisualizer.jsx`: visualização em canvas.
- `server/src/app.js`: composição da API e middlewares.
- `server/src/routes/auth.js`: autenticação, recuperação de senha, MFA.
- `server/src/routes/mixes.js`: CRUD de mix, histórico, compartilhamento.
- `server/src/auth.js`: sessão, CSRF, políticas de segurança e auditoria.
- `server/src/storage.js`: camada de acesso a dados em JSON.

## 5. Fluxos Funcionais (Frontend)

## 5.1 Contexto não autenticado

- `landing`: página comercial com proposta de valor e planos.
- `auth`: página dedicada a login/cadastro.
- `checkout`: wizard de assinatura por etapas.

### Etapas do checkout

1. Cadastre-se ou login
2. Ativação
3. Escolher plano
4. Confirmar plano
5. Informações de cartão
6. Confirmar compra
7. Concluído

Observações:

- Ativação no estado atual é validação local de código (sem envio real de token).
- Cartão no estado atual é validação de formato no frontend (sem gateway real).

## 5.2 Contexto autenticado (Studio)

- Cenários: presets por categoria.
- Mixer: volume/mute por trilha.
- Visual: analisador em tempo real.
- Mixes: salvar, editar, duplicar, favoritar, excluir e aplicar.
- Exportar: WAV, WEBM, OGG, MP4, AAC (conforme suporte do navegador).
- Histórico: últimas reproduções.
- Conta e resumo: visão de sessão e métricas agregadas.

## 6. Engine de Áudio

A engine procedural:

- sintetiza camadas por `soundId` com combinações de ruído, osciladores e envelopes;
- usa `AudioContext` e `GainNode` para mix em tempo real;
- usa `AnalyserNode` para alimentar visualização;
- aplica rampas de ganho para evitar artefatos;
- suspende contexto em idle para reduzir consumo.

## 7. Persistência e Modelo de Dados

Arquivos principais em `server/data`:

- `users.json`
- `sessions.json`
- `mixes.json`
- `history.json`
- `login-attempts.json`
- `password-resets.json`
- `auth-audit.json`

Garantias da camada de storage:

- fila de escrita por arquivo;
- escrita atômica via arquivo temporário + rename;
- permissões restritas (`0o600`/`0o700`);
- fallback automático para JSON inválido.

## 8. Segurança (Resumo)

- sessão em cookie HttpOnly (Secure em produção);
- CSRF obrigatório para métodos mutáveis;
- senha forte com bcrypt + migração de hash legado;
- rate limit + backoff exponencial em login;
- MFA TOTP opcional;
- auditoria de eventos críticos;
- validação de entrada com zod.

## 9. Limitações Conhecidas

- checkout ainda sem gateway real;
- ativação sem serviço real de e-mail/SMS;
- persistência em JSON adequada para MVP/projeto local.

## 10. Evolução Recomendada

- integrar gateway de pagamento (Stripe/Mercado Pago);
- migrar persistência para banco relacional;
- adicionar suíte E2E para fluxos de UI;
- criar painel administrativo para operação.
