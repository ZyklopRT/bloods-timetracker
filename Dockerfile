# Multi-stage build for HTTP Interactions version
FROM node:18-alpine AS builder

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeapp -u 1001

# Copy package files and node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy application source code
COPY src/ ./src/

# Copy entrypoint script
COPY entrypoint.sh ./entrypoint.sh

# Create data directory for SQLite database persistence
RUN mkdir -p ./data && \
    chown -R nodeapp:nodejs /app && \
    chmod 755 ./data && \
    chmod +x ./entrypoint.sh

# Switch to non-root user
USER nodeapp

# Expose the HTTP interactions port (configurable via PORT env var)
EXPOSE 3001

# Health check - check if HTTP server responds (uses PORT env var or default 3001)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "const http=require('http'); const port=process.env.PORT||3001; const options={hostname:'localhost',port:port,path:'/health',timeout:5000}; const req=http.request(options, (res)=>{if(res.statusCode===200){process.exit(0)}else{process.exit(1)}}); req.on('error',()=>process.exit(1)); req.on('timeout',()=>process.exit(1)); req.end();"

# Use custom entrypoint with dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--", "./entrypoint.sh"]

# Run the HTTP interactions server
CMD ["npm", "start"]
