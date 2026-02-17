# Linkary API - Railway deploy
# Do NOT pass secrets via ARG/ENV; use Railway runtime env vars only.

FROM node:20-alpine AS base
WORKDIR /app

# Install deps (including devDependencies for build)
COPY package.json package-lock.json* ./
RUN npm install

# Build
COPY . .
RUN npm run build

# Production run
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/index.js"]
