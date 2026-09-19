FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
# npm solo se necesita para instalar dependencias, no para ejecutar la app.
# Se elimina del runtime: su "tar" empaquetado arrastra CVE-2026-59873
# (CRITICAL) y ampliar la superficie de ataque sin necesidad no tiene sentido.
RUN npm install --omit=dev && npm cache clean --force \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY --from=builder /app/dist ./dist
USER node
EXPOSE 4002
CMD ["node", "dist/server.js"]
