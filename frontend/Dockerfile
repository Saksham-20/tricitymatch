# TricityMatch Frontend Dockerfile
# Multi-stage build for production optimization

# ==================== BUILD STAGE ====================
FROM node:20-alpine AS builder

WORKDIR /app

# Build arguments for environment variables
ARG VITE_API_URL=/api
ARG VITE_WS_URL=
ARG VITE_RAZORPAY_KEY_ID=
ARG VITE_CLOUDINARY_CLOUD_NAME=
ARG VITE_GOOGLE_CLIENT_ID=
# Web voice/video calls render only when this is set (calls UI auto-hides otherwise).
ARG VITE_AGORA_APP_ID=
# Support channels rendered in the footer / Help Centre. Unset means the channel
# is HIDDEN — never a placeholder number.
ARG VITE_SUPPORT_EMAIL=
ARG VITE_SUPPORT_WHATSAPP=
ARG VITE_SUPPORT_PHONE=
ARG VITE_SUPPORT_ADDRESS=
# Statutory disclosures published on /terms, /privacy and the footer (IT Rules 2021
# r.3(2)(a), Consumer Protection (E-Commerce) Rules 2020). Vite bakes these in at
# BUILD time: a value that is not passed here is absent from the shipped bundle
# no matter what the server .env says. Unset => the line is hidden, never faked.
ARG VITE_LEGAL_ENTITY=
ARG VITE_LEGAL_ADDRESS=
ARG VITE_LEGAL_GSTIN=
ARG VITE_GRIEVANCE_OFFICER=
ARG VITE_GRIEVANCE_EMAIL=
ARG VITE_PRIVACY_EMAIL=
ARG VITE_DPO_NAME=

# Set environment variables for build
ENV VITE_API_URL=$VITE_API_URL \
    VITE_WS_URL=$VITE_WS_URL \
    VITE_RAZORPAY_KEY_ID=$VITE_RAZORPAY_KEY_ID \
    VITE_CLOUDINARY_CLOUD_NAME=$VITE_CLOUDINARY_CLOUD_NAME \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_AGORA_APP_ID=$VITE_AGORA_APP_ID \
    VITE_SUPPORT_EMAIL=$VITE_SUPPORT_EMAIL \
    VITE_SUPPORT_WHATSAPP=$VITE_SUPPORT_WHATSAPP \
    VITE_SUPPORT_PHONE=$VITE_SUPPORT_PHONE \
    VITE_SUPPORT_ADDRESS=$VITE_SUPPORT_ADDRESS \
    VITE_LEGAL_ENTITY=$VITE_LEGAL_ENTITY \
    VITE_LEGAL_ADDRESS=$VITE_LEGAL_ADDRESS \
    VITE_LEGAL_GSTIN=$VITE_LEGAL_GSTIN \
    VITE_GRIEVANCE_OFFICER=$VITE_GRIEVANCE_OFFICER \
    VITE_GRIEVANCE_EMAIL=$VITE_GRIEVANCE_EMAIL \
    VITE_PRIVACY_EMAIL=$VITE_PRIVACY_EMAIL \
    VITE_DPO_NAME=$VITE_DPO_NAME

# Copy package files (package-lock.json is a standalone lockfile for this
# Docker context — the repo root's workspace lockfile isn't visible here)
COPY package*.json ./

# Deterministic install: npm ci fails loudly on lockfile drift instead of
# silently resolving newer transitives on the production box
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# ==================== PRODUCTION STAGE ====================
FROM nginx:alpine AS production

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Create non-root user
RUN adduser -D -g '' nginx-user && \
    chown -R nginx-user:nginx-user /usr/share/nginx/html && \
    chown -R nginx-user:nginx-user /var/cache/nginx && \
    chown -R nginx-user:nginx-user /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx-user:nginx-user /var/run/nginx.pid

# NOTE: the nginx-user created and chowned above is deliberately NOT switched
# to yet. Running the master as non-root needs an unprivileged listen port,
# which means changing frontend/nginx.conf, the reverse-proxy upstream and the
# compose mapping in lockstep — unverifiable without a container build, and a
# mistake takes the site down. Workers already drop privileges, so this is
# hardening rather than a live issue. Deferred until it can be staged.

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
