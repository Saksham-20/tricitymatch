# SSL Certificates

Place your SSL certificate files here:

```
ssl/
├── tricityshadi.com.crt    (full chain — cert + intermediates)
├── tricityshadi.com.key    (private key, 0600 permissions)
└── dhparam.pem             (2048-bit DH params: openssl dhparam -out dhparam.pem 2048)
```

## Let's Encrypt (Certbot)

```bash
# Install certbot
apt install certbot python3-certbot-nginx

# Issue cert (HTTP challenge — nginx must be running with port 80 open)
certbot certonly --webroot -w /var/www/certbot -d tricityshadi.com -d www.tricityshadi.com

# Certs land in: /etc/letsencrypt/live/tricityshadi.com/
# Symlink or copy into ./nginx/ssl/
```

## nginx.conf SSL block (update paths when certs are in place)

```nginx
ssl_certificate     /etc/nginx/ssl/tricityshadi.com.crt;
ssl_certificate_key /etc/nginx/ssl/tricityshadi.com.key;
ssl_dhparam         /etc/nginx/ssl/dhparam.pem;
ssl_protocols       TLSv1.2 TLSv1.3;
ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256;
ssl_prefer_server_ciphers off;
ssl_session_cache   shared:SSL:10m;
ssl_session_timeout 1d;
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
```

**Never commit private keys to git.** `.gitignore` already excludes `*.key` and `*.pem`.
