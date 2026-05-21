FROM node:22-alpine
WORKDIR /app

COPY server/package*.json ./server/
RUN cd server && npm ci

COPY server/ ./server/
RUN cd server && npm run build

CMD ["node", "server/build/main.js"]
