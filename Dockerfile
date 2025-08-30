# Multi-stage build for optimal image size and security
FROM node:20-alpine AS builder

# Install build dependencies including Python for native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files and install all dependencies (including dev)
COPY package*.json ./
RUN npm ci --include=dev

# Copy source code and build
COPY src/ ./src/
COPY tsconfig.json ./
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist/ ./dist/

# Copy startup script
COPY scripts/startup.sh ./scripts/startup.sh

# Create data directory for SQLite database persistence
RUN mkdir -p ./data

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeapp -u 1001 && \
    chown -R nodeapp:nodejs /app && \
    chmod +x ./scripts/startup.sh

# Switch to non-root user
USER nodeapp

# Expose health check endpoint (if implemented)
EXPOSE 3000

# Health check - check if bot process is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD ps aux | grep -v grep | grep "node dist/index.js" || exit 1

# Use dumb-init to handle signals properly and run startup script
ENTRYPOINT ["dumb-init", "--"]
CMD ["./scripts/startup.sh"]
