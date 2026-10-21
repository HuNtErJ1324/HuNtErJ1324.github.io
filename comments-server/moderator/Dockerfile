# Node 24 runs the TypeScript sources directly (type stripping): no build step.
FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY src ./src
ENV NODE_ENV=production
USER node
EXPOSE 8080
CMD ["node", "src/main.ts"]
