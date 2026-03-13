import { Hono } from 'hono';
import { EnvBindings } from '@/app/config';
import { authMiddleware } from '@/shared/middleware/auth';
import { rateLimit } from '@/shared/middleware/rateLimitMiddleware';
import { VaultService } from '@/features/vault/vaultService';
import { VaultRepository } from '@/shared/db/repositories/vaultRepository';
// No createDb required here as DB is instantiated at the root (worker.ts/server.ts) and passed via c.env

const vault = new Hono<{ Bindings: EnvBindings, Variables: { user: any } }>();

// 在路由中使用单例/工厂
const getService = (c: any) => {
    // 假设你还需要 createDb 这样封装 D1
    const repo = new VaultRepository(c.env.DB);
    return new VaultService(c.env, repo);
};

vault.use('/*', authMiddleware);

// 获取所有账户 (分页+搜索)
vault.get('/', async (c) => {
    // 解析查询参数
    const page = parseInt(c.req.query('page') || '1', 10);
    const limit = parseInt(c.req.query('limit') || '12', 10);
    const search = c.req.query('search') || '';

    const service = getService(c);
    const result = await service.getAccountsPaginated(page, limit, search);

    return c.json({
        success: true,
        vault: result.items,
        pagination: {
            page,
            limit,
            totalItems: result.totalCount,
            totalPages: result.totalPages
        }
    });
});

// 添加新账户
vault.post('/', async (c) => {
    const user = c.get('user');
    const data = await c.req.json();
    const service = getService(c);
    const item = await service.createAccount(user.username, data);
    return c.json({ success: true, item });
});

// 更新账户
vault.put('/:id', async (c) => {
    const id = c.req.param('id');
    const data = await c.req.json();
    const service = getService(c);
    const item = await service.updateAccount(id, data);
    return c.json({ success: true, item });
});

// 删除账户
vault.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const service = getService(c);
    await service.deleteAccount(id);
    return c.json({ success: true, message: 'Deleted successfully' });
});

// 批量删除账户
vault.post('/batch-delete', async (c) => {
    const { ids } = await c.req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
        return c.json({ success: false, error: 'ids must be a non-empty array' }, 400);
    }
    const service = getService(c);
    const result = await service.batchDeleteAccounts(ids);
    return c.json({ success: true, count: result.count });
});

// 导出账户
vault.post('/export', rateLimit({
    windowMs: 60 * 1000, 
    max: 5,
}), async (c) => {
    const service = getService(c);
    const { type, password } = await c.req.json();

    const result = await service.exportAccounts(type, password);
    if (result.isText) {
        return c.text(result.data as string);
    }
    return c.json(result.data);
});

// 导入账户
vault.post('/import', rateLimit({
    windowMs: 60 * 1000,
    max: 5,
}), async (c) => {
    const user = c.get('user');
    const service = getService(c);
    const { content, type, password } = await c.req.json();

    const result = await service.importAccounts(user.username, type, content, password);
    return c.json({ success: true, ...result });
});

// 从 otpauth:// URI 添加账户 (扫码流程使用)
vault.post('/add-from-uri', async (c) => {
    const user = c.get('user');
    const { uri, category } = await c.req.json();

    if (!uri || typeof uri !== 'string') {
        return c.json({ success: false, error: 'URI is required' }, 400);
    }

    // 宽松解析：兼容实际扫码场景（不严格限制 secret 长度和 period 范围）
    let parsed: { issuer: string; account: string; secret: string; algorithm: string; digits: number; period: number } | null = null;
    try {
        const url = new URL(uri);
        if (url.protocol === 'otpauth:' && (url.hostname === 'totp' || url.hostname === 'hotp')) {
            const label = decodeURIComponent(url.pathname.substring(1));
            const [issuerFromLabel, accountPart] = label.includes(':') ? label.split(':', 2) : ['', label];
            const params = url.searchParams;
            const secret = params.get('secret');
            if (secret) {
                parsed = {
                    issuer: params.get('issuer') || issuerFromLabel || 'Unknown',
                    account: accountPart?.trim() || label.trim(),
                    secret: secret.replace(/\s/g, '').toUpperCase(),
                    algorithm: (params.get('algorithm') || 'SHA1').toUpperCase(),
                    digits: parseInt(params.get('digits') || '6', 10),
                    period: parseInt(params.get('period') || '30', 10),
                };
            }
        }
    } catch { /* invalid URL */ }

    if (!parsed) {
        return c.json({ success: false, error: '无效的 otpauth:// URI 格式' }, 400);
    }

    const service = getService(c);
    const item = await service.createAccount(user.username, {
        service: parsed.issuer,
        account: parsed.account,
        secret: parsed.secret,
        algorithm: parsed.algorithm,
        digits: parsed.digits,
        period: parsed.period,
        category: category || '手机扫码',
    });

    return c.json({ success: true, item });
});


// 弃用的迁移接口
vault.post('/migrate-crypto', async (c) => {
    return c.json({ success: true, message: '不再支持旧版盐值迁移逻辑，所有数据默认已使用新版逻辑', migrated: 0, remaining: 0 });
});

export default vault;