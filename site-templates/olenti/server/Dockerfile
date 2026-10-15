# Multi-stage build for production API

FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies and generate Prisma client (same layer = one network context, retry on EAI_AGAIN)
COPY package*.json tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci --silent && (npx prisma generate || (sleep 5 && npx prisma generate))

# Build (no network needed)
COPY src ./src
RUN npm run build

# Remove dev dependencies
RUN npm prune --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app

# Copy runtime files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
COPY products.json ./products.json
# Helper scripts for maintenance/seeding
COPY db.cjs ./db.cjs
COPY seed-content.cjs ./seed-content.cjs
# uploads создаётся пустым; для постоянного хранения монтируйте том
RUN mkdir -p uploads

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/index.js"]
