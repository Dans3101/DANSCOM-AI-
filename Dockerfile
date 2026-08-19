FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

ENV NODE_ENV=production
ENV PORT=3000
ENV WHATSAPP_SESSION_DIR=/app/data/whatsapp-session

EXPOSE 3000
VOLUME ["/app/data", "/app/logs"]

CMD ["npm", "start"]
