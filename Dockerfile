# Multi-stage build for HTTP Interactions version (Debian-based - Best Practice)
FROM node:18-slim AS builder

WORKDIR /app

# Install OpenSSL and other required packages
RUN apt-get update && \
    apt-get install -y openssl && \
    rm -rf /var/lib/apt/lists/*

# Copy package files and install dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production
RUN npx prisma generate

# Production stage
FROM node:18-slim AS production

# Install required packages for proper signal handling and OpenSSL
RUN apt-get update && \
    apt-get install -y dumb-init openssl gosu && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create non-root user for security
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home nodeapp

# Copy package files and node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy Prisma generated client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy application source code
COPY src/ ./src/
COPY prisma/ ./prisma/

# Copy entrypoint script
COPY entrypoint.sh ./entrypoint.sh

# Set permissions
RUN chown -R nodeapp:nodejs /app && \
    chmod +x ./entrypoint.sh

# Expose the HTTP interactions port (configurable via PORT env var)
EXPOSE 3001

# Health check - check if HTTP server responds (uses PORT env var or default 3001)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "const http=require('http'); const port=process.env.PORT||3001; const options={hostname:'localhost',port:port,path:'/health',timeout:5000}; const req=http.request(options, (res)=>{if(res.statusCode===200){process.exit(0)}else{process.exit(1)}}); req.on('error',()=>process.exit(1)); req.on('timeout',()=>process.exit(1)); req.end();"

# Use custom entrypoint with dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--", "./entrypoint.sh"]

# Run the HTTP interactions server
CMD ["npm", "start"]