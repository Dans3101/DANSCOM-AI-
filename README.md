# DANSCOM WhatsApp Automation Bot 🤖

Modern, production-ready WhatsApp automation bot built with Node.js, Baileys, Express, and Google Gemini AI. Fully independent and portable across **Render** and **Ubuntu Linux VPS** from a single GitHub codebase.

---

## 🚀 Features
- **Auto Status View & Like**: Automatically watch and react to statuses.
- **AI Integration**: Powered by Google Gemini for smart replies and commands (`.ai`, `.gpt`).
- **Persistent Sessions**: Multi-platform session persistence supporting local persistent directories (`./data/whatsapp-session`) and Firestore.
- **Payment Integration**: PayHero M-Pesa automated billing & checkout hooks.
- **Toggleable Settings**: Enable/disable features via `.enable [feature]` commands.
- **Analytics & Health Checks**: Built-in `/health` endpoint and command tracking.
- **Anti-Ban**: Built-in delays and human-like interaction patterns.
- **Security & Stability**: Rate limiting, helmet security, and graceful shutdown.

---

## ⚙️ Environment Configuration

Copy `.env.example` to `.env` and configure your settings:

```env
# GEMINI_API_KEY: Required for Gemini AI API calls.
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"

# BOT CONFIG
OWNER_NUMBER="254712345678"
PREFIX="."
PORT=3000
WHATSAPP_SESSION_DIR="./data/whatsapp-session"
PUBLIC_BASE_URL="https://your-domain.com"

# PAYHERO PAYMENT INTEGRATION (Optional)
PAYHERO_API_KEY=""
PAYHERO_API_USERNAME=""
PAYHERO_API_PASSWORD=""
PAYHERO_CHANNEL_ID="1"
PAYHERO_ACCOUNT_ID="9178"
PAYHERO_LIPWA_LINK="https://lipwa.link/9178"
PAYHERO_IS_SANDBOX="false"
```

---

## 🌐 1. Render Deployment

Render natively supports deployment via `render.yaml`.

1. Connect your GitHub repository to Render.
2. Render automatically detects `render.yaml`, the build command (`npm install && npm run build`), and start command (`npm run start`).
3. Add your environment variables (`GEMINI_API_KEY`, `OWNER_NUMBER`, etc.) in the Render Web Dashboard.
4. Deploy! View the logs to scan the QR code or retrieve pairing info.

---

## 🐧 2. Ubuntu Linux VPS Deployment

Follow these exact steps to deploy the bot on a standard Ubuntu VPS using Node.js LTS and PM2 for continuous background operation.

### Step 1: Update Ubuntu & Install Prerequisites
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential
```

### Step 2: Install Node.js LTS (v20.x)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

### Step 3: Clone Repository & Install Dependencies
```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git danscom-bot
cd danscom-bot
npm install
```

### Step 4: Configure Environment Variables & Session Directory
```bash
cp .env.example .env
nano .env
```
Ensure `PORT=3000`, `WHATSAPP_SESSION_DIR="./data/whatsapp-session"`, and your `GEMINI_API_KEY` are configured.

### Step 5: Build the Application
```bash
npm run build
```

### Step 6: Install PM2 & Start the Bot
```bash
sudo npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```
Follow the command output instructions given by `pm2 startup` to enable auto-restart on VPS reboot.

### Step 7: Configure Nginx & UFW Firewall (Optional Reverse Proxy)
```bash
sudo apt install -y nginx ufw
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

Create an Nginx server block (`/etc/nginx/sites-available/danscom`):
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/danscom /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🩺 Health Check & Monitoring

- **Health Endpoint**: `GET /health` returns:
  ```json
  {
    "status": "ok",
    "timestamp": "2026-08-16T12:00:00.000Z",
    "uptime": 142.5
  }
  ```
- **PM2 Monitoring**:
  - View logs: `pm2 logs whatsapp-bot`
  - Monitor CPU/RAM: `pm2 monit`
  - Restart bot: `pm2 restart whatsapp-bot`

---

## 🔑 WhatsApp Authentication & Persistence
- When starting for the first time, check `pm2 logs whatsapp-bot` or the Render console logs to view the QR code or pairing code.
- Session authentication tokens are stored securely in `WHATSAPP_SESSION_DIR` (`./data/whatsapp-session`), ensuring sessions survive bot restarts, updates, and VPS reboots without requiring re-authentication.

---
Built with ❤️ using Google AI Studio.
