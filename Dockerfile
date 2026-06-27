# syntax=docker/dockerfile:1
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy source code
COPY src/ ./src/

# Copy .env for runtime (override via compose environment or env_file)
COPY .env ./.env

EXPOSE 5000

USER node

CMD ["node", "src/app.js"]
