# Testmiljøet: én container med den bygde klienten og serveren som holder
# API-nøkkelen. Samme mønster som `ka-app` i digdir/kunnskapsassistenten, og av
# samme grunn — samme
# origin er det som gjør at nøkkelen aldri når nettleseren.

# Node 24, som `engines` krever og CI bygger og tester på. Serveren kjører
# TypeScript direkte med Nodes egen typestripping.
FROM node:24-alpine AS build
WORKDIR /app

# Built with src/ as the context (docs/deploy.md): the npm workspace has one
# lockfile, and it is there. npm ci needs only the root manifest and this one.
# Dependencies first, so the layer is reused when only the code changes.
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
RUN npm ci --workspace apps/web

COPY apps/web apps/web
# The client's backend is built into it (src/api/apiMode.ts). The test
# environment's server forwards to the backend, so the client is live.
ARG VITE_API_MODE=live
RUN npm run build --workspace apps/web

# Kjøretid uten devDependencies, og faktisk uten node_modules i det hele tatt:
# serveren har ingen avhengigheter. Det som følger med er den bygde klienten,
# serverkoden, shared/ som serveren og klienten deler, og package.json — den
# siste fordi `"type": "module"` er det som gjør at Node leser serverfilene
# som ESM.
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787

COPY --from=build /app/apps/web/package.json ./package.json
COPY --from=build /app/apps/web/dist ./dist
COPY --from=build /app/apps/web/server ./server
COPY --from=build /app/apps/web/shared ./shared

# Ikke root. Bildet eier ingenting appen skriver til; alt den trenger er lest.
USER node

EXPOSE 8787
CMD ["node", "server/index.ts"]
