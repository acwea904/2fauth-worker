
# 2FAuth Worker

**基于 Cloudflare Workers + D1 的新型 Serverless 二步验证 (2FA/TOTP) 管理器**

[![Deploy to Cloudflare Workers](https://github.com/nap0o/2fauth-worker/actions/workflows/deploy.yml/badge.svg)](https://github.com/nap0o/2fauth-worker/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Vue3](https://img.shields.io/badge/Vue.js-3.x-4FC08D?style=flat&logo=vue.js)](https://vuejs.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat&logo=cloudflare)](https://workers.cloudflare.com/)


[**Demo演示**](https://2fa.nezha.pp.ua)  https://2fa.nezha.pp.ua

- 演示站配置了 `OAUTH_ALLOW_ALL=true`变量, 默认允许任何用户登录,正常部署切记 **不要配置OAUTH_ALLOW_ALL变量** | **不要配置OAUTH_ALLOW_ALL变量** | **不要配置OAUTH_ALLOW_ALL变量**
- 演示站数据可以任意修改、删除

---

**2FAuth Worker** 是一个轻量级、安全、无服务器的 TOTP 二步验证管理工具。它让你完全掌控自己的 2FA 数据，支持多端跨平台使用，无需购买任何服务器，**完全免费部署在 Cloudflare 边缘网络上**。

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
- **WebDAV / S3 自动备份**：连接你的Nextcloud、阿里云 OSS 或 AWS S3。
- 自动化定时任务（Cron Triggers）实现无感数据双重灾备。

---

## 🏗️ 全栈项目架构

本项目遵循现代化的 **Feature-based 垂直模块化架构**：

- **Frontend (Vue 3 + Vite)**：完全模块化，包含 `vault` (账户管理), `backup` (云端灾备), `auth` (身份验证), `tools` (工具箱) 等独立领域模块。状态管理由 Pinia 驱动。
- **Backend (Hono.js)**：极其轻量的边缘框架。配合 `Drizzle ORM` 丝滑读写 D1 数据库。
- **前后端天然一体**：由单代码库 (Monorepo) 管理，GitHub Actions 一次触发，同时构建前端产物并以 `Asset/SPA` 模式挂载至 Worker。

---

## 🚀 极速部署指南

本项目设计为通过 **GitHub Actions** 自动化一键部署到你的 Cloudflare 账号下。只需几分钟即可获得你专属的 2FA 管理器。

### 第一步：准备工作
1. 注册一个 [Cloudflare](https://dash.cloudflare.com/) 账号。
2. **Fork** 本仓库到你的 GitHub 账户。

### 第二步：配置 Cloudflare D1 数据库
1. 登录 Cloudflare Dashboard。
2. 依次点击左侧菜单的 **存储和数据库** -> **D1 SQL 数据库**。
3. 点击 **创建数据库**，命名为 `2fauth-db` (或自定义名称)。
4. 创建成功后，复制数据库详情页提供的 **`Database ID`**，备用。

### 第三步：配置第三方登录
*注：系统支持 6 种登录方式，你**至少需要配置一种***。

#### 方案一：使用 GitHub 登录
1. 访问 GitHub `Settings` -> `Developer Settings` -> `OAuth Apps` -> **New OAuth App**。
2. 填写应用信息：
   - **名称**: `2FAuth`
   - **Homepage URL**: 填入你预期的站点域名，例如 `https://2fa.yourdomain.workers.dev` (部署后可绑定自定义域名)
   - **Authorization callback URL**: 重点！必须填写 `https://<你的域名>/oauth/callback`
3. 保存生成的 **`Client ID`** 和 **`Client Secret`**。

#### 方案二：使用 Telegram 登录
1. 在 Telegram 中搜索并添加官方机器人 **[@BotFather](https://t.me/BotFather)**。
2. 发送 `/newbot` 指令，按照提示为你的 2FAuth 创建一个机器人，并获取它的 **`Bot Token`**（如 `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`）。
3. 获取机器人的 **`Bot Name`**（就是你刚才设置的以 `bot` 结尾的用户名，例如 `my_2fa_bot`）
4. （非常重要）发送 `/setdomain` 指令，选择你刚才创建的机器人，然后发送你的应用域名（不需要 `https://`，例如：`2fa.yourdomain.workers.dev`）。
5. （非常重要）配置 Webhook
```bash
curl "https://api.telegram.org/bot<你的BotToken>/setWebhook?url=https://<你设置的setdomain>/api/telegram/webhook"
```

### 第四步：配置 GitHub Actions Secrets
前往你 Fork 的 GitHub 仓库的 **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**，添加以下必填环境变量：

#### ☁️ 必填：Cloudflare 资源授权
| Secret Name | 说明 | 示例值 |
| :--- | :--- | :--- |
| `CLOUDFLARE_ACCOUNT_ID` | 你的 CF 账户 ID | `a1b2c3d4e5f6g7h8i9j0` (CF 面板的概述页右下角) |
| `CLOUDFLARE_API_TOKEN` | CF 部署令牌 [前往获取](https://dash.cloudflare.com/profile/api-tokens) <br> 点击“创建令牌” -> “创建自定义令牌”   <br/> 权限 1: **账户** -> **D1** -> **编辑**  <br/>权限 2: **账户** -> **Workers 脚本** -> **编辑** | `r4_xyz...` |
| `CLOUDFLARE_D1_DATABASE_ID` | D1 数据库 ID | xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |

#### 🔐 必填：系统安全参数

> ⚠️ **高危警告：关于 ENCRYPTION_KEY 的修改风险**
> `ENCRYPTION_KEY` 是用于加密数据库中 2FA 核心令牌种子的底层主密钥。**一旦系统投入生产使用并存入了数据，请绝对不要修改此环境变量的值！** 修改后将导致之前存入的所有数据瞬间无法解密，彻底变成死数据。

| Secret Name | 说明 | 示例值 |
| :--- | :--- | :--- |
| `OAUTH_ALLOWED_USERS` | 允许登录的账户白名单 | `me@example.com,github_user` (逗号分隔) |
| `OAUTH_ALLOW_ALL` | 无视白名单放行所有人（**仅限测试**） | `true` 或 `1` (生产环境切勿配置) |
| `JWT_SECRET` | 签发会话状态的系统密钥 | 越长越好, 建议 32 位随机字符 |
| `ENCRYPTION_KEY` | 对数据库持久化2FA核心密码集的唯一底层加密密钥 | **必填**。建议使用 `openssl rand -hex 32` 生成|

#### 🔑 必填：Cloudflare D1数据库参数

| Secret Name | 说明 | 示例值 |
| :--- | :--- | :--- |
| `CLOUDFLARE_D1_DATABASE_ID` | Cloudflare D1 数据库 ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `CLOUDFLARE_D1_DATABASE_NAME` | Cloudflare D1 数据库名称 | 默认为 `2fauth-db` |

#### 🔑 必填：OAuth 身份信息 (按需选择对应的组合)
> 如果你用 GitHub 登录，就填下面三个；如果你用 Google，就填 Google 的那三个。

| 平台 | Client ID 变量组 (示例) | Client Secret 变量组 (示例) | Redirect URI 变量组 (示例) |
| :--- | :--- | :--- | :--- |
| **GitHub** | `OAUTH_GITHUB_CLIENT_ID`<br>`Ov23...` | `OAUTH_GITHUB_CLIENT_SECRET`<br>`a1b2...` | `OAUTH_GITHUB_REDIRECT_URI`<br>`https://xxx.workers.dev/oauth/callback` |
| **Telegram** | `OAUTH_TELEGRAM_BOT_NAME`<br>`my_2fa_bot` | `OAUTH_TELEGRAM_BOT_TOKEN`<br>`123:ABC...` | *Telegram 无需 URI 变量* |
| **Google** | `OAUTH_GOOGLE_CLIENT_ID`<br>`123...apps.googleusercontent.com` | `OAUTH_GOOGLE_CLIENT_SECRET`<br>`GOCSPX-...` | `OAUTH_GOOGLE_REDIRECT_URI`<br>`https://xxx.workers.dev/oauth/callback` |
| **Cloudflare Access** | `OAUTH_CLOUDFLARE_CLIENT_ID`<br>`abc.access` | `OAUTH_CLOUDFLARE_CLIENT_SECRET`<br>`def...` | `OAUTH_CLOUDFLARE_REDIRECT_URI`<br>`https://xxx.workers.dev/oauth/callback`<br>*(该平台还需配置 `OAUTH_CLOUDFLARE_ORG_DOMAIN`，如: `https://<team>.cloudflareaccess.com`)* |
| **Gitee** | `OAUTH_GITEE_CLIENT_ID`<br>`bcd...` | `OAUTH_GITEE_CLIENT_SECRET`<br>`efg...` | `OAUTH_GITEE_REDIRECT_URI`<br>`https://xxx.workers.dev/oauth/callback` |
| **NodeLoc** | `OAUTH_NODELOC_CLIENT_ID`<br>`cde...` | `OAUTH_NODELOC_CLIENT_SECRET`<br>`fgh...` | `OAUTH_NODELOC_REDIRECT_URI`<br>`https://xxx.workers.dev/oauth/callback` |

### 第五步：触发自动化部署
1. 进入你的 GitHub 仓库的 **Actions** 页面。
2. 找到 `Deploy to Cloudflare Workers` 工作流。
3. 点击 **Run workflow** 手动触发执行（或者随便 Push 一下 main 分支）。
4. **喝杯咖啡 ☕，等待自动化脚本完成：**
   - 📦 自动构建 Vue 3 SPA 前端。
   - 🗄️ 自动帮你初始化部署 D1 数据库内的表结构（Schema）。
   - ⚡ 自动将带有静态前端的后端服务绑定至 Cloudflare 边缘节点。
5. 部署成功后，控制台会输出你的 `xxx.workers.dev` 链接。登录进去，开始你的私有化 2FA 之旅！

---

## 💻 本地极客开发 (Local Development)

如果你想自己修改 UI 或增加功能，可以很方便地在本地把跑起来（需要 Node.js 20+）：

```bash
git clone https://github.com/nap0o/2fauth-worker.git
cd 2fauth-worker

# 1. 给前后端分别安装依赖
cd frontend && npm install
cd ../backend && npm install

# 2. 在 backend 目录,修改 example.dev.vars 为 .dev.vars, 按说明写入开发用的测试密钥

# 3. 初始化本地的 SQLite Sandbox 数据库
cd backend
npx wrangler d1 execute 2fauth-db-dev --local --env dev --file=schema.sql

# 4. 终端启动应用
```bash
cd backend && npm run dev
```

---

## 🛡️ 安全性声明 (Security Policy)

本项目涉及高度敏感的 2FA 认证种子数据的云端存储，在架构安全方面我们做出了如下强制约束：

1. **密钥隔离设计**：`JWT_SECRET` (用于签发 Session/Device Token) 与 `ENCRYPTION_KEY` (用于静态加密数据库的核心密码) 必须从 Cloudflare 环境变量层面强制分离，不要设置相同变量值。任何 `ENCRYPTION_KEY` 缺失导致的系统空缺都会被高危拦截拒绝启动，从而遏制降级攻击。
2. **零容忍 XSS (跨站脚本) 防御策略**：本项目的前端严格禁止任何未经深度转义的动态 HTML（`v-html` 或等效方法）直接上树。任何第三方代码引入必须经过人工审计。

遇到任何安全性相关的 Issue，请在提交时标记为 [Security] 以获得最高优的处理优先级。

---

## 📄 License
本项目基于 [MIT License](LICENSE) 协议完全开源。你可以自由地二次开发、分发或商业使用，只要包含原作者和版权声明即可。