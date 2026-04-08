# --- Build Stage ---
FROM node:18-slim AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy all files and build the frontend
COPY . .
RUN npm run build

# --- Production Stage ---
FROM node:18-slim

# Set up a non-root user for Hugging Face (UID 1000)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR /app

# Copy package files and install production dependencies
COPY --chown=user:user package*.json ./
RUN npm install --production

# Copy built assets and server code
COPY --chown=user:user --from=builder /app/dist ./dist
COPY --chown=user:user --from=builder /app/server.ts ./
COPY --chown=user:user --from=builder /app/tsconfig.json ./

# Set environment variables
ENV NODE_ENV=production
ENV PORT=7860
EXPOSE 7860

# Start the application using tsx
CMD ["npx", "tsx", "server.ts"]
