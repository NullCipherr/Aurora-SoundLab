FROM node:22-alpine AS base
WORKDIR /app

RUN apk add --no-cache wget

COPY package*.json ./
COPY server/package.json ./server/package.json
RUN npm ci --omit=dev -w server

COPY server/src ./server/src
RUN mkdir -p /app/server/data

ENV NODE_ENV=production
ENV PORT=4000
WORKDIR /app/server
EXPOSE 4000

CMD ["node", "src/index.js"]
