FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY dist/ ./dist/
COPY src/verify-app/public/ ./dist/verify-app/public/

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/index.js"]
