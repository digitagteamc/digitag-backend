FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

# ---- dependencies
FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate

# ---- runtime
FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY package*.json ./
COPY src ./src

EXPOSE 5000

CMD ["node", "src/server.js"]
