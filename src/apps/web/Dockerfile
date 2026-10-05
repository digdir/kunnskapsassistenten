# Testmiljøet: én container med den bygde klienten og serveren som holder
# API-nøkkelen. Samme mønster som Nikolais ka-app, og av samme grunn — samme
# origin er det som gjør at nøkkelen aldri når nettleseren.

# Node 24 og ikke 22, selv om `engines` tillater 22.18: 24 er det CI bygger og
# tester på, og et bilde på en annen versjon enn den testede er en forskjell
# ingen har målt. Serveren kjører TypeScript direkte med Nodes egen
# typestripping, som finnes fra 22.18 — så 22 ville virket, det er ikke
# grunnen til å bli på 24.
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
