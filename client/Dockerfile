FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY client/package.json ./client/package.json
RUN npm ci -w client

COPY client ./client
ARG VITE_API_URL=http://localhost:4000/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build -w client

FROM nginx:1.27-alpine AS runner
WORKDIR /usr/share/nginx/html

COPY --from=builder /app/client/dist .
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
