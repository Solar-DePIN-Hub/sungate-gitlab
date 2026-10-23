FROM node:24-alpine
ARG APP_VERSION=dev
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY public ./public
ENV PORT=8080 NODE_ENV=production APP_VERSION=$APP_VERSION
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
CMD ["node", "src/server.js"]
