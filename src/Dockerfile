# Node 24 runs the server's TypeScript directly, so only the clients are built: apps/web, and
# apps/web-next, which the server offers only with KA_NEXT=1 (decisions/0013).
FROM node:24.21.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contract/package.json packages/contract/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY apps/web-next/package.json apps/web-next/
RUN npm ci
COPY . .
# apps/web reads VITE_API_MODE when it is built; a production build without it is bff.
# Set here anyway, so the image does not depend on that default.
# The root build builds apps/web-next too.
RUN VITE_API_MODE=bff npm run build

FROM node:24.21.0-alpine AS runtime
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
# genki's layout checks, which the server runs on KA_NEXT_LAYOUT (decisions/0017): the next
# client's vendored ui-blocks as source, with genki's licence.
COPY apps/web-next/vendor/genki/LICENSE apps/web-next/vendor/genki/LICENSE
COPY apps/web-next/vendor/genki/ui-blocks apps/web-next/vendor/genki/ui-blocks
COPY --from=build /app/apps/web/dist apps/web/dist
COPY --from=build /app/apps/web-next/dist apps/web-next/dist

ENV WEB_ROOT=./apps/web/dist
ENV WEB_NEXT_ROOT=./apps/web-next/dist
ENV PORT=8787
EXPOSE 8787

RUN addgroup -S ka && adduser -S ka -G ka && chown -R ka:ka /app
USER ka

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/server/src/server.ts"]
