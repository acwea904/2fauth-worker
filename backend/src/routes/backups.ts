import { Hono } from 'hono';
import { EnvBindings, AppError, SECURITY_CONFIG } from '../config';
import { authMiddleware, sanitizeInput } from '../utils/helper';
import { encryptData, decryptData } from '../utils/crypto';
import { BackupProvider } from '../providers/BackupProvider';
import { WebDavProvider } from '../providers/WebDavProvider';
import { S3Provider } from '../providers/S3Provider';
import { batchInsertAccounts, decryptField } from '../utils/db';

const backups = new Hono<{ Bindings: EnvBindings, Variables: { user: any } }>();

backups.use('*', authMiddleware);

// 工厂函数：获取 Provider 实例
async function getProvider(type: string, config: any): Promise<BackupProvider> {
    switch (type) {
        case 'webdav':
            return new WebDavProvider(config);
        case 's3':
            return new S3Provider(config);
        default:
            throw new AppError(`Unknown provider type: ${type}`, 400);
    }
}

// 辅助函数：加密配置敏感字段 (存储前)
async function processConfigForStorage(type: string, config: any, key: string) {
    const processed = { ...config };
    if (type === 'webdav') {
        if (processed.password) {
            processed.password = await encryptData(processed.password, key);
        }
    }
    if (type === 's3') {
        if (processed.secretAccessKey) {
            processed.secretAccessKey = await encryptData(processed.secretAccessKey, key);
        }
    }
    return JSON.stringify(processed);
}

// 辅助函数：解密配置敏感字段 (使用前)
async function processConfigForUsage(type: string, configStr: string, key: string) {
    const config = JSON.parse(configStr);
    if (type === 'webdav') {
        if (config.password) {
            config.password = await decryptData(config.password, key);
        }
    }
    if (type === 's3') {
        if (config.secretAccessKey) {
            config.secretAccessKey = await decryptData(config.secretAccessKey, key);
        }
    }
    return config;
}

// 获取备份源列表
backups.get('/providers', async (c) => {
    const { results } = await c.env.DB.prepare("SELECT * FROM backup_providers ORDER BY created_at DESC").all();
    
    const key = c.env.ENCRYPTION_KEY || c.env.JWT_SECRET;
    const providers = await Promise.all(results.map(async (row: any) => {
        // 解密配置供前端回显 (前端需自行处理掩码)
        const config = await processConfigForUsage(row.type, row.config, key);
        return {
            ...row,
            config,
            auto_backup: !!row.auto_backup,
            auto_backup_password: !!row.auto_backup_password // 仅返回是否存在密码的标记
        };
    }));

    return c.json({ success: true, providers });
});

// 添加备份源
backups.post('/providers', async (c) => {
    const { type, name, config, autoBackup, autoBackupPassword } = await c.req.json();
    
    if (!type || !name || !config) throw new AppError('Missing required fields', 400);

    const key = c.env.ENCRYPTION_KEY || c.env.JWT_SECRET;
    const encryptedConfig = await processConfigForStorage(type, config, key);

    let encryptedAutoBackupPwd = null;
    if (autoBackup && autoBackupPassword) {
        if (autoBackupPassword.length < 12) throw new AppError('Auto-backup password must be at least 12 characters', 400);
        encryptedAutoBackupPwd = JSON.stringify(await encryptData(autoBackupPassword, key));
    } else if (autoBackup) {
        throw new AppError('Auto-backup password is required (min 12 chars)', 400);
    }

    const res = await c.env.DB.prepare(
        "INSERT INTO backup_providers (type, name, config, auto_backup, auto_backup_password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(type, name, encryptedConfig, autoBackup ? 1 : 0, encryptedAutoBackupPwd, Date.now(), Date.now()).run();

    return c.json({ success: true, id: res.meta.last_row_id });
});

// 更新备份源
backups.put('/providers/:id', async (c) => {
    const id = c.req.param('id');
    const { name, config, type, autoBackup, autoBackupPassword } = await c.req.json();
    
    const key = c.env.ENCRYPTION_KEY || c.env.JWT_SECRET;
    const encryptedConfig = await processConfigForStorage(type, config, key);

    // 获取当前配置以处理密码更新
    const current: any = await c.env.DB.prepare("SELECT auto_backup_password FROM backup_providers WHERE id = ?").bind(id).first();
    
    let finalAutoPwd = current?.auto_backup_password;
    if (autoBackupPassword) {
        if (autoBackupPassword.length < 12) throw new AppError('Auto-backup password must be at least 12 characters', 400);
        finalAutoPwd = JSON.stringify(await encryptData(autoBackupPassword, key));
    } else if (autoBackup && !finalAutoPwd) {
        // 开启了自动备份，没传新密码，且数据库里也没有旧密码
        throw new AppError('Auto-backup password is required (min 12 chars)', 400);
    }

    await c.env.DB.prepare(
        "UPDATE backup_providers SET name = ?, config = ?, auto_backup = ?, auto_backup_password = ?, updated_at = ? WHERE id = ?"
    ).bind(name, encryptedConfig, autoBackup ? 1 : 0, finalAutoPwd, Date.now(), id).run();

    return c.json({ success: true });
});

// 删除备份源
backups.delete('/providers/:id', async (c) => {
    const id = c.req.param('id');
    await c.env.DB.prepare("DELETE FROM backup_providers WHERE id = ?").bind(id).run();
    return c.json({ success: true });
});

// 测试连接
backups.post('/providers/test', async (c) => {
    const { type, config } = await c.req.json();
    try {
        const provider = await getProvider(type, config);
        await provider.testConnection();
        return c.json({ success: true, message: 'Connection successful' });
    } catch (e: any) {
        throw new AppError(`Connection failed: ${e.message}`, 400);
    }
});

// 执行备份 (导出)
backups.post('/providers/:id/backup', async (c) => {
    const id = c.req.param('id');
    const { password } = await c.req.json(); 

    // 获取 Provider 配置
    const providerRow: any = await c.env.DB.prepare("SELECT * FROM backup_providers WHERE id = ?").bind(id).first();
    if (!providerRow) throw new AppError('Provider not found', 404);

    const key = c.env.ENCRYPTION_KEY || c.env.JWT_SECRET;

    // 确定加密密码 (优先使用传入密码，其次尝试自动备份密码)
    let encryptionPassword = password;
    if (!encryptionPassword && providerRow.auto_backup && providerRow.auto_backup_password) {
        try {
            encryptionPassword = await decryptData(JSON.parse(providerRow.auto_backup_password), key);
        } catch (e) {
            console.error('Failed to decrypt auto backup password', e);
        }
    }

    if (!encryptionPassword || encryptionPassword.length < SECURITY_CONFIG.MIN_EXPORT_PASSWORD_LENGTH) {
        throw new AppError(`Password required (min ${SECURITY_CONFIG.MIN_EXPORT_PASSWORD_LENGTH} chars) or enable auto-backup with a valid password`, 400);
    }

    const config = await processConfigForUsage(providerRow.type, providerRow.config, key);
    const provider = await getProvider(providerRow.type, config);

    // 准备导出数据
    const { results: accountResults } = await c.env.DB.prepare("SELECT * FROM accounts").all();
    
    // 并行解密，忽略失败项
    const accounts = (await Promise.all(accountResults.map(async (row: any) => {
        const secret = await decryptField(row.secret, key);
        if (!secret) return null; // 如果某条数据解密失败（如密钥轮换遗留的旧数据），则跳过，不影响整体备份

        return {
            service: row.service,
            account: row.account,
            category: row.category,
            secret: secret,
            digits: row.digits,
            period: row.period
        };
    }))).filter(Boolean);

    const exportPayload = {
        version: "2.0",
        app: "2fauth",
        encrypted: true,
        timestamp: new Date().toISOString(),
        accounts
    };

    // 加密导出数据
    const userEncrypted = await encryptData(exportPayload, encryptionPassword);
    const fileContent = JSON.stringify({ ...exportPayload, data: userEncrypted, accounts: undefined });

    // 上传文件
    const filename = `2fa-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    try {
        await provider.uploadBackup(filename, fileContent);
        
        // 更新状态
        await c.env.DB.prepare("UPDATE backup_providers SET last_backup_at = ?, last_backup_status = 'success' WHERE id = ?")
            .bind(Date.now(), id).run();
            
        return c.json({ success: true, message: 'Backup successful' });
    } catch (e: any) {
        await c.env.DB.prepare("UPDATE backup_providers SET last_backup_status = 'failed' WHERE id = ?")
            .bind(id).run();
        throw new AppError(`Backup failed: ${e.message}`, 500);
    }
});

// 获取文件列表
backups.get('/providers/:id/files', async (c) => {
    const id = c.req.param('id');
    const providerRow: any = await c.env.DB.prepare("SELECT * FROM backup_providers WHERE id = ?").bind(id).first();
    if (!providerRow) throw new AppError('Provider not found', 404);

    const key = c.env.ENCRYPTION_KEY || c.env.JWT_SECRET;
    const config = await processConfigForUsage(providerRow.type, providerRow.config, key);
    const provider = await getProvider(providerRow.type, config);

    const files = await provider.listBackups();
    return c.json({ success: true, files });
});

// 恢复备份
backups.post('/providers/:id/restore', async (c) => {
    const id = c.req.param('id');
    const { filename, password } = await c.req.json();

    const providerRow: any = await c.env.DB.prepare("SELECT * FROM backup_providers WHERE id = ?").bind(id).first();
    if (!providerRow) throw new AppError('Provider not found', 404);

    const key = c.env.ENCRYPTION_KEY || c.env.JWT_SECRET;
    const config = await processConfigForUsage(providerRow.type, providerRow.config, key);
    const provider = await getProvider(providerRow.type, config);

    // 下载文件
    let content: string;
    try {
        content = await provider.downloadBackup(filename);
    } catch (e: any) {
        throw new AppError(`Restore download failed: ${e.message}`, 500);
    }

    // 解析并解密
    let accounts = [];
    try {
        const backupFile = JSON.parse(content);
        if (!backupFile.data) throw new Error('Legacy format or invalid file');
        
        const decrypted = await decryptData(backupFile.data, password); // 使用用户输入的密码解密
        accounts = decrypted.accounts || [];
    } catch (e: any) {
        throw new AppError('解密失败：密码错误或文件格式不兼容', 400);
    }

    // 重置数据库并批量插入
    await c.env.DB.prepare("DELETE FROM accounts").run();

    const insertedCount = await batchInsertAccounts(c.env.DB, accounts, key, 'restore');

    return c.json({ success: true, message: 'Restore successful', count: insertedCount });
});

// 定时备份任务 (Cron Handler)
export async function handleScheduledBackup(env: EnvBindings) {
    console.log('[Backup] Starting scheduled backup...');
    
    // 获取所有备份源
    const { results: providers } = await env.DB.prepare("SELECT * FROM backup_providers").all();
    if (!providers || providers.length === 0) {
        console.log('[Backup] No backup providers configured.');
        return;
    }

    const key = env.ENCRYPTION_KEY || env.JWT_SECRET;
    
    // 准备备份数据 (系统密钥解密)
    const { results: accountResults } = await env.DB.prepare("SELECT * FROM accounts").all();
    
    const accounts = (await Promise.all(accountResults.map(async (row: any) => {
        const secret = await decryptField(row.secret, key);
        if (!secret) return null;
        return {
            service: row.service,
            account: row.account,
            category: row.category,
            secret: secret,
            digits: row.digits,
            period: row.period
        };
    }))).filter(Boolean);

    const exportPayload = {
        version: "2.0",
        app: "2fauth",
        encrypted: true,
        timestamp: new Date().toISOString(),
        accounts
    };

    const filename = `2fa-backup-auto-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

    // 遍历上传
    for (const row of providers) {
        // 跳过未开启自动备份或未设置密码的
        if (!row.auto_backup || !row.auto_backup_password) continue;

        try {
            // 解密该 Provider 的自动备份密码
            const backupPassword = await decryptData(JSON.parse(row.auto_backup_password), key);
            // 使用该密码加密数据
            const userEncrypted = await encryptData(exportPayload, backupPassword);
            const fileContent = JSON.stringify({ ...exportPayload, data: userEncrypted, accounts: undefined });

            const config = await processConfigForUsage(row.type as string, row.config as string, key);
            const provider = await getProvider(row.type as string, config);
            
            await provider.uploadBackup(filename, fileContent);
            
            await env.DB.prepare("UPDATE backup_providers SET last_backup_at = ?, last_backup_status = 'success' WHERE id = ?")
                .bind(Date.now(), row.id).run();
            
            console.log(`[Backup] Successfully backed up to ${row.name}`);
        } catch (e: any) {
            console.error(`[Backup] Failed to backup to ${row.name}: ${e.message}`);
            await env.DB.prepare("UPDATE backup_providers SET last_backup_status = 'failed' WHERE id = ?")
                .bind(row.id).run();
        }
    }
}

export default backups;
