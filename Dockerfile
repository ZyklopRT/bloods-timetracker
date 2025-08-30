FROM node:20-alpine

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy built application
COPY dist/ ./dist/
COPY data/ ./data/

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodeapp -u 1001
RUN chown -R nodeapp:nodejs /app
USER nodeapp

# Health check - simple process check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD ps aux | grep -v grep | grep "node dist/index.js" || exit 1

# Start the Discord bot directly
CMD ["node", "dist/index.js"]
