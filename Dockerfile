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

# Install Python, pip, and create a symlink so 'python' command works
RUN apt-get update && apt-get install -y python3 python3-pip && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    rm -rf /var/lib/apt/lists/*

# Install python dependencies as root to ensure they are available globally
RUN pip3 install requests openai openenv-core>=0.2.0 --break-system-packages

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
COPY --chown=node:node --from=builder /app/pyproject.toml ./
COPY --chown=node:node --from=builder /app/uv.lock ./
COPY --chown=node:node --from=builder /app/inference.py ./
COPY --chown=node:node --from=builder /app/server ./server

# Set environment variables
ENV NODE_ENV=production
ENV PORT=7860
EXPOSE 7860

# Start the application using tsx
CMD ["npx", "tsx", "server.ts"]
