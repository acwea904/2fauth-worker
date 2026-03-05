import { Hono } from 'hono';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import { EnvBindings, AppError } from '@/app/config';
import { authMiddleware } from '@/shared/middleware/auth';
import { getAvailableProviders } from '@/features/auth/providers/index';
import { AuthService } from '@/features/auth/authService';

const auth = new Hono<{ Bindings: EnvBindings, Variables: { user: any } }>();

const getService = (c: any) => new AuthService(c.env);

// 获取可用登录方式列表
auth.get('/providers', (c) => {
    const providers = getAvailableProviders(c.env);
    if (providers.length === 0) {
        console.warn('[OAuth] No providers configured. Please check environment variables.');
    }
    const enhancedProviders = providers.map(p => {
        if (p.id === 'telegram') {
            const rawName = c.env.OAUTH_TELEGRAM_BOT_NAME || '';
            return { ...p, botName: rawName.replace(/^@/, '') };
        }
        return p;
    });
    return c.json({ success: true, providers: enhancedProviders });
});

// 获取授权地址
auth.get('/authorize/:provider', async (c) => {
    const providerName = c.req.param('provider');
    const service = getService(c);

    // 生成包含唯一 state 防御 CSRF 的跳转地址
    const authData = await service.generateAuthorizeUrl(providerName);

    // 将 state 存入服务端的 HttpOnly Cookie，有效期 10 分钟
    const stateCookieName = `oauth_state_${providerName}`;
    setCookie(c, stateCookieName, authData.state, {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax', // 允许从第三方回调跳回时携带
        maxAge: 10 * 60, // 10分钟有效期
        path: '/',
    });

    return c.json({
        success: true,
        authUrl: authData.url,
        state: authData.state,
        codeVerifier: authData.codeVerifier
    });
});

// 核心逻辑：用 Code 换取系统的 JWT 令牌
auth.post('/callback/:provider', async (c) => {
    const providerName = c.req.param('provider');
    const body = await c.req.json();

    // --- State 闭环校验开始 ---
    const stateCookieName = `oauth_state_${providerName}`;
    const serverState = getCookie(c, stateCookieName);
    const clientState = body.state; // 前端传回的回调 state 参数

    if (!serverState || !clientState || serverState !== clientState) {
        throw new AppError('oauth_state_invalid', 403);
    }

    // 校验通过，清理一次性 State Cookie
    deleteCookie(c, stateCookieName, { path: '/', secure: true, sameSite: 'Lax' });
    // --- State 闭环校验结束 ---

    const service = getService(c);

    // 调用 Service 层处理登录
    const { token, userInfo, deviceKey } = await service.handleOAuthCallback(providerName, body);

    // 1. 设置 httpOnly 的鉴权 Cookie
    setCookie(c, 'auth_token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        maxAge: 7 * 24 * 60 * 60, // 7天
        path: '/',
    });

    // 2. 设置 CSRF Token Cookie
    const csrfToken = crypto.randomUUID();
    setCookie(c, 'csrf_token', csrfToken, {
        httpOnly: false,
        secure: true,
        sameSite: 'Strict',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
    });

    return c.json({
        success: true,
        userInfo,
        deviceKey
    });
});

// 退出登录
auth.post('/logout', (c) => {
    const cookieOpts = { path: '/', secure: true, sameSite: 'Strict' as const };
    deleteCookie(c, 'auth_token', cookieOpts);
    deleteCookie(c, 'csrf_token', cookieOpts);

    c.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    return c.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// 获取当前用户信息
auth.get('/me', authMiddleware, (c) => {
    const user = c.get('user');
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    c.header('Pragma', 'no-cache');
    c.header('Expires', '0');
    return c.json({
        success: true,
        userInfo: user
    });
});

export default auth;