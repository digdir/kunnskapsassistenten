# Testmiljøet: én container med den bygde klienten og serveren som holder
# API-nøkkelen. Samme mønster som `ka-app` i digdir/kunnskapsassistenten, og av
# samme grunn — samme
# origin er det som gjør at nøkkelen aldri når nettleseren.

# Node 24, som `engines` krever og CI bygger og tester på. Serveren kjører
# TypeScript direkte med Nodes egen typestripping.
FROM node:24-alpine AS build
WORKDIR /app

# Avhengighetene først, så laget gjenbrukes når bare koden er endret.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Kjøretid uten devDependencies, og faktisk uten node_modules i det hele tatt:
# serveren har ingen avhengigheter. Det som følger med er den bygde klienten,
# serverkoden, shared/ som serveren og klienten deler, og package.json — den
# siste fordi `"type": "module"` er det som gjør at Node leser serverfilene
# som ESM.
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared

# Ikke root. Bildet eier ingenting appen skriver til; alt den trenger er lest.
USER node

EXPOSE 8787
CMD ["node", "server/index.ts"]
