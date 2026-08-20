# Deploy TricityMatch on Hostinger VPS — Step by Step

Use this guide in order. Each step has commands you can copy-paste. We use **GitHub** for code: you **clone** once on the VPS, then **pull** whenever you want to update.

---

## Before you start

- **Hostinger VPS** with SSH access (IP, username, password or SSH key).
- **TricityMatch code on GitHub** (your repo). If it’s only on your PC, push it to GitHub first (see Step 0).
- **`.env` is in `.gitignore`** (it already is) — so your secrets are never committed; on the VPS you’ll create `.env` from a template.

---

## Step 0 — Get your code on GitHub (do this on your PC)

Do this only if the project isn’t on GitHub yet.

1. Create a new repository on GitHub (e.g. `TricityMatch`), **don’t** add a README (you already have code).
2. On your PC, in the project folder:

```bash
cd D:\REACT\TricityMatch
git remote -v
```

If you see `origin` pointing to GitHub, you’re good. If not:

```bash
git remote add origin https://github.com/YOUR_USERNAME/TricityMatch.git
git push -u origin main
```

Replace `YOUR_USERNAME` and use `main` or your default branch name.  
**Check:** Open the repo in a browser and see your files. Then continue to Step 1.

---

## Step 1 — Connect to your VPS

1. In **Hostinger** → **VPS** → your server → **SSH Access**.
2. Note: **IP address**, **username** (often `root`), **port** (often `22`).
3. On your PC open **PowerShell** (or Terminal / Git Bash) and run:

```bash
ssh root@YOUR_VPS_IP
```

(If your username isn’t `root`, use that. If port is different: `ssh -p PORT root@YOUR_VPS_IP`.)

4. Enter the password (or use SSH key if you set one up).  
You should see a prompt like `root@vps123:~#`. You’re now on the VPS.

**Done with Step 1?** Continue to Step 2.

---

## Step 2 — Update the server and install basics

Run these **one by one** on the VPS (copy-paste each block):

```bash
sudo apt update && sudo apt upgrade -y
```

When it finishes:

```bash
sudo apt install -y curl git
```

**Done with Step 2?** Continue to Step 3.

---

## Step 3 — Install Docker and Docker Compose

Run each block on the VPS:

```bash
curl -fsSL https://get.docker.com | sh
```

```bash
sudo apt install -y docker-compose-plugin
```

Check:

```bash
docker --version
docker compose version
```

You should see version numbers. If you’re **not** root and Docker says “permission denied”, run:

```bash
sudo usermod -aG docker $USER
```

Then log out and SSH in again. If you’re `root`, you can skip that.

**Done with Step 3?** Continue to Step 4.

---

## Step 4 — Clone the project from GitHub

Replace `YOUR_USERNAME` and repo name if different (use the **HTTPS** clone URL from GitHub):

```bash
cd /opt
sudo git clone https://github.com/YOUR_USERNAME/TricityMatch.git
cd TricityMatch
```

If the repo is **private**, use a **Personal Access Token** instead of password when Git asks:

- GitHub → Settings → Developer settings → Personal access tokens → Generate new token (classic).
- Give it `repo` scope.
- When Git asks for password, paste the token.

Check:

```bash
ls -la
```

You should see `backend`, `frontend`, `docker-compose.yml`, `.env.production.example`, etc.

**Done with Step 4?** Continue to Step 5.

---

## Step 5 — Create and edit `.env` (secrets)

Your `.env` is **not** in Git (it’s in `.gitignore`). You create it once on the VPS and keep it; later `git pull` won’t overwrite it.

**5.1 — Copy the template**

```bash
cd /opt/TricityMatch
cp .env.production.example .env
```

**5.2 — Generate two secrets** (run twice, use first for JWT, second for COOKIE):

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy each 64-character string.

**5.3 — Edit `.env`**

```bash
nano .env
```

Set at least these (use your own values):

| Variable         | What to put |
|------------------|-------------|
| `JWT_SECRET`     | First 64-char hex from above |
| `COOKIE_SECRET`  | Second 64-char hex |
| `DB_PASSWORD`    | A strong password you choose (e.g. random 20+ chars) |
| `FRONTEND_URL`   | If you’ll use a **domain** later: `https://yourdomain.com`. For **IP only**: `http://YOUR_VPS_IP:3000` |
| `CORS_ORIGIN`    | Same as `FRONTEND_URL` (no trailing slash) |
| `EMAIL_HOST`     | e.g. `smtp.gmail.com` |
| `EMAIL_PORT`     | `587` |
| `EMAIL_USER`     | Your email |
| `EMAIL_PASSWORD` | App password (e.g. Gmail app password) |
| `EMAIL_FROM`     | e.g. `TricityMatch <noreply@yourdomain.com>` |
| `CLOUDINARY_CLOUD_NAME` | From Cloudinary |
| `CLOUDINARY_API_KEY`    | From Cloudinary |
| `CLOUDINARY_API_SECRET` | From Cloudinary |

For **Razorpay** (payments), set the three `RAZORPAY_*` variables from your dashboard when you’re ready.

Save and exit: `Ctrl+O`, `Enter`, then `Ctrl+X`.

**Done with Step 5?** Continue to Step 6.

---

## Step 6 — Choose: with or without a domain

- **No domain yet (test with IP):** do **Step 6A**.
- **I have a domain pointing to this VPS:** do **Step 6B**.

---

## Step 6A — Deploy without a domain (use VPS IP)

Use this to test. You’ll open the site at `http://YOUR_VPS_IP:3000`.

**6A.1 — Open firewall ports on the VPS**

```bash
sudo ufw allow 22
sudo ufw allow 3000
sudo ufw allow 5000
sudo ufw --force enable
```

**6A.2 — In Hostinger panel:** VPS → Firewall / Security → allow **TCP** ports **3000** and **5000** (and 22 for SSH) if there’s a firewall there.

**6A.3 — Build and start** (no Nginx; frontend and backend listen directly)

```bash
cd /opt/TricityMatch
docker compose up -d --build
```

Wait until it finishes (first time can take a few minutes).

**6A.4 — Run database migrations**

```bash
docker compose exec backend npm run migrate
```

**6A.5 — Check**

- Frontend: open in browser `http://YOUR_VPS_IP:3000`
- Backend health: `http://YOUR_VPS_IP:5000/health`

If you can’t connect, check Hostinger firewall and `docker compose ps` (all services should be “Up”).

**Done with 6A?** You’re live. When you get a domain, follow Step 6B and switch to Nginx + SSL.

---

## Step 6B — Deploy with a domain (Nginx + HTTPS)

Do this when your domain’s DNS **A record** points to your VPS IP.

**6B.1 — DNS**

In your domain DNS (Hostinger or wherever):

- **A** record: `@` → `YOUR_VPS_IP`
- **A** record: `www` → `YOUR_VPS_IP`

Wait a few minutes, then on your PC: `ping yourdomain.com` — it should show your VPS IP.

**6B.2 — Create SSL directory on VPS**

```bash
cd /opt/TricityMatch
sudo mkdir -p nginx/ssl
```

**6B.3 — Install Certbot and get certificate**

Containers must **not** use port 80 yet. If you already ran `docker compose up`, run:

```bash
docker compose --profile full down 2>/dev/null || true
docker compose down 2>/dev/null || true
```

Then (replace `yourdomain.com` and `your@email.com`):

```bash
sudo apt install -y certbot
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com --non-interactive --agree-tos -m your@email.com
```

**6B.4 — Copy certs into the project**

Replace `yourdomain.com` with your domain:

```bash
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/
sudo chown -R $USER:$USER nginx/ssl
```

**6B.5 — Set Nginx server name**

```bash
nano nginx/nginx.conf
```

Replace every `tricitymatch.com` and `www.tricitymatch.com` with **yourdomain.com** and **www.yourdomain.com**. Save: `Ctrl+O`, `Enter`, `Ctrl+X`.

**6B.6 — `.env` for domain**

In `.env` you should have:

- `FRONTEND_URL=https://yourdomain.com`
- `CORS_ORIGIN=https://yourdomain.com`
- `VITE_API_URL=/api` (so the frontend talks to your domain; Nginx proxies `/api` to the backend)

If you changed `.env`, no need to restart yet; the next build will use it.

**6B.7 — Start full stack (with Nginx)**

```bash
mkdir -p nginx/conf.d
docker compose --profile full up -d --build
docker compose exec backend npm run migrate
```

**6B.8 — Firewall**

```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable
```

Also allow 80 and 443 in Hostinger’s firewall if it has one.

**6B.9 — Open** `https://yourdomain.com` in the browser.

**Done with 6B?** You’re live with HTTPS.

---

## Step 7 — Updating the app (GitHub pull)

When you push changes from your PC to GitHub, update the VPS like this:

**7.1 — SSH into the VPS**

```bash
ssh root@YOUR_VPS_IP
```

**7.2 — Go to the project and pull**

```bash
cd /opt/TricityMatch
git pull origin main
```

(Use your default branch name if it’s not `main`.)

**7.3 — Rebuild and restart**

- **If you’re using Nginx (domain):**

```bash
docker compose --profile full up -d --build
```

- **If you’re using IP only (no Nginx):**

```bash
docker compose up -d --build
```

**7.4 — If you added or changed database migrations**

```bash
docker compose exec backend npm run migrate
```

Your `.env` is **not** in Git, so it stays as you configured it; only code and configs from the repo are updated.

**Summary:**  
`git pull origin main` → `docker compose --profile full up -d --build` (or `docker compose up -d --build`) → `npm run migrate` if needed.

---

## Quick reference

| Task              | Command |
|------------------|--------|
| View backend logs| `docker compose logs -f backend` |
| View frontend logs | `docker compose logs -f frontend` |
| See all containers | `docker compose ps` |
| Restart after editing `.env` | `docker compose --profile full down && docker compose --profile full up -d` (or without `--profile full` if no domain) |
| Stop everything   | `docker compose --profile full down` |

---

## Troubleshooting

- **Can’t open site** — Check Hostinger firewall and UFW: 22, 80, 443 (or 3000/5000 for IP-only). Run `docker compose ps` and check logs.
- **502 Bad Gateway** — Backend/frontend still starting. Wait 1–2 minutes and check `docker compose logs backend`.
- **CORS / API errors** — `FRONTEND_URL` and `CORS_ORIGIN` must match the URL in the browser (e.g. `https://yourdomain.com` no trailing slash).
- **Database errors** — With Docker, `DB_HOST=postgres` is correct. Ensure postgres is up: `docker compose ps`.
- **SSL errors** — Ensure `nginx/ssl/fullchain.pem` and `privkey.pem` exist and `server_name` in `nginx/nginx.conf` matches your domain.

---

## Summary flow

1. **PC:** Code on GitHub (Step 0).
2. **VPS:** SSH (1) → update + Docker (2–3) → clone (4) → `.env` (5) → deploy (6A or 6B).
3. **Later:** Push from PC → on VPS: `git pull` → `docker compose ... up -d --build` → migrate if needed (Step 7).

You can follow the steps in order and say which step you’re on if you need help.
