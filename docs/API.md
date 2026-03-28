# API HTTP

Base URL local: `http://localhost:4000/api`

Este documento descreve os endpoints expostos pelo backend, requisitos de autenticação e regras de segurança.

## 1. Convenções Gerais

- Respostas em JSON (exceto `204 No Content`).
- Sessão baseada em cookie HttpOnly.
- Métodos mutáveis exigem token CSRF via header `X-CSRF-Token`.
- Erros retornam payload com campo `error`.

## 2. Saúde e Catálogos

### `GET /health`

- Auth: não
- Retorno: status do serviço

### `GET /sounds`

- Auth: não
- Retorno: biblioteca de camadas sonoras

### `GET /scenarios`

- Auth: não
- Retorno: mapa de presets por chave

### `GET /presets/cinematic`

- Auth: não
- Retorno: lista de presets

### `GET /presets/categories`

- Auth: não
- Retorno: lista de categorias

## 3. Autenticação e Conta

### `POST /auth/register`

- Auth: não
- CSRF: isento
- Body:

```json
{
  "username": "usuario",
  "email": "email@dominio.com",
  "password": "SenhaForte123"
}
```

- Retorna usuário público + CSRF token + cookie de sessão.

### `POST /auth/login`

- Auth: não
- CSRF: isento
- Body:

```json
{
  "username": "usuario",
  "password": "SenhaForte123",
  "mfaCode": "123456",
  "captchaToken": "token-opcional"
}
```

- Retorna usuário público + CSRF token + cookie de sessão.

### `GET /auth/me`

- Auth: sim
- Retorna usuário da sessão atual.

### `GET /auth/csrf`

- Auth: sim
- Gera nova sessão/CSRF e atualiza cookie.

### `POST /auth/logout`

- Auth: sim
- CSRF: obrigatório
- Invalida sessão atual.

## 4. Senha e Verificação de E-mail

### `POST /auth/password/forgot`

- Auth: não
- CSRF: isento
- Body: `{ "usernameOrEmail": "..." }`
- Resposta anti-enumeração (`202`).

### `POST /auth/password/reset`

- Auth: não
- CSRF: isento
- Body: `{ "token": "...", "newPassword": "..." }`

### `POST /auth/email/request-verification`

- Auth: sim
- CSRF: obrigatório
- Solicita emissão de token de verificação.

### `POST /auth/email/verify`

- Auth: não
- CSRF: isento
- Body: `{ "token": "..." }`

## 5. MFA (TOTP)

### `POST /auth/mfa/setup`

- Auth: sim
- CSRF: obrigatório
- Retorna `otpauthUrl` para app autenticador.

### `POST /auth/mfa/enable`

- Auth: sim
- CSRF: obrigatório
- Body: `{ "code": "123456" }`

### `POST /auth/mfa/disable`

- Auth: sim
- CSRF: obrigatório
- Body: `{ "code": "123456" }`

## 6. Overview

### `GET /overview`

- Auth: sim
- Retorna métricas agregadas da conta autenticada.

## 7. Mixes

### `GET /mixes`

- Auth: sim
- Query opcional:
  - `category=<categoria>`
  - `favorite=true`

### `POST /mixes`

- Auth: sim
- CSRF: obrigatório
- Body:

```json
{
  "name": "Minha Mix",
  "description": "Descricao",
  "category": "foco",
  "scenarioKey": "cafeteria-chuvosa",
  "theme": "cafe",
  "source": "custom",
  "mixer": { "rain": 0.5, "cafe": 0.7 }
}
```

### `PUT /mixes/:id`

- Auth: sim
- CSRF: obrigatório
- Atualiza mix existente do próprio usuário.

### `DELETE /mixes/:id`

- Auth: sim
- CSRF: obrigatório

### `POST /mixes/:id/favorite`

- Auth: sim
- CSRF: obrigatório
- Toggle de favorito.

### `POST /mixes/:id/duplicate`

- Auth: sim
- CSRF: obrigatório
- Cria cópia da mix.

### `POST /mixes/:id/play`

- Auth: sim
- CSRF: obrigatório
- Incrementa playCount e registra evento em histórico.

### `GET /mixes/history/list`

- Auth: sim
- Retorna últimos 30 eventos de reprodução.

## 8. Compartilhamento

### `POST /mixes/:id/share`

- Auth: sim
- CSRF: obrigatório
- Body:

```json
{
  "expiresInHours": 168,
  "allowClone": true
}
```

### `POST /mixes/:id/share/revoke`

- Auth: sim
- CSRF: obrigatório
- Revoga link público da mix.

### `GET /mixes/shared/:shareId`

- Auth: não
- Retorna mix pública (sem dados privados do dono).

### `POST /mixes/shared/:shareId/clone`

- Auth: sim
- CSRF: obrigatório
- Clona mix compartilhada para conta autenticada.

## 9. Códigos de Status Mais Comuns

- `200`: sucesso com payload
- `201`: recurso criado
- `202`: aceito para processamento lógico
- `204`: sucesso sem payload
- `400`: entrada inválida
- `401`: não autenticado/sessão inválida
- `403`: bloqueio de autorização/CSRF
- `404`: recurso não encontrado
- `409`: conflito (ex.: usuário já existe)
- `410`: link compartilhado expirado
- `429`: limite de tentativas/rate limit
- `500`: erro interno

## 10. Segurança Aplicada na API

- sessão em cookie HttpOnly + SameSite Lax;
- CSRF obrigatório em mutações;
- validação de payload com zod;
- ownership server-side em mixes;
- trilha de auditoria para eventos críticos;
- hardening de headers com helmet.
