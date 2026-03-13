# 2FAuth Worker

English | [中文](README.md)

**High-security, lightweight Two-Factor Authentication (2FA/TOTP) management system supporting both Cloudflare Serverless and Docker private deployment.**


[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat&logo=cloudflare)](https://workers.cloudflare.com/)
[![Docker](https://img.shields.io/badge/Docker-Supported-2496ED?logo=docker&logoColor=white)](https://hub.docker.com/r/nap0o/2fauth-worker)
[![GitHub Actions](https://img.shields.io/badge/GitHub-Actions-181717?style=flat&logo=github)](https://github.com/nap0o/2fauth-worker/actions)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-red.svg)](https://www.gnu.org/licenses/agpl-3.0)

[**Click here for LIVE DEMO**](https://2fa.nezha.pp.ua)

> 💡 **Tip**: The demo site has open enrollment enabled; data can be modified or deleted. For official deployment, please ensure you configure the allowed users whitelist.

---

## 🌟 Why choose 2FAuth Worker?

Whether you're leveraging Cloudflare's free tier or deploying on your own NAS/mini-PC, 2FAuth Worker provides the **most secure** and convenient 2FA management experience.

### 🕊️ True "Dual-Mode" Deployment
*   **Cloudflare Lovers**: One-click deployment to Cloudflare Workers – zero cost, zero maintenance, and global acceleration.
*   **Private Cloud Geeks**: Supports Docker deployment. Keep your data locked on your own hardware; it even works in offline local networks.

### 📱 Smooth PWA Experience
*   **Immersive Experience**: Install it to your desktop or mobile home screen for a distraction-free environment without browser bars.
*   **Offline Ready**: Thanks to advanced Service Worker caching, it opens instantly and generates accurate codes even in extreme environments without internet (like basements or airplanes).

### 🛡️ "Smart Shield" Security (Health Shield)
*   Built-in intelligent health checks. If the system detects critical missing keys or improper configurations, it will immediately "shut down" access to prevent your data from being exposed in an insecure environment.

### 📦 The Ultimate "Undo Button" (Multi-channel Backup)
*   Supports automatic backups via WebDAV, S3 cloud storage, or Telegram bots. If you lose your phone, reinstall your OS, or even lose your Cloudflare account, you can recover everything instantly from your backup.

---

<details>
<summary>Click to view: Product Feature Comparison</summary>

| Feature | **2FAuth Worker** (This Project) | Google / MS Auth | Authy | 2FAS / Aegis | 1Password / Bitwarden |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Data Ownership | ✅ Full Control (Private/NAS) | ❌ Tied to Big Tech | ❌ Vendor-locked | ✅ Local/Private Cloud | ⚠️ Third-party Hosted |
| Cross-Platform | ✅ Web+PWA (Universal) | ⚠️ Mobile App only | ❌ Desktop App closed | ⚠️ Mobile App only | ✅ Full Platform Support |
| Recovery | ✅ Auto Backups (TG/S3) | ⚠️ Manually Exporting | ✅ Cloud Sync | ⚠️ Manage Files Manually | ✅ Cloud Sync |
| Privacy | ✅ Anonymous, No Tracking | ⚠️ Tied to Big Tech ID | ⚠️ Forced Phone Bind | ✅ No Tracking | ✅ Safe but high profile |
| Offline Support | ✅ Yes (PWA Cache) | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| Cost | ✅ $0 (CF Serverless) | ✅ Free | ✅ Free | ✅ Free | 💰 Subscription based |
| Vendor Risk | ✅ Source in Hand | ⚠️ Forced migration risks | 🚨 Feature shutdowns (PC) | ✅ Open-source control | ⚠️ Subscription/Closed |

> 🎯 **Summary**: **2FAuth Worker** combines the multi-device convenience of 1Password with the privacy of open-source apps, and the zero cost of Serverless. **Automatic Telegram backup** completely eliminates "data loss anxiety" common in both web and mobile apps, making security truly accessible.

</details>

---

## 🚀 Deployment Guide (Choose One)

### Option A: Cloudflare Worker (Fastest, Recommended for Beginners)

The most hassle-free way. No server required; Cloudflare hosts it for you for free.

#### 1. One-click Auto Deploy
1. Fork this repository, and give it a `Star`! ⭐
2. Click the deploy button below <br />
[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://dash.cloudflare.com/?to=/:account/workers-and-pages/create)

#### 2. Notes & Authorization
*   In the deployment wizard, you need to authorize Cloudflare to read this repository.

<details>
<summary>Click to view: Authorization Guide Diagrams</summary>  
<img height="200" src="https://github.com/user-attachments/assets/cb64bc2f-6dcc-40cb-a781-3bc2c7bc5b28" /><br/>
<img height="400" src="https://github.com/user-attachments/assets/3f186ea6-80f5-4d78-b90f-724af33a73ae" />
<img height="400" src="https://github.com/user-attachments/assets/c1f2d5ee-2f3f-47c2-969f-00308cadff21" />
</details>

#### 3. Deployment Flow
Click in sequence: Continue with GitHub -> Select your forked repository (2fauth-worker) -> Next -> Deploy -> Continue to project -> Settings

<details>
<summary>Click to view: Detailed deployment steps diagram</summary>
<img height="400" src="https://github.com/user-attachments/assets/6a933580-98d5-4b09-ac1f-e2aa33380807" /><br />
<img height="400" src="https://github.com/user-attachments/assets/14e57427-0eac-4d20-8d9c-f8957803f247" /><br />
<img height="400" src="https://github.com/user-attachments/assets/b123a063-4671-4fc2-94fc-94b7a2d71235" /><br />
<img height="600" src="https://github.com/user-attachments/assets/c4be75c1-2732-4dfb-abaa-72384f482d4f" />
<img height="300" src="https://github.com/user-attachments/assets/ddce1191-353c-466d-a55c-044a1fcc47b4" />
</details>

#### 4. Add the following Variables and Secrets in `Settings`
  *   `ENCRYPTION_KEY`: A random key with at least 32 characters.
  *   `JWT_SECRET`: A random JWT secret with at least 32 characters.
  *   `OAUTH_ALLOWED_USERS`: your_email@example.com
  *   `OAUTH_GITHUB_CLIENT_ID`: Your CLIENT_ID
  *   `OAUTH_GITHUB_CLIENT_SECRET`: Your CLIENT_SECRET
  *   `OAUTH_GITHUB_REDIRECT_URI`: Your Callback URL

<details>
<summary>Click to view: Add Variables and Secrets Diagram</summary>
<img height="600" src="https://github.com/user-attachments/assets/51d6e702-142e-4f58-8f02-c4a0bbcf009c" />
</details>

---

### Option B: Docker (For NAS / Private Server Users)

If you want absolute control over your data or need to run it in a local network.

**⚠️ Important Security Notice**: To provide the highest level of security, this image runs strictly as a **non-privileged user (node, UID 1000)** to prevent container escape risks. 
You **MUST** create the data directory and set the correct permissions on your host machine before starting the container, otherwise you will encounter `Permission Denied` errors.

#### 0. Prepare Data Directory (Required)
```bash
mkdir -p data && sudo chown -R 1000:1000 data
```

#### 1. Using Docker Compose (Recommended)

1. Create `docker-compose.yml` on your server:
```yaml
services:
  2fauth:
    image: nap0o/2fauth-worker:latest
    container_name: 2fauth-worker
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      # Core Secrets
      - ENCRYPTION_KEY=Your_32_Character_Random_Key
      - JWT_SECRET=Your_32_Character_Random_JWT_Secret
      - OAUTH_ALLOWED_USERS=your_email@example.com
      # Configure at least one provider (GitHub example)
      - OAUTH_GITHUB_CLIENT_ID=your_id
      - OAUTH_GITHUB_CLIENT_SECRET=your_secret
      - OAUTH_GITHUB_REDIRECT_URI=[https://your-domain.com/oauth/callback](https://your-domain.com/oauth/callback)
    restart: unless-stopped
```
2. Run `docker compose up -d`.

#### 2. Using Docker Run
```bash
docker run -d --name 2fauth-worker \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e ENCRYPTION_KEY=Your_32_Character_Random_Key \
  -e JWT_SECRET=Your_32_Character_Random_JWT_Secret \
  -e OAUTH_ALLOWED_USERS=your_email@example.com \
  -e OAUTH_GITHUB_CLIENT_ID= \
  -e OAUTH_GITHUB_CLIENT_SECRET= \
  -e OAUTH_GITHUB_REDIRECT_URI=[https://your-domain.com/oauth/callback](https://your-domain.com/oauth/callback) \
  nap0o/2fauth-worker:latest
```

---

### Option C: GitHub Actions (For Advanced Users)

Choose this for continuous deployment or more precise database management.

#### 1. Prerequisites

*   Create a D1 database named `2fauth-db` in `Storage & Databases` -> `D1 SQL Database` and record its **Database ID**.
<details>
<summary>Click to view: Specific steps to create D1 SQL Database</summary>
<img height="500" alt="image" src="https://github.com/user-attachments/assets/80824e1b-73f8-4d13-992c-a51dc4e53308" /><br />
<img height="350" alt="image" src="https://github.com/user-attachments/assets/560c9977-2f89-4135-839d-bdf37208bfdc" /><br />
<img height="350" alt="image" src="https://github.com/user-attachments/assets/25261345-8da6-40de-86b6-a23e910e737d" />
</details>

*   Obtain a **Cloudflare API Token** (requires `Edit Cloudflare Workers` permissions).
<details>
<summary>Click to view: Steps to obtain Cloudflare Worker Deployment Token</summary>

1. Log in to Cloudflare Dashboard
2. [Go to API Tokens](https://dash.cloudflare.com/profile/api-tokens)
3. Click "Create Token"
4. Choose "Edit Cloudflare Workers" template
5. Configure "Account Resources" and "Zone Resources"
6. Click "Continue to summary" and "Create Token"
7. Copy the generated token

<img width="500"  alt="image" src="https://github.com/user-attachments/assets/6487aa6e-e505-4980-aef4-e08172116746" /><br />
<img width="800"  alt="image" src="https://github.com/user-attachments/assets/d4c737f7-2d9f-4cfb-a712-b1af416c8ef6" />
</details>

#### 2. Repository Configuration
1.  **Fork** this repository.
2.  Go to `Settings` -> `Secrets and variables` -> `Actions`.
3.  Add the following secrets:
  *   `CLOUDFLARE_ACCOUNT_ID`: Your CF Account ID.
  *   `CLOUDFLARE_API_TOKEN`: Your API Token.
  *   `CLOUDFLARE_D1_DATABASE_ID`: Your D1 Database ID.
  *   `CLOUDFLARE_D1_DATABASE_NAME`: `2fauth-db`.
  *   `ENCRYPTION_KEY`: A 32+ character random key.
  *   `JWT_SECRET`: A 32+ character random JWT secret.
  *   `OAUTH_ALLOWED_USERS`: your_email@example.com
  *   `OAUTH_GITHUB_CLIENT_ID`: Your ID
  *   `OAUTH_GITHUB_CLIENT_SECRET`: Your Secret
  *   `OAUTH_GITHUB_REDIRECT_URI`: Your Callback URL

<details>
<summary>Click to view: Secrets Configuration Example</summary>  
<img width="600" alt="Secrets Config" src="https://github.com/user-attachments/assets/ef907021-303d-4fd5-ba3e-913e8b0014a5" />
</details>

#### 3. Trigger Deployment
*   Go to the `Actions` page, manually run the `Deploy to Cloudflare Workers` workflow, or push code to the `main` branch.

<details>
<summary>Click to view: Manual Deployment Example</summary>  
<img width="600" alt="Manual Trigger" src="https://github.com/user-attachments/assets/b2891365-5c1a-4a46-83c6-5cd53dd4b895" />
</details>

---

## 🧩 Environment Variables Configuration

Regardless of the deployment method, these parameters are critical:

| Variable | Function | Recommendation |
| :--- | :--- | :--- |
| `ENCRYPTION_KEY` | **Core**: Database encryption key | **DO NOT CHANGE** after setup! Requirement: 32+ characters. |
| `JWT_SECRET` | Auth Token Secret | Requirement: 32+ characters. |
| `OAUTH_ALLOWED_USERS` | **Whitelist**: Access Control | Emails or Telegram IDs, separated by commas. |


### Variable Mapping for Different Providers (Choose at least one):

| Provider | Client ID Variable | Client Secret Variable | Redirect URI (Example: `https://xxx.dev/oauth/callback`) |
| :--- | :--- | :--- | :--- |
| **GitHub** | `OAUTH_GITHUB_CLIENT_ID` | `OAUTH_GITHUB_CLIENT_SECRET` | `OAUTH_GITHUB_REDIRECT_URI` |
| **Telegram** | `OAUTH_TELEGRAM_BOT_NAME` | `OAUTH_TELEGRAM_BOT_TOKEN` | *Not required for Telegram* |
| **Google** | `OAUTH_GOOGLE_CLIENT_ID` | `OAUTH_GOOGLE_CLIENT_SECRET` | `OAUTH_GOOGLE_REDIRECT_URI` |
| **Cloudflare Access** | `OAUTH_CLOUDFLARE_CLIENT_ID` | `OAUTH_CLOUDFLARE_CLIENT_SECRET` | `OAUTH_CLOUDFLARE_REDIRECT_URI` (requires `OAUTH_CLOUDFLARE_ORG_DOMAIN`) |
| **Gitee** | `OAUTH_GITEE_CLIENT_ID` | `OAUTH_GITEE_CLIENT_SECRET` | `OAUTH_GITEE_REDIRECT_URI` |
| **NodeLoc** | `OAUTH_NODELOC_CLIENT_ID` | `OAUTH_NODELOC_CLIENT_SECRET` | `OAUTH_NODELOC_REDIRECT_URI` |

---

#### How to configure GitHub OAuth Login (Recommended)
1. Visit GitHub `Settings` -> `Developer Settings` -> `OAuth Apps` -> **New OAuth App**.
2. **Authorization callback URL** must be: `https://your-domain.com/oauth/callback`.
3. Fill `Client ID`, `Client Secret` and `OAUTH_GITHUB_REDIRECT_URI` into environment variables.

<details>
<summary>Click to view: Github OAuth Configuration Diagram</summary>
<img width="600" alt="Github OAuth Config" src="https://github.com/user-attachments/assets/aa03b15f-deb2-4e48-bf4b-e57be342adbb" />
</details>

#### How to configure Telegram Login
1. Search and add **[@BotFather](https://t.me/BotFather)** on Telegram, following prompts to create a bot.
2. Record the **Token** (`OAUTH_TELEGRAM_BOT_TOKEN`) and **Username** (`OAUTH_TELEGRAM_BOT_NAME`).
3. You MUST send the `/setdomain` command to @BotFather, select your bot, and enter your **application domain** (without `https://`).
4. Since this is a Serverless architecture, you need to manually register the Webhook.<br/>
   Replace `<Token>` and `<Domain>` in the link below and visit it once in your browser:<br/>
   `https://api.telegram.org/bot<Token>/setWebhook?url=https://<Domain>/api/telegram/webhook`

5. Fill `OAUTH_TELEGRAM_BOT_TOKEN`, `OAUTH_TELEGRAM_BOT_NAME` into environment variables.

#### How to configure Cloudflare Access Login
1. Enter **Cloudflare Zero Trust Dashboard** -> **Access** -> **Applications**.
2. Create a **SaaS** application (Select "SaaS").
3. Configure **Application**:
    - **Name**: `Anything, e.g., 2fauth`
    - **Authentication Protocol**: `OIDC`
    - **Redirect URL**: `https://your-domain.com/oauth/callback`
4. Copy and save `Client ID` and `Client Secret`.
5. Access Policy -> Click create new policy -> Add policy:
    - **Policy**: `Allow`
    - **Selector**: `Everyone`
6. No additional configuration needed, click next through to completion.
7. Fill `OAUTH_CLOUDFLARE_CLIENT_ID`, `OAUTH_CLOUDFLARE_CLIENT_SECRET`, `OAUTH_CLOUDFLARE_REDIRECT_URI` and `OAUTH_CLOUDFLARE_ORG_DOMAIN` into environment variables.

<details>
<summary>Click to view: Cloudflare Access OAuth Configuration Diagram</summary>
<img height="500" src="https://github.com/user-attachments/assets/1e315f8f-1932-4c90-a2d7-0edf8049529f" />
<img height="400" src="https://github.com/user-attachments/assets/c6101ee8-f3c3-44f6-9286-f17865f8fb10" />
</details>

---

## 🔒 Security Auditing

To protect your account security, 2FAuth Worker implements a "Multi-Lock" strategy:

1.  **At-Rest Encryption**: All TOTP seeds stored in the database are encrypted using AES. Even if the database file is leaked, unauthorized parties cannot obtain raw keys without the `ENCRYPTION_KEY`.
2.  **Whitelist-Only Access**: Traditional registration is disabled. Only accounts in the `OAUTH_ALLOWED_USERS` list can access the system.
3.  **Smart Shield Persistence (Health Shield)**: The system continuously monitors the runtime environment. If any anomalies are detected, it enters protection mode and refuses to generate verification codes.
4.  **End-to-End Isolation**: Sensitive frontend logic is strictly filtered to prevent XSS (Cross-Site Scripting) attacks.
5.  **Privacy First**: This project contains no tracking code, analytics tools, or third-party cookies. Your data is yours alone.

> 📊 [**Click to view the real-time security audit report generated by GitHub Actions**](https://github.com/nap0o/2fauth-worker/blob/security-audit/README.md)

---

## 🛠️ Local Development

```bash
# 1. Clone and install dependencies
git clone https://github.com/nap0o/2fauth-worker.git
cd 2fauth-worker
npm install

# 2. Configure environment
cp example.dev.vars .dev.vars

# 3. Initialize local SQLite Sandbox
npx wrangler d1 execute 2fauth-db-dev --local --env dev --file=backend/schema.sql

# 4. Start dev server
npm run dev
```

---

## 📄 License
This project is open-sourced under the [GNU AGPL v3](LICENSE) license. Since this software involves 2FA security and network services, we maintain open-source fairness: if you run a modified version of this project on a server and provide services to the public, you must open your source code to the users.
