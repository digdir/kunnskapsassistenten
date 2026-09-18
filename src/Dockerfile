# Node 22.18+ runs the server's TypeScript directly, so only the SPA is built.
FROM node:22.23.2-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contract/package.json packages/contract/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY . .
RUN npm run build

FROM node:22.23.2-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contract/package.json packages/contract/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --workspace apps/server --include-workspace-root \
 && npm cache clean --force
COPY packages/contract/src packages/contract/src
COPY apps/server/src apps/server/src
COPY --from=build /app/apps/web/dist apps/web/dist

ENV WEB_ROOT=./apps/web/dist
ENV PORT=8787
EXPOSE 8787

RUN addgroup -S ka && adduser -S ka -G ka && chown -R ka:ka /app
USER ka

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/server/src/server.ts"]
