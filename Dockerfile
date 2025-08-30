# Multi-stage build for optimal image size
FROM node:20-alpine AS builder

# Install build dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Copy source code and build
COPY src/ ./src/
COPY tsconfig.json ./
RUN npm run build

# Deploy Discord commands (production)
RUN npm run deploy:prod

# Production stage
FROM node:20-alpine AS production

# Create app directory
WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist/ ./dist/

# Copy data directory for SQLite database
COPY data/ ./data/

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeapp -u 1001 && \
    chown -R nodeapp:nodejs /app

USER nodeapp

# Health check - simple process check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD ps aux | grep -v grep | grep "node dist/index.js" || exit 1

# Start the Discord bot directly
CMD ["node", "dist/index.js"]
