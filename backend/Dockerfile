# TricityMatch Backend Dockerfile
# Multi-stage build for production optimization

# ==================== BUILD STAGE ====================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci --only=production

# ==================== PRODUCTION STAGE ====================
FROM node:20-alpine AS production

# Set environment
ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S tricitymatch -u 1001

WORKDIR /app

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY --chown=tricitymatch:nodejs . .

# Remove unnecessary files
RUN rm -rf .env* .git* *.md seeders/ACCOUNT*.* seeders/*.txt seeders/*.json

# Create uploads directory
RUN mkdir -p uploads && chown -R tricitymatch:nodejs uploads

# Switch to non-root user
USER tricitymatch

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start command
CMD ["node", "server.js"]
