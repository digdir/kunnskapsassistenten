# Node 24 runs the server's TypeScript directly, so only the two clients are built.
FROM node:24.21.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contract/package.json packages/contract/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY apps/web-preact/package.json apps/web-preact/
RUN npm ci
COPY . .
# apps/web reads VITE_API_MODE when it is built; a production build without it is bff.
# Set here anyway, so the image does not depend on that default. apps/web-preact has no modes.
RUN VITE_API_MODE=bff npm run build

FROM node:24.21.0-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contract/package.json packages/contract/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY apps/web-preact/package.json apps/web-preact/
RUN npm ci --omit=dev --workspace apps/server --include-workspace-root \
 && npm cache clean --force
COPY packages/contract/src packages/contract/src
COPY apps/server/src apps/server/src
COPY --from=build /app/apps/web/dist apps/web/dist
COPY --from=build /app/apps/web-preact/dist apps/web-preact/dist

ENV WEB_ROOT=./apps/web/dist
ENV WEB_ROOT_PREACT=./apps/web-preact/dist
ENV PORT=8787
EXPOSE 8787

RUN addgroup -S ka && adduser -S ka -G ka && chown -R ka:ka /app
USER ka

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/server/src/server.ts"]
