# TricityMatch Backend Dockerfile
# Multi-stage build for production optimization

# Node 22 (LTS). Node 20 reached end of life in April 2026. Pinned by digest so a
# rebuild cannot silently pick up a different base; bump the tag AND digest
# together (docker buildx imagetools inspect node:22-alpine).
ARG NODE_IMAGE=node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402

# ==================== BUILD STAGE ====================
FROM ${NODE_IMAGE} AS builder

WORKDIR /app

# Copy package files (+ .npmrc for legacy-peer-deps resolution)
COPY package*.json .npmrc ./

# Install exactly the tree that was tested (backend/package-lock.json is committed;
# npm ci fails if it and package.json disagree)
RUN npm ci --omit=dev

# ==================== PRODUCTION STAGE ====================
FROM ${NODE_IMAGE} AS production

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
