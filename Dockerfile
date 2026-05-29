FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build && npm prune --omit=dev

RUN mkdir -p uploads

ENV NODE_ENV=production
ENV PORT=3000
ENV WS_PORT=3001
ENV HOST=0.0.0.0

EXPOSE 3000 3001

CMD ["node", "dist/server.js"]
