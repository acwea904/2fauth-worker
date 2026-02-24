import { Hono } from 'hono';
import { EnvBindings, AppError, SECURITY_CONFIG } from '../config';
import { authMiddleware, sanitizeInput, validateBase32Secret, validateServiceName, validateAccountName, parseOTPAuthURI } from '../utils/helper';
import { encryptData, decryptData, generateTOTP } from '../utils/crypto';
import { encryptField, decryptField, batchInsertAccounts, batchDeleteAccounts } from '../utils/db';

const accounts = new Hono<{ Bindings: EnvBindings, Variables: { user: any } }>();

// 挂载鉴权中间件
accounts.use('*', authMiddleware);

// 获取所有账号
accounts.get('/', async (c) => {
    const pageStr = c.req.query('page');
    const limitStr = c.req.query('limit');
    const search = c.req.query('search') || '';
    const page = pageStr ? parseInt(pageStr) : 1;
    const limit = limitStr ? parseInt(limitStr) : 50; // 恢复默认 50 条，配合自动迁移策略

    let whereClause = '';
    let params: any[] = [];

    if (search) {
        whereClause = " WHERE (service LIKE ? OR account LIKE ? OR category LIKE ?)";
        const likeTerm = `%${search}%`;
        params.push(likeTerm, likeTerm, likeTerm);
    }

    const countResult = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM accounts${whereClause}`).bind(...params).first();
    const total = countResult?.total as number || 0;

    const query = `SELECT * FROM accounts${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, (page - 1) * limit);

    const { results } = await c.env.DB.prepare(query).bind(...params).all();

    const key = c.env.ENCRYPTION_KEY || c.env.JWT_SECRET;
    
    // 并行解密所有账号的 secret
    const accountsList = await Promise.all(results.map(async (row: any) => {
        const secret = await decryptField(row.secret, key);
        
        // [自动迁移] 旧格式 (含 salt) 异步升级为极速格式
        try {
            const raw = JSON.parse(row.secret);
            if (raw.salt && raw.salt.length > 0) {
                const newSecret = await encryptField(secret, key);
                c.executionCtx.waitUntil(
                    c.env.DB.prepare("UPDATE accounts SET secret = ? WHERE id = ?")
                        .bind(newSecret, row.id)
                        .run()
                );
            }
        } catch (e) { /* ignore error */ }

        return {
            id: row.id,
            service: row.service,
            account: row.account,
            category: row.category,
            secret: secret || '', // 解密失败则为空
            digits: row.digits,
            period: row.period,
            createdAt: row.created_at
        };
    }));

    const response: any = { success: true, accounts: accountsList };
    
    response.pagination = {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
    };

    return c.json(response);
});

// 添加新账号
accounts.post('/', async (c) => {
    const { service, category, account, secret, digits = 6, period = 30 } = await c.req.json();
    const user = c.get('user');

    if (!validateServiceName(service) || !validateAccountName(account) || !validateBase32Secret(secret)) {
        throw new AppError('Invalid input format', 400);
    }
    if (![6, 8].includes(digits) || ![30, 60].includes(period)) {
        throw new AppError('Invalid digits or period', 400);
    }

    // 查重
    const existing = await c.env.DB.prepare(
        "SELECT id FROM accounts WHERE service = ? AND account = ?"
    ).bind(service, account).first();
    
    if (existing) throw new AppError('Account already exists', 409);

    const id = crypto.randomUUID();
    const key = c.env.ENCRYPTION_KEY || c.env.JWT_SECRET;
    const secretEncrypted = await encryptField(secret.replace(/\s/g, '').toUpperCase(), key);

    // 插入
    await c.env.DB.prepare(
        `INSERT INTO accounts (id, service, account, category, secret, digits, period, created_at, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
        id, sanitizeInput(service, 50), sanitizeInput(account, 100), category ? sanitizeInput(category, 30) : '',
        secretEncrypted, digits, period, Date.now(), user.username
    ).run();

    const newAccount = { id, service, account, category, digits, period };

    return c.json({ success: true, account: { ...newAccount, secret: '[PROTECTED]' } });
});

// 修改账号信息
accounts.put('/:id', async (c) => {
    const id = c.req.param('id');
    const { service, category, account, digits, period } = await c.req.json();
    const user = c.get('user');

    if (!validateServiceName(service) || !validateAccountName(account)) {
        throw new AppError('Invalid input format', 400);
    }
    if (digits && ![6, 8].includes(digits)) throw new AppError('Invalid digits', 400);
    if (period && ![30, 60].includes(period)) throw new AppError('Invalid period', 400);

    const result = await c.env.DB.prepare(
        `UPDATE accounts 
         SET service = ?, account = ?, category = ?, digits = COALESCE(?, digits), period = COALESCE(?, period), updated_at = ?, updated_by = ? 
         WHERE id = ?`
    ).bind(
        sanitizeInput(service, 50), sanitizeInput(account, 100), category ? sanitizeInput(category, 30) : '',
        digits || null, period || null, Date.now(), user.username, id
    ).run();

    if (!result.meta.changes) throw new AppError('Account not found', 404);

    return c.json({ success: true, message: 'Account updated successfully' });
});

// 删除指定账号
accounts.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const result = await c.env.DB.prepare("DELETE FROM accounts WHERE id = ?").bind(id).run();
    
    if (!result.meta.changes) throw new AppError('Account not found', 404);

    return c.json({ success: true, message: 'Account deleted successfully' });
});

// 批量删除账号
accounts.post('/batch-delete', async (c) => {
    const { ids } = await c.req.json();
    if (!Array.isArray(ids) || ids.length === 0) throw new AppError('No IDs provided', 400);

    const count = await batchDeleteAccounts(c.env.DB, ids);
    return c.json({ success: true, count, message: `Successfully deleted ${count} accounts` });
});

// 清空所有账号
accounts.delete('/clear-all', async (c) => {
    await c.env.DB.prepare("DELETE FROM accounts").run();
    return c.json({ success: true, message: 'All accounts cleared' });
});

// 生成 TOTP 验证码
accounts.post('/generate-totp', async (c) => {
    const { secret, period = 30, digits = 6 } = await c.req.json();
    
    if (!validateBase32Secret(secret)) throw new AppError('Invalid secret format', 400);
    if (![6, 8].includes(digits) || ![30, 60].includes(period)) throw new AppError('Invalid parameters', 400);

    const code = await generateTOTP(secret, period, digits);
    return c.json({ success: true, code });
});

// 解析 TOTP URI
accounts.post('/parse-uri', async (c) => {
    const { uri } = await c.req.json();
    if (!uri) throw new AppError('URI is required', 400);

    const account = parseOTPAuthURI(uri);
    if (!account) throw new AppError('Invalid OTP Auth URI', 400);

    return c.json({ success: true, account });
});

// 从 URI 添加账户
accounts.post('/add-from-uri', async (c) => {
    const { uri, category } = await c.req.json();
    const user = c.get('user');

    if (!uri) throw new AppError('URI is required', 400);

    const parsedAccount = parseOTPAuthURI(uri);
    if (!parsedAccount) throw new AppError('Invalid OTP Auth URI', 400);

    // 查重
    const existing = await c.env.DB.prepare(
        "SELECT id FROM accounts WHERE service = ? AND account = ?"
    ).bind(parsedAccount.issuer, parsedAccount.account).first();
    if (existing) throw new AppError('该账号已经存在金库中', 409);

    const id = crypto.randomUUID();
    const key = c.env.ENCRYPTION_KEY || c.env.JWT_SECRET;
    const secretEncrypted = await encryptField(parsedAccount.secret, key);

    await c.env.DB.prepare(
        `INSERT INTO accounts (id, service, account, category, secret, digits, period, created_at, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
        id, sanitizeInput(parsedAccount.issuer || 'Unknown', 50), sanitizeInput(parsedAccount.account || 'Unknown', 100),
        category ? sanitizeInput(category, 30) : '', secretEncrypted, parsedAccount.digits, parsedAccount.period, Date.now(), user.username
    ).run();

    const newAccount = { id, service: parsedAccount.issuer, account: parsedAccount.account };

    return c.json({ success: true, account: { ...newAccount, secret: '[PROTECTED]' } });
});

// 通用导出接口 (支持 加密/JSON/2FAS/文本)
accounts.post('/export', async (c) => {
    const { type, password } = await c.req.json();
    
    if (!['encrypted', 'json', '2fas', 'text'].includes(type)) {
        throw new AppError('Invalid export type', 400);
    }

    if (type === 'encrypted') {
        if (!password || password.length < SECURITY_CONFIG.MIN_EXPORT_PASSWORD_LENGTH) {
            throw new AppError(`导出密码至少需要 ${SECURITY_CONFIG.MIN_EXPORT_PASSWORD_LENGTH} 个字符`, 400);
        }
    }

    const { results } = await c.env.DB.prepare("SELECT * FROM accounts").all();
    const key = c.env.ENCRYPTION_KEY || c.env.JWT_SECRET;

    // 解密所有数据
    const plainAccounts = await Promise.all(results.map(async (row: any) => ({
        service: row.service,
        account: row.account,
        category: row.category,
        secret: await decryptField(row.secret, key) || '',
        digits: row.digits,
        period: row.period
    })));
    
    const timestamp = new Date().toISOString();
    const baseData = { version: "2.0", app: "2fauth", timestamp };

    if (type === 'encrypted') {
        const exportData = { ...baseData, encrypted: true, accounts: plainAccounts };
        const encryptedContent = await encryptData(exportData, password);
        return c.json({
            ...baseData, encrypted: true, data: encryptedContent,
            note: "This file is encrypted with your export password. Keep it safe!"
        });
    } else if (type === 'json') {
        return c.json({ ...baseData, encrypted: false, accounts: plainAccounts });
    } else if (type === '2fas') {
        // 2FAS 兼容格式
        const services = plainAccounts.map(acc => ({
            name: acc.service,
            secret: acc.secret,
            otp: { account: acc.account, digits: acc.digits, period: acc.period, algorithm: "SHA1", issuer: acc.service }
        }));
        return c.json({ services });
    } else if (type === 'text') {
        // 纯文本 URI 格式
        const lines = plainAccounts.map(acc => {
            const label = encodeURIComponent(`${acc.service}:${acc.account}`);
            const issuer = encodeURIComponent(acc.service);
            return `otpauth://totp/${label}?secret=${acc.secret}&issuer=${issuer}&digits=${acc.digits}&period=${acc.period}`;
        });
        return c.text(lines.join('\n'));
    }
});

// 导入数据 (支持 加密/JSON/2FAS/文本)
accounts.post('/import', async (c) => {
    const { content, type, password } = await c.req.json();
    const user = c.get('user');
    
    if (!content || !type) throw new AppError('内容和类型不能为空', 400);

    let validAccounts: any[] = [];

    try {
        if (type === 'encrypted') {
            if (!password) throw new AppError('加密导入需要密码', 400);
            const encryptedFile = JSON.parse(content);
            const decryptedData = await decryptData(encryptedFile.data, password);
            validAccounts = decryptedData.accounts || [];
        } else if (type === 'json') {
            const data = JSON.parse(content);
            if (data.app && data.app.includes('2fauth') && Array.isArray(data.data)) {
                validAccounts = data.data.map((item: any) => ({...item, category: ''}));
            } else if (data.accounts) {
                validAccounts = data.accounts;
            } else if (Array.isArray(data)) {
                validAccounts = data;
            } else if (data.services) {
                validAccounts = data.services.map((s: any) => ({
                    service: s.service || s.name, account: s.account || s.login,
                    secret: s.secret, digits: s.digits, period: s.period, category: s.group
                }));
            }
        } else if (type === '2fas') {
            const data = JSON.parse(content);
            if (data.services) {
                validAccounts = data.services.map((s: any) => ({
                    service: s.name, account: s.account || s.username,
                    secret: s.secret, digits: s.digits, period: s.period, category: s.category || s.group
                }));
            }
        } else if (type === 'text') {
            const lines = content.split('\n').filter((line: string) => line.trim());
            for (const line of lines) {
                if (line.trim().startsWith('otpauth://')) {
                    const parsed = parseOTPAuthURI(line.trim());
                    if (parsed) validAccounts.push({
                        service: parsed.issuer, account: parsed.account,
                        secret: parsed.secret, digits: parsed.digits, period: parsed.period, category: ''
                    });
                }
            }
        }
    } catch (e) {
        throw new AppError('解析失败，请检查文件格式或密码是否正确', 400);
    }

    // 过滤有效账户并去重保存
    const key = c.env.ENCRYPTION_KEY || c.env.JWT_SECRET;

    // 1. 预先获取所有已存在的账号标识，避免 N+1 查询
    const { results: existingRows } = await c.env.DB.prepare("SELECT service, account FROM accounts").all();
    // 内存中快速查重 (格式: service:account)
    const existingSet = new Set(existingRows.map((row: any) => `${row.service}:${row.account}`));

    // 2. 内存过滤与并行加密
    const uniqueAccountsToInsert = [];
    const seenInBatch = new Set();

    for (const acc of validAccounts) {
        if (acc.service && acc.account && validateBase32Secret(acc.secret)) {
            const signature = `${acc.service}:${acc.account}`;
            // 查重：既不在数据库中，也不在当前待插入的批次中
            if (!existingSet.has(signature) && !seenInBatch.has(signature)) {
                uniqueAccountsToInsert.push(acc);
                seenInBatch.add(signature);
            }
        }
    }

    // 3. 使用封装好的批量插入函数
    const insertedCount = await batchInsertAccounts(c.env.DB, uniqueAccountsToInsert, key, user.username);

    return c.json({ success: true, count: insertedCount, total: validAccounts.length, duplicates: validAccounts.length - insertedCount });
});

// 手动触发数据迁移 (旧格式 -> 极速格式)
accounts.post('/migrate-crypto', async (c) => {
    const key = c.env.ENCRYPTION_KEY || c.env.JWT_SECRET;
    const limit = 50; // 每次处理 50 条以防超时

    // D1 JSON 查询：查找仍包含 salt 的记录
    const { results } = await c.env.DB.prepare(
        "SELECT id, secret FROM accounts WHERE json_extract(secret, '$.salt') IS NOT NULL LIMIT ?"
    ).bind(limit).all();

    if (results.length === 0) {
        return c.json({ success: true, message: '所有数据已是最新格式', migrated: 0, remaining: 0 });
    }

    // 并行处理解密和加密
    const updates = (await Promise.all(results.map(async (row: any) => {
        try {
            const plain = await decryptField(row.secret as string, key);
            const newSecret = await encryptField(plain, key);
            return c.env.DB.prepare("UPDATE accounts SET secret = ? WHERE id = ?").bind(newSecret, row.id);
        } catch (e) { 
            console.error(`Failed to migrate account ${row.id}`, e);
            return null;
        }
    }))).filter(Boolean);

    // 分批执行更新
    const BATCH_SIZE = 20;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const chunk = updates.slice(i, i + BATCH_SIZE);
        if (chunk.length > 0) await c.env.DB.batch(chunk);
    }

    // 检查剩余数量
    const remaining = await c.env.DB.prepare(
        "SELECT COUNT(*) as count FROM accounts WHERE json_extract(secret, '$.salt') IS NOT NULL"
    ).first('count');

    return c.json({ 
        success: true, 
        migrated: updates.length, 
        remaining: remaining,
        message: `已迁移 ${updates.length} 条数据，剩余 ${remaining} 条。请继续点击直到剩余为 0。` 
    });
});

export default accounts;