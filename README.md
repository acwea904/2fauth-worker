
# 2FAuth Worker

**基于 Cloudflare Workers + D1 的新型 Serverless 二步验证 (2FA/TOTP) 管理器**

[![Deploy to Cloudflare Workers](https://github.com/nap0o/2fauth-worker/actions/workflows/deploy.yml/badge.svg)](https://github.com/nap0o/2fauth-worker/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Vue3](https://img.shields.io/badge/Vue.js-3.x-4FC08D?style=flat&logo=vue.js)](https://vuejs.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat&logo=cloudflare)](https://workers.cloudflare.com/)


[**Demo演示**](https://2fa.nezha.pp.ua)  https://2fa.nezha.pp.ua

- 演示站配置了 `OAUTH_ALLOW_ALL=true`变量, 默认允许任何用户登录,正常部署切记 **不要主动配置OAUTH_ALLOW_ALL变量** | **不要主动配置OAUTH_ALLOW_ALL变量** | **不要主动配置OAUTH_ALLOW_ALL变量**
- 演示站数据可以任意修改、删除

---

**2FAuth Worker** 是一个安全、轻量级、无服务器的 TOTP 二步验证管理工具。它让你完全掌控自己的 2FA 数据，支持多端跨平台使用，无需购买任何服务器，**完全免费部署在 Cloudflare 边缘网络上**。

## ✨ 核心优势与功能

### 🌩️ 真正的 Serverless 架构
- **零成本运维**：由 Cloudflare Workers 处理后端逻辑，Cloudflare D1 (SQLite) 存储数据，完全抛弃传统服务器。
- **全球边缘加速**：应用直接运行在 Cloudflare 全球数百个数据中心，极速响应。

### 📱 渐进式 Web 应用 (PWA) 
- **安装如原生应用**：完美支持 PWA，你可以将 2FAuth 直接安装到电脑桌面或手机主屏幕，享受无浏览器边框的沉浸沉浸式极致体验。
- **真正的离线可用**：支持基于 Service Worker 的深度离线缓存，即使在**断网、无信号**的极端环境下，应用依然能秒开并为你生成准确无误的动态验证码。

### 🔐 极简却强大的身份验证
- 抛弃传统的账密注册，全面拥抱 **OAuth 2.0 第三方登录**。
- 支持对接：**GitHub, Google, Telegram, Cloudflare Access (Zero Trust), Gitee, NodeLoc**。
- 支持基于邮箱/用户名的**硬核白名单控制**，谢绝任何陌生人访问你的 2FA 数据库。

### 🛡️ 固若金汤的数据安全
- **私有数据库**：你的验证器密钥永远只存在于你的私有 D1 数据库中。
- **高强度加密存储**：数据库中的 TOTP Secret 强制进行 AES 加密存储。
- **加密导出**：支持标准 JSON、2FAS 以及采用 AES-GCM 高强度加密打包的定制导出格式。

### 🧰 全能的实用工具箱
除了 2FA 管理外，系统原生内置了多款高频安全工具：
- 🔑 **高强度密码生成器**
- ⏳ **时间校准器** (精准检测并解决 TOTP 失效的时钟偏移问题)
- 📷 **二维码解析提取器**
- 🛡️ **TOTP 密钥分析与生成工具**

### 🔄 企业级数据灾备
- **WebDAV / S3 / Telegram 自动备份**：连接你的Nextcloud、阿里云 OSS 或 AWS S3，或者 Telegram Bot。
- 自动化定时任务（Cron Triggers）实现无感数据双重灾备。

---

## 🚀 详细部署指南

本项目支持 2 种部署方式：**一键部署到 Cloudflare Workers** 和 **通过 GitHub Actions 部署**。请根据你的需要选择其中一种即可。

---

### 方式一：一键部署到 Cloudflare Workers（推荐，新手友好）

这是最简便的部署方式，只需点击下方按钮，按照页面向导提示操作即可快速上线。

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/nap0o/2fauth-worker)

**部署说明：**

1. 在部署之前，建议你先准备好你打算使用的**第三方登录（OAuth）配置**，例如 GitHub 的 Client ID / Secret（详见下文：[获取第三方登录密钥](#2-配置第三方登录)）。
2. Fork 本仓库
2. 点击上方的 **Deploy to Cloudflare Workers** 按钮进入 Cloudflare 部署向导。
3. 根据向导提示，授权 Cloudflare 读取该仓库（系统会自动在你的 GitHub 账号下创建一个该项目的私有克隆）。

**授权 Cloudflare 读取 Github 仓库 步骤：**

<img height="400" alt="0001" src="https://github.com/user-attachments/assets/cb64bc2f-6dcc-40cb-a781-3bc2c7bc5b28" />
<img  height="500" alt="0002" src="https://github.com/user-attachments/assets/3f186ea6-80f5-4d78-b90f-724af33a73ae" />
<img  height="500" alt="0003" src="https://github.com/user-attachments/assets/c1f2d5ee-2f3f-47c2-969f-00308cadff21" />

4. 点击`创建和部署`，完成部署！
5. 访问专属的 `xxx.workers.dev` 域名，按照页面提示完成初始化配置。

---

### 方式二：通过 GitHub Actions 自动化部署（适合高级用户）

如果你需要更深入定制或打算持续集成，可以选择原生的 GitHub Actions 自动部署流程。

#### 1. 准备工作
1. 注册一个 [Cloudflare](https://dash.cloudflare.com/) 账号。
2. **Fork** 本仓库到你的 GitHub 账户。

#### 2. 获取 Cloudflare Worker部署令牌
1. 登录 Cloudflare Dashboard
2. [前往获取](https://dash.cloudflare.com/profile/api-tokens)  https://dash.cloudflare.com/profile/api-tokens
3. 点击“创建令牌” 
4. 选择使用模版 “编辑 Cloudflare Workers”  
5. 配置“帐户资源”和“区域资源”
6. 依次点击“继续以显示摘要”，点击“创建令牌”
7. 复制生成的令牌

<img width="500"  alt="image" src="https://github.com/user-attachments/assets/6487aa6e-e505-4980-aef4-e08172116746" /><br />

<img width="800"  alt="image" src="https://github.com/user-attachments/assets/d4c737f7-2d9f-4cfb-a712-b1af416c8ef6" />

#### 3. 配置 Cloudflare D1 数据库
1. 登录 Cloudflare Dashboard。
2. 依次点击左侧菜单的 **存储和数据库** -> **D1 SQL 数据库**。
3. 点击 **创建数据库**，命名为 `2fauth-db` (或自定义名称)。
4. 创建成功后，复制数据库详情页提供的 **`Database ID`**，备用。

#### 4. 配置 GitHub Actions Secrets
前往你 Fork 仓库的 **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**，添加下列关键参数：

- **基础平台令牌必填：**
  - `CLOUDFLARE_ACCOUNT_ID`：你的 CF 账户 ID (CF 面板的概述页右下角可以找到)
  - `CLOUDFLARE_API_TOKEN`：刚刚在“步骤 2”获取的部署令牌
  - `CLOUDFLARE_D1_DATABASE_ID`：刚刚在“步骤 3”获取的 D1 数据库 ID
  - `CLOUDFLARE_D1_DATABASE_NAME`：默认为 `2fauth-db`
- **系统安全与 OAuth 登录密钥：**
  - `ENCRYPTION_KEY`、`JWT_SECRET` 及你要使用的 OAuth 登录配置，请统一查阅下方的 **[🧩 通用环境变量配置说明](#-通用环境变量配置说明)** 进行添加。

#### 5. 触发自动化部署
1. 进入你的 GitHub 仓库的 **Actions** 页面。
2. 找到 `Deploy to Cloudflare Workers` 工作流。
3. 点击 **Run workflow** 手动触发执行（或者随便 Push 一下 main 分支）。
4. 等待自动化脚本完成，部署成功后，控制台会输出你的 `xxx.workers.dev` 访问链接。
6. 访问专属的 `xxx.workers.dev` 域名，按照页面提示完成初始化配置。

**手动触发deploy**

<img width="800" height="1350" alt="image" src="https://github.com/user-attachments/assets/b2891365-5c1a-4a46-83c6-5cd53dd4b895" />

**配置Secrets and variables示例**

<img width="800"  alt="image" src="https://github.com/user-attachments/assets/ef907021-303d-4fd5-ba3e-913e8b0014a5" />

---

### 🧩 通用环境变量配置说明

以下环境变量，不论是通过 **"方案一:一键部署"** 还是 **"方案二:GitHub Actions"**，都需要在Worker设置页面或仓库 Secrets 中按需配置：

#### 1. 核心安全参数（必填！）

> ⚠️ **高危警告：关于 ENCRYPTION_KEY 的修改风险**
> `ENCRYPTION_KEY` 是用于加密数据库中 2FA 核心令牌种子的底层主密钥。**一旦系统投入生产使用并存入数据，请绝对不要再修改此环境变量的值！** 如果该密钥丢失或更改，数据库里旧的数据将无法解密！

| 变量 / Secret Name | 说明 | 示例值 |
| :--- | :--- | :--- |
| `ENCRYPTION_KEY` | 对数据库持久化2FA核心密种加密的主密钥 | **必填**。建议使用 `openssl rand -hex 32` 生成，务必自己保存好备份。 |
| `JWT_SECRET` | 签发安全会话状态的系统密钥 | **必填**。越长越好, 建议输入 32 位随机字符。 |
| `OAUTH_ALLOWED_USERS` | 允许登录系统的白名单：支持填入邮箱，或 Telegram数字ID | **必填**。`me@example.com,you@example.com,5341743823` (多个配置必须用逗号分隔) |

#### 2. 配置第三方登录
*系统支持多种登录方式，你**至少需要选择一种进行环境配置***。我们最推荐使用 `GitHub` 作为后台登录。

**使用 GitHub 登录获取办法**
1. 访问 GitHub `Settings` -> `Developer Settings` -> `OAuth Apps` -> **New OAuth App**。
2. 填写应用信息：
   - **名称**: `2FAuth Worker`
   - **Homepage URL**: 填入你预期的站点域名，例如 `https://2fa.yourdomain.workers.dev` (部署后可绑定自定义域名)
   - **Authorization callback URL**: 必须填写 `https://<你的Homepage URL>/oauth/callback`
3. 保存并复制生成的 **`Client ID`** 和 **`Client Secret`**。

<img width="800"  alt="image" src="https://github.com/user-attachments/assets/aa03b15f-deb2-4e48-bf4b-e57be342adbb" />

**使用 Telegram 登录获取办法**
1. 在 Telegram 中搜索并添加官方机器人 **[@BotFather](https://t.me/BotFather)**。
2. 发送 `/newbot` 指令，按照提示为你的 2FAuth 创建机器人，记录它的 **`Bot Token`**（如 `123456:ABC-DEF1234...`）。
3. 记录机器人的 **`Bot Name`**（也就是你刚设置的以 bot 结尾的用户名，例如 `my_2fa_bot`）
4. （非常重要）发送 `/setdomain` 指令，选择此机器人，然后发送你的应用域名（不需要 `https://`，例如：`2fa.yourdomain.workers.dev`）。
5. （非常重要）由于我们要使用无服务器直接验证，需要配置 Webhook，复制下方链接在浏览器中访问一次注册 Webhook：
```url
https://api.telegram.org/bot<你的BotToken>/setWebhook?url=https://<你的应用域名>/api/telegram/webhook
```

**依据你选取的登录平台填入所需变量（任选一对即可）：**

> 如果你使用 GitHub 登录，就在环境变量里配置 GitHub 那一行提供的所有变量选项。其它平台类似。

| 平台 | Client ID 变量群 | Client Secret 变量群 | Redirect URI 回调变量群 (示例:`https://xxx.dev/oauth/callback`) |
| :--- | :--- | :--- | :--- |
| **GitHub** | `OAUTH_GITHUB_CLIENT_ID` | `OAUTH_GITHUB_CLIENT_SECRET` | `OAUTH_GITHUB_REDIRECT_URI` |
| **Telegram** | `OAUTH_TELEGRAM_BOT_NAME`*(填你的Bot名称)* | `OAUTH_TELEGRAM_BOT_TOKEN`*(填Bot的Token密钥)* | *Telegram 无需 URI 回调变量* |
| **Google** | `OAUTH_GOOGLE_CLIENT_ID` | `OAUTH_GOOGLE_CLIENT_SECRET` | `OAUTH_GOOGLE_REDIRECT_URI` |
| **Cloudflare Access** | `OAUTH_CLOUDFLARE_CLIENT_ID` | `OAUTH_CLOUDFLARE_CLIENT_SECRET` | `OAUTH_CLOUDFLARE_REDIRECT_URI`<br>*(该平台还缺一不可：需额外配置 `OAUTH_CLOUDFLARE_ORG_DOMAIN`，如: `https://<team>.cloudflareaccess.com`)* |
| **Gitee** | `OAUTH_GITEE_CLIENT_ID` | `OAUTH_GITEE_CLIENT_SECRET` | `OAUTH_GITEE_REDIRECT_URI` |
| **NodeLoc** | `OAUTH_NODELOC_CLIENT_ID` | `OAUTH_NODELOC_CLIENT_SECRET` | `OAUTH_NODELOC_REDIRECT_URI` |


---

## 💻 本地极客开发 (Local Development)

如果你想自己修改 UI 或增加功能，可以很方便地在本地把跑起来（需要 Node.js 20+）：

```bash
git clone https://github.com/nap0o/2fauth-worker.git
cd 2fauth-worker

# 1. 给前后端分别安装依赖
npm install

# 2.复制 example.dev.vars 为 .dev.vars, 按说明写入开发用的测试密钥
cp example.dev.vars .dev.vars

# 3. 初始化本地的 SQLite Sandbox 数据库
npx wrangler d1 execute 2fauth-db-dev --local --env dev --file=backend/schema.sql

# 4. 终端启动应用
npm run dev
```

---

## 🏗️ 全栈项目架构

本项目遵循现代化的 **Feature-based 垂直模块化架构**：

- **Frontend (Vue 3 + Vite)**：完全模块化，包含 `vault` (账户管理), `backup` (云端灾备), `auth` (身份验证), `tools` (工具箱) 等独立领域模块。状态管理由 Pinia 驱动。
- **Backend (Hono.js)**：极其轻量的边缘框架。配合 `Drizzle ORM` 丝滑读写 D1 数据库。
- **前后端天然一体**：由单代码库 (Monorepo) 管理，GitHub Actions 一次触发，同时构建前端产物并以 `Asset/SPA` 模式挂载至 Worker。

---

## 🛡️ 安全性声明 (Security Policy)

本项目涉及高度敏感的 2FA 认证种子数据的云端存储，在架构安全方面我们做出了如下强制约束：

1. **密钥隔离设计**：`JWT_SECRET` (用于签发 Session/Device Token) 与 `ENCRYPTION_KEY` (用于静态加密数据库的核心密码) 必须从 Cloudflare 环境变量层面强制分离，不要设置相同变量值。任何 `ENCRYPTION_KEY` 缺失导致的系统空缺都会被高危拦截拒绝启动，从而遏制降级攻击。
2. **零容忍 XSS (跨站脚本) 防御策略**：本项目的前端严格禁止任何未经深度转义的动态 HTML（`v-html` 或等效方法）直接上树。任何第三方代码引入必须经过人工审计。

遇到任何安全性相关的 Issue，请在提交时标记为 [Security] 以获得最高优的处理优先级。

---

## 📄 License
本项目基于 [MIT License](LICENSE) 协议完全开源。你可以自由地二次开发、分发或商业使用，只要包含原作者和版权声明即可。