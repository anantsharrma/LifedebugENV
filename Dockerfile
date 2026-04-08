# --- Build Stage ---
FROM node:20-slim AS builder

WORKDIR /app

# Only copy package.json to force a fresh install for the current platform (Linux)
# This avoids "Cannot find native binding" errors caused by platform-specific lockfiles.
COPY package.json ./
RUN npm install

# Copy all files and build the frontend
COPY . .
RUN npm run build

# --- Production Stage ---
FROM node:20-slim

# Hugging Face expects UID 1000. In node:slim, this is the 'node' user.
USER node
ENV HOME=/home/node \
    PATH=/home/node/.local/bin:$PATH

WORKDIR $HOME/app

# Only copy package.json for production install
COPY --chown=node:node package.json ./
RUN npm install --production

# Copy built assets and server code
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/server.ts ./
COPY --chown=node:node --from=builder /app/tsconfig.json ./
COPY --chown=node:node --from=builder /app/openenv.yaml ./

# Set environment variables
ENV NODE_ENV=production
ENV PORT=7860
EXPOSE 7860

# Start the application using tsx
CMD ["npx", "tsx", "server.ts"]
