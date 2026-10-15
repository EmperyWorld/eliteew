# EliteEW site_prod — public landing (Next.js standalone) for eliteew.ru :29002
# Build on command-center only; run on prod-core.

FROM docker.io/library/node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

FROM docker.io/library/node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc next.config.ts tsconfig.json postcss.config.mjs ./
COPY public ./public
COPY src ./src
RUN pnpm build

FROM docker.io/library/node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
ENV LEAD_DATA_DIR=/tmp/eliteew-leads

RUN addgroup --system --gid 1001 nodejs \
	&& adduser --system --uid 1001 -G nodejs nextjs \
	&& chown -R nextjs:nodejs /app

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD node -e "const http=require('http');const os=require('os');const port=+(process.env.PORT||8080);const hosts=new Set(['127.0.0.1']);for(const list of Object.values(os.networkInterfaces()||{})){for(const i of list||[]){const f=i.family;if(f==='IPv4'||f===4)hosts.add(i.address);}}(async()=>{for(const h of hosts){try{await new Promise((res,rej)=>{const r=http.get({host:h,port,path:'/health',timeout:2500},(x)=>{x.resume();(x.statusCode===200?res:rej)();}).on('error',rej);});process.exit(0);}catch{}}process.exit(1);})();"

CMD ["node", "server.js"]
