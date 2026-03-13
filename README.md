# 2FAuth Worker

[English](README_EN.md) | 中文

**支持 Cloudflare Serverless 与 Docker 私有化部署的高安全、轻量级二步验证 (2FA/TOTP) 管理系统**


[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat&logo=cloudflare)](https://workers.cloudflare.com/)
[![Docker](https://img.shields.io/badge/Docker-Supported-2496ED?logo=docker&logoColor=white)](https://hub.docker.com/r/nap0o/2fauth-worker)
[![GitHub Actions](https://img.shields.io/badge/GitHub-Actions-181717?style=flat&logo=github)](https://github.com/nap0o/2fauth-worker/actions)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-red.svg)](https://www.gnu.org/licenses/agpl-3.0)

[**点击此处查看 Demo 演示**](https://2fa.nezha.pp.ua)

> 💡 **提示**：演示站开启了全员登录模式，数据可随意修改、删除。正式部署请务必设置白名单。

---

## 🌟 为什么选择 2FAuth Worker？

不管是白嫖 Cloudflare 的免费额度，还是部署在自家的 NAS 或小主机上，2FAuth Worker 都能为你提供**最安全**、最便捷的 2FA 密钥管理体验。

### 🕊️ 真正的“全方位”部署 (Dual-Mode)
*   **白嫖党最爱**：一键部署到 Cloudflare Workers，零成本、零维护、全球加速。
*   **私有云极客**：支持 Docker 部署，数据锁在自家硬盘里，局域网断网也能用。

### 📱 像原生 App 一样好用 (PWA)
*   **沉浸式体验**：支持安装到电脑桌面或手机主屏幕，没有浏览器边框的干扰。
*   **断网也不怕**：得益于先进的离线缓存技术，即便在地下室或飞机上（无网络），它依然能秒开并为你生成精准的验证码。

### 🛡️ “拉闸式”安全护卫 (Health Shield)
*   我们内置了智能安检逻辑。如果程序检测到关键密钥丢失或配置不当，它会立即“拉闸”阻断访问，防止你的数据因环境不安全而暴露。

### 📦 丢不了的“后悔药” (Multi-channel Backup)
*   支持 WebDAV、S3 云存储或 Telegram 机器人自动备份。即使手机丢了、系统重装了，甚至 Cloudflare 账号没了，你也能通过备份瞬间找回所有账号。

<details>
<summary>点击查看：同类型产品对比</summary>

| 功能特性 | **2FAuth Worker** (本项目) | Google / MS Auth | Authy | 2FAS / Aegis | 1Password / Bitwarden |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 数据所有权 | ✅ 完全掌控 (私有云/NAS) | ❌ 绑定大厂云端 | ❌ 锁定在厂商服务器 | ✅ 本地文件/私有云 | ⚠️ 托管在三方平台 |
| 多端访问 | ✅ 网页+PWA (全平台) | ⚠️ 仅手机 App | ❌ 桌面端已关停 | ⚠️ 仅手机 App | ✅ 全平台支持 |
| 恢复便利性 | ✅ 多通道自动备份 (TG/S3) | ⚠️ 换手机导入麻烦 | ✅ 云同步 | ⚠️ 需维护备份文件 | ✅ 云同步 |
| 隐私保护 | ✅ 匿名部署，无追踪 | ⚠️ 大厂账号绑定 | ⚠️ 强制绑定手机号 | ✅ 无追踪 | ✅ 安全但目标较大 |
| 离线可用性 | ✅ 支持 (PWA 强力缓存) | ✅ 支持 | ✅ 支持 | ✅ 支持 | ✅ 支持 |
| 部署成本 | ✅ 0 成本 (CF Serverless) | ✅ 免费 | ✅ 免费 | ✅ 免费 | 💰 订阅/自建较重 |
| 厂商倒闭风险 | ✅ 源码在手，永不丧失 | ⚠️ 生态强制迁移风险 | 🚨 随时下线(如 PC 端) | ✅ 开源可控 | ⚠️ 订阅制/闭源风险 |

> 🎯 **小结**：**2FAuth Worker** 既有 1Password 的多端便利，又有开源 App 的隐私性，更有 Serverless 的零成本。**支持 Telegram 机器人自动备份**更是解决了所有 Web 端和 App 端的“丢数据焦虑”，让安全触手可得。

</details>

---

## 🚀 部署指南 (三选一)

### 方式 A：一键部署到 Cloudflare Worker (最快，新手推荐)

这是最省心的方式，完全不需要自己的服务器，由 Cloudflare 免费为你托管。

#### 1. 一键全自动部署
1. Fork 本项目仓库，发财小手点`Star`! ⭐
2. 点击下方部署按钮 <br />
[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://dash.cloudflare.com/?to=/:account/workers-and-pages/create)

#### 2. 授权指引
*   在部署向导中，你需要授权 Cloudflare 读取该仓库。

<details>
<summary>点击查看：授权指引示意图</summary>  
<img height="200" src="https://github.com/user-attachments/assets/cb64bc2f-6dcc-40cb-a781-3bc2c7bc5b28" /><br/>
<img height="400" src="https://github.com/user-attachments/assets/3f186ea6-80f5-4d78-b90f-724af33a73ae" />
<img height="400" src="https://github.com/user-attachments/assets/c1f2d5ee-2f3f-47c2-969f-00308cadff21" />
</details>

#### 3. 部署流程
依次点击：Continue with GitHub -> 选择你 Fork 后的仓库（2fauth-worker）-> 下一步 -> 部署 -> 继续处理项目 -> 设置

<details>
<summary>点击查看：详细部署步骤示意图</summary>
<img height="400" src="https://github.com/user-attachments/assets/6a933580-98d5-4b09-ac1f-e2aa33380807" /><br />
<img height="400" src="https://github.com/user-attachments/assets/14e57427-0eac-4d20-8d9c-f8957803f247" /><br />
<img height="400" src="https://github.com/user-attachments/assets/b123a063-4671-4fc2-94fc-94b7a2d71235" /><br />
<img height="600" src="https://github.com/user-attachments/assets/c4be75c1-2732-4dfb-abaa-72384f482d4f" />
<img height="300" src="https://github.com/user-attachments/assets/ddce1191-353c-466d-a55c-044a1fcc47b4" />
</details>

#### 4. 在`设置`添加如下变量和机密
  *   `ENCRYPTION_KEY`：32位以上随机密钥。
  *   `JWT_SECRET`：32位以上随机JWT密钥。
  *   `OAUTH_ALLOWED_USERS`：你的邮箱@example.com
  *   `OAUTH_GITHUB_CLIENT_ID`：你的CLIENT_ID
  *   `OAUTH_GITHUB_CLIENT_SECRET`：你的CLIENT_SECRET
  *   `OAUTH_GITHUB_REDIRECT_URI`：你的回调地址

<details>
<summary>点击查看：添加变量和机密示意图</summary>
<img height="600" src="https://github.com/user-attachments/assets/51d6e702-142e-4f58-8f02-c4a0bbcf009c" />
</details>

---

### 方式 B：部署到 Docker (适合 NAS / 自有服务器用户)

如果你想把数据完全掌控在自己手里，或者需要在内网环境运行。

**⚠️ 核心安全须知**：为了提供最高级别的安全保障，本项目的 Docker 镜像严格遵循**非特权用户（Rootless）**运行标准（内部以 `node` 用户，UID 1000 运行），从而有效防止潜在的容器逃逸风险。
在运行容器前，你**必须**预先在宿主机创建目录并分配正确的权限，否则会出现 `Permission Denied` 报错。

#### 0. 准备数据目录 (必做)
在你想运行容器的目录下，执行以下命令：
```bash
mkdir -p data && sudo chown -R 1000:1000 data
```

#### 1. 使用 Docker Compose (推荐)

1. 在服务器上创建 `docker-compose.yml`：
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
      # 核心密钥
      - ENCRYPTION_KEY=32位以上随机密钥
      - JWT_SECRET=32位以上随机JWT密钥
      - OAUTH_ALLOWED_USERS=你的邮箱@example.com
      # 至少配置一种登录方式 (以 GitHub 为例)
      - OAUTH_GITHUB_CLIENT_ID=你的ID
      - OAUTH_GITHUB_CLIENT_SECRET=你的Secret
      - OAUTH_GITHUB_REDIRECT_URI=https://你的域名/oauth/callback
    restart: unless-stopped
```
2. 运行 `docker compose up -d` 即可。

#### 2. 使用 Docker Run
```bash
docker run -d --name 2fauth-worker \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e ENCRYPTION_KEY=32位以上随机密钥 \
  -e JWT_SECRET=32位以上随机JWT密钥 \
  -e OAUTH_ALLOWED_USERS=你的邮箱 \
  -e OAUTH_GITHUB_CLIENT_ID= \
  -e OAUTH_GITHUB_CLIENT_SECRET= \
  -e OAUTH_GITHUB_REDIRECT_URI=https://你的域名/oauth/callback \
  nap0o/2fauth-worker:latest
```

---

### 方式 C：通过 GitHub Actions 部署 (适合进阶用户)

如果你想对代码进行持续部署，或者更精确地管理数据库，建议使用此方式。

#### 1. 准备工作

*   在 `存储和数据库` -> `D1 SQL 数据库` 中创建一个名为 `2fauth-db` 的数据库，并记录其 **Database ID**。
<details>
<summary>点击查看：创建 D1 SQL 数据库的具体步骤</summary>
<img height="500" alt="image" src="https://github.com/user-attachments/assets/80824e1b-73f8-4d13-992c-a51dc4e53308" /><br />
<img height="350" alt="image" src="https://github.com/user-attachments/assets/560c9977-2f89-4135-839d-bdf37208bfdc" /><br />
<img height="350" alt="image" src="https://github.com/user-attachments/assets/25261345-8da6-40de-86b6-a23e910e737d" />
</details>


*   在 Cloudflare 控制面板获取 **API 令牌**（需要 `编辑 Cloudflare Workers` 权限）。
<details>
<summary>点击查看：获取 Cloudflare Worker 部署令牌的具体步骤</summary>

1. 登录 Cloudflare Dashboard
2. [前往获取](https://dash.cloudflare.com/profile/api-tokens)  https://dash.cloudflare.com/profile/api-tokens
3. 点击“创建令牌” 
4. 选择使用模版 “编辑 Cloudflare Workers”  
5. 配置“帐户资源”和“区域资源”
6. 依次点击“继续以显示摘要”，点击“创建令牌”
7. 复制生成的令牌

<img width="500"  alt="image" src="https://github.com/user-attachments/assets/6487aa6e-e505-4980-aef4-e08172116746" /><br />
<img width="800"  alt="image" src="https://github.com/user-attachments/assets/d4c737f7-2d9f-4cfb-a712-b1af416c8ef6" />
</details>

#### 2. 配置仓库
1.  **Fork** 本仓库到你的 GitHub 账号。
2.  前往仓库的 `Settings` -> `Secrets and variables` -> `Actions`。
3.  添加如下 Secrets：
  *   `CLOUDFLARE_ACCOUNT_ID`：你的 CF 账户 ID。
  *   `CLOUDFLARE_API_TOKEN`：刚刚生成的 API 令牌。
  *   `CLOUDFLARE_D1_DATABASE_ID`：D1 数据库的 ID。
  *   `CLOUDFLARE_D1_DATABASE_NAME`：D1 数据库的名称。
  *   `ENCRYPTION_KEY`：32位以上随机密钥。
  *   `JWT_SECRET`：32位以上随机JWT密钥。
  *   `OAUTH_ALLOWED_USERS`：你的邮箱@example.com
  *   `OAUTH_GITHUB_CLIENT_ID`：你的ID
  *   `OAUTH_GITHUB_CLIENT_SECRET`：你的Secret
  *   `OAUTH_GITHUB_REDIRECT_URI`：你的回调地址

<details>
<summary>点击查看：Secrets 配置示例图</summary>  
<img width="600" alt="Secrets 配置示例" src="https://github.com/user-attachments/assets/ef907021-303d-4fd5-ba3e-913e8b0014a5" />
</details>

#### 3. 触发部署
*   前往仓库的 `Actions` 页面，手动运行 `Deploy to Cloudflare Workers` 工作流，或向 `main` 分支推送代码即可。

<details>
<summary>点击查看：手动触发部署示例图</summary>  
<img width="600" alt="手动触发部署" src="https://github.com/user-attachments/assets/b2891365-5c1a-4a46-83c6-5cd53dd4b895" />
</details>

---

## 🧩 关键环境变量配置

不论使用哪种方式部署，以下参数都非常重要：

| 变量名 | 作用 | 获取建议 |
| :--- | :--- | :--- |
| `ENCRYPTION_KEY` | **核心：** 数据库加密密钥 | 设好后**绝对不要改**！改了旧数据就解不开了。要求：32 位以上随机字符。 |
| `JWT_SECRET` | 登录状态密钥 | 要求：32 位以上随机字符。 |
| `OAUTH_ALLOWED_USERS` | **白名单：** 只有谁能进 | 填你的邮箱或 Telegram 数字 ID，多个用逗号隔开。 |


### 依据你选取的登录平台，在环境变量中填入对应参数（任选其一即可）：

| 平台 | Client ID 变量名 | Client Secret 变量名 | Redirect URI 回调变量名 (示例: `https://xxx.dev/oauth/callback`) |
| :--- | :--- | :--- | :--- |
| **GitHub** | `OAUTH_GITHUB_CLIENT_ID` | `OAUTH_GITHUB_CLIENT_SECRET` | `OAUTH_GITHUB_REDIRECT_URI` |
| **Telegram** | `OAUTH_TELEGRAM_BOT_NAME` | `OAUTH_TELEGRAM_BOT_TOKEN` | *Telegram 无需 URI 回调变量* |
| **Google** | `OAUTH_GOOGLE_CLIENT_ID` | `OAUTH_GOOGLE_CLIENT_SECRET` | `OAUTH_GOOGLE_REDIRECT_URI` |
| **Cloudflare Access** | `OAUTH_CLOUDFLARE_CLIENT_ID` | `OAUTH_CLOUDFLARE_CLIENT_SECRET` | `OAUTH_CLOUDFLARE_REDIRECT_URI` (需配置 `OAUTH_CLOUDFLARE_ORG_DOMAIN`) |
| **Gitee** | `OAUTH_GITEE_CLIENT_ID` | `OAUTH_GITEE_CLIENT_SECRET` | `OAUTH_GITEE_REDIRECT_URI` |
| **NodeLoc** | `OAUTH_NODELOC_CLIENT_ID` | `OAUTH_NODELOC_CLIENT_SECRET` | `OAUTH_NODELOC_REDIRECT_URI` |

---

#### 如何配置Github第三方登录（推荐）
1. 访问 GitHub `Settings` -> `Developer Settings` -> `OAuth Apps` -> **New OAuth App**。
2. 回调地址 (Callback URL) 必须填写：`https://你的域名/oauth/callback`。
3. 将 `Client ID`  `Client Secret` 和 `OAUTH_GITHUB_REDIRECT_URI` 填入环境变量。

<details>
<summary>点击查看：Github OAuth 配置示意图</summary>
<img width="600" alt="Github OAuth 配置示意" src="https://github.com/user-attachments/assets/aa03b15f-deb2-4e48-bf4b-e57be342adbb" />
</details>

#### 如何配置Telegram第三方登录
1. 在 Telegram 搜索并添加官方机器人 **[@BotFather](https://t.me/BotFather)**，按照提示创建机器人。
2. 记录生成的 **Token** (`OAUTH_TELEGRAM_BOT_TOKEN`) 和 **用户名** (`OAUTH_TELEGRAM_BOT_NAME`)。
3. 请务必向 @BotFather 发送 `/setdomain` 指令，选择您的机器人，并输入您的**应用域名**（不需要 `https://`）。
4. 由于本项目是 Serverless 架构，您需要手动注册 Webhook。<br/>
   将下方链接中的 `<Token>` 和 `<域名>` 替换后，在浏览器中访问一次：<br/>
   `https://api.telegram.org/bot<Token>/setWebhook?url=https://<域名>/api/telegram/webhook`

5. 将 `OAUTH_TELEGRAM_BOT_TOKEN`、`OAUTH_TELEGRAM_BOT_NAME` 填入环境变量。

#### 如何配置Cloudflared Access 第三方登录
1.  进入 **Cloudflare Zero Trust Dashboard** -> **Access** -> **Applications**。
2.  创建一个 **SaaS** 应用 (Select "SaaS")。
3.  配置 **Application**:
    - **应用程序**:  `输入任意名称都行，如 2fauth`
    - **选择身份验证协议**: `OIDC`
    - **重定向 URL**: `https://你的域名/oauth/callback`
4.  复制保存关键信息备用， `客户端 ID` 和 `客户端密码`。
5.  Access 策略 -> 点击创建新策略 -> 添加策略
    - **策略**: `Allow`
    - **选择**：`Everyone`
6.  其余均不需要额外配置，一直下一步到完成
7.  将 `OAUTH_CLOUDFLARE_CLIENT_ID`、`OAUTH_CLOUDFLARE_CLIENT_SECRET`、 `OAUTH_CLOUDFLARE_REDIRECT_URI` 和 `OAUTH_CLOUDFLARE_ORG_DOMAIN` 填入环境变量。

<details>
<summary>点击查看：Cloudflare Access OAuth 配置示意图</summary>
<img height="500" src="https://github.com/user-attachments/assets/1e315f8f-1932-4c90-a2d7-0edf8049529f" />
<img height="400" src="https://github.com/user-attachments/assets/c6101ee8-f3c3-44f6-9286-f17865f8fb10" />
</details>

---

## 🔒 深度安全审计 (Security Auditing)

为了保护您的账号安全，2FAuth Worker 在设计上采取了“多重锁死”策略：

1.  **静态数据全加密**：数据库中存储的所有 TOTP 密钥种子（Secret）都经过 AES 高强度加密。即使数据库文件不幸泄露，黑客在没有 `ENCRYPTION_KEY` 的情况下也无法获得原始密钥。
2.  **访问白名单制度**：系统拒绝任何通过用户名/密码的传统注册。只有在 `OAUTH_ALLOWED_USERS` 配置列表中的用户才能进入系统，拒绝任何陌生人蹭用。
3.  **智能环境感知 (Smart Shield)**：系统在启动和运行时会持续检查运行环境（如环境变量是否存在、数据库是否异常）。一旦发现异常，系统将拒绝生成任何验证码并进入保护模式。
4.  **端到端隔离**：前端生成的敏感操作逻辑经过严格过滤，严禁任何 XSS (跨站脚本) 攻击。
5.  **隐私第一**：本项目不包含任何追踪代码、分析工具或第三方统计插件。你的数据只属于你。

> 📊 [**点击查看由 GitHub Actions 自动生成的安全审计报告**](https://github.com/nap0o/2fauth-worker/blob/security-audit/README.md)

---

## 🛠️ 参与开发 (Local Development)

```bash
# 1. 克隆并安装依赖
git clone https://github.com/nap0o/2fauth-worker.git
cd 2fauth-worker
npm install

# 2.复制 example.dev.vars 为 .dev.vars, 按说明写入开发用的测试密钥
cp example.dev.vars .dev.vars

# 3. 初始化本地的 SQLite Sandbox 数据库
npx wrangler d1 execute 2fauth-db-dev --local --env dev --file=backend/schema.sql

# 4. 运行本地开发
npm run dev
```

---

## 📄 开源协议
本项目基于 [GNU AGPL v3](LICENSE) 协议开源。作为一款涉及 2FA 安全与网络服务的软件，我们坚持维护开源社区的公平性：如果您在服务器上运行本项目的修改版本并向公众提供服务，您必须向用户开放您的源代码。
