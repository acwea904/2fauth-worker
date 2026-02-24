import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { EnvBindings } from './config';

// 稍后我们会在这里引入拆分好的路由模块
import authRoutes from './routes/auth';
import accountsRoutes from './routes/accounts';
import backupRoutes, { handleScheduledBackup } from './routes/backups';

// 扩展 EnvBindings 以包含 ASSETS (Cloudflare Pages/Workers Assets)
type Bindings = EnvBindings & { ASSETS: { fetch: (req: Request) => Promise<Response> } };

// 初始化 Hono 应用，并绑定 Cloudflare 的环境变量类型
const app = new Hono<{ Bindings: Bindings }>();

// 1. 全局中间件
app.use('*', logger()); // 自动打印请求日志
app.use('/api/*', cors({
    origin: '*', // 开发环境允许跨域，生产环境可配置具体域名
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE'],
    maxAge: 86400,
}));

// 2. 健康检查接口 (用于测试后端是否正常启动)
app.get('/api', (c) => c.text('🔐 2FA Secure Manager API is running!'));

// 3. 挂载子路由
app.route('/api/oauth', authRoutes);
app.route('/api/accounts', accountsRoutes);
app.route('/api/backups', backupRoutes);

// 4. 全局错误处理
app.onError((err, c) => {
    const statusCode = (err as any).statusCode || (err as any).status || 500;

    // 特殊处理: WebDAV list 接口如果返回 404，说明目录不存在，视为无备份，返回空列表
    if (c.req.path.includes('/files') && (Number(statusCode) === 404 || err.message.includes('404'))) {
        return c.json({ success: true, backups: [] });
    }

    console.error(`[Server Error] ${err.message}`);
    return c.json({
        success: false,
        error: err.message || 'Internal Server Error'
    }, statusCode);
});

// 5. 404 处理
app.notFound((c) => {
    return c.json({ success: false, error: 'API Not Found' }, 404);
});

// 6. 导出默认处理函数，实现前后端路由分发
export default {
    async fetch(request: Request, env: Bindings, ctx: any) {
        const url = new URL(request.url);

        // 识别 API 请求前缀
        if (url.pathname.startsWith('/api')) {
            return app.fetch(request, env, ctx);
        }

        // 非 API 请求全部交给静态资源 (Frontend)
        return env.ASSETS.fetch(request);
    },

    // 定时任务入口
    async scheduled(event: any, env: Bindings, ctx: any) {
        console.log(`[Cron] Scheduled event triggered at ${new Date().toISOString()}`);
        ctx.waitUntil(handleScheduledBackup(env));
    }
};