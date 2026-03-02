import { EnvBindings, AppError } from '@/app/config';
import { VaultRepository } from '@/shared/db/repositories/vaultRepository';
import { encryptField, decryptField, batchInsertVaultItems } from '@/shared/db/db';
import { encryptData, decryptData } from '@/shared/utils/crypto';
import { parseOTPAuthURI, validateBase32Secret } from '@/shared/utils/totp';

export class VaultService {
    private repository: VaultRepository;
    private env: EnvBindings;
    private encryptionKey: string;

    constructor(env: EnvBindings, repository: VaultRepository) {
        this.env = env;
        this.repository = repository;

        if (!env.ENCRYPTION_KEY) {
            throw new AppError('FATAL ERROR: ENCRYPTION_KEY is not configured.', 500);
        }

        this.encryptionKey = env.ENCRYPTION_KEY;
    }

    /**
     * 获取所有账户 (解密)
     */
    async getAllAccounts() {
        const items = await this.repository.findAll();
        return Promise.all(items.map(async (item) => ({
            ...item,
            secret: await decryptField(item.secret, this.encryptionKey) || ''
        })));
    }

    /**
     * 获取分页和搜索条件后的所有账户 (解密)
     */
    async getAccountsPaginated(page: number, limit: number, search: string) {
        const items = await this.repository.findPaginated(page, limit, search);
        const totalCount = await this.repository.count(search);

        const decryptedItems = await Promise.all(items.map(async (item) => ({
            ...item,
            secret: await decryptField(item.secret, this.encryptionKey) || ''
        })));

        return {
            items: decryptedItems,
            totalCount,
            totalPages: Math.ceil(totalCount / limit) || 1
        };
    }

    /**
     * 创建账户
     */
    // normalize a service+account pair for comparison
    private normalizeSignature(service: string, account: string) {
        return `${(service || '').toString().trim().toLowerCase()}:${(account||'').toString().trim().toLowerCase()}`;
    }

    async createAccount(userId: string, data: any) {
        let { service, account, category, secret, digits, period, algorithm } = data;

        if (!service || !account || !secret || !validateBase32Secret(secret)) {
            throw new AppError('Invalid account data or secret format', 400);
        }

        // 入库清洗：去掉 account 中可能带有的 Issuer: 前缀
        if (typeof account === 'string' && account.includes(':')) {
            account = account.split(':').pop()?.trim() || account;
        }

        // duplicate check (case‑insensitive & trimmed) using repository helper
        const existing = await this.repository.findByServiceAccount(service, account);
        if (existing) {
            throw new AppError('Account already exists', 409);
        }

        const normalizedSecret = secret.replace(/\s/g, '').toUpperCase();
        const encryptedSecret = await encryptField(normalizedSecret, this.encryptionKey);

        return await this.repository.create({
            id: crypto.randomUUID(),
            service,
            account,
            category: category || '',
            secret: encryptedSecret,
            algorithm: algorithm || 'SHA1',
            digits: digits || 6,
            period: period || 30,
            createdAt: Date.now(),
            createdBy: userId
        });
    }

    /**
     * 更新账户
     */
    async updateAccount(id: string, data: any) {
        let { service, account, category, secret, digits, period, algorithm } = data;

        if (!service || !account) {
            throw new AppError('Service and account are required', 400);
        }

        // 入库清洗：去掉 account 中可能带有的 Issuer: 前缀
        if (typeof account === 'string' && account.includes(':')) {
            account = account.split(':').pop()?.trim() || account;
        }

        // secret 可选：若未传则保留数据库中已有的加密值
        let encryptedSecret: string;
        if (secret) {
            if (!validateBase32Secret(secret)) {
                throw new AppError('Invalid secret format (must be Base32, min 16 chars)', 400);
            }
            const normalizedSecret = secret.replace(/\s/g, '').toUpperCase();
            encryptedSecret = await encryptField(normalizedSecret, this.encryptionKey);
        } else {
            // 取出现有记录，复用已有加密值
            const existing = await this.repository.findById(id);
            if (!existing) throw new AppError('Account not found', 404);
            encryptedSecret = existing.secret;
        }

        const updated = await this.repository.update(id, {
            service,
            account,
            category: category || '',
            secret: encryptedSecret,
            ...(algorithm && { algorithm }),
            ...(digits && { digits }),
            ...(period && { period }),
        });

        if (!updated) throw new AppError('Account not found', 404);
        return updated;
    }

    /**
     * 删除账户
     */
    async deleteAccount(id: string) {
        const success = await this.repository.delete(id);
        if (!success) throw new AppError('Account not found', 404);
    }

    async batchDeleteAccounts(ids: string[]) {
        if (!ids || ids.length === 0) throw new AppError('No IDs provided', 400);
        const count = await this.repository.batchDelete(ids);
        return { count };
    }

    /**
     * 处理导出
     */
    async exportAccounts(type: string, password?: string) {
        const SECURITY_CONFIG = { MIN_EXPORT_PASSWORD_LENGTH: 5 };
        if (!['encrypted', 'json', '2fas', 'text'].includes(type)) {
            throw new AppError('Invalid export type', 400);
        }

        if (type === 'encrypted') {
            if (!password || password.length < SECURITY_CONFIG.MIN_EXPORT_PASSWORD_LENGTH) {
                throw new AppError(`导出密码至少需要 ${SECURITY_CONFIG.MIN_EXPORT_PASSWORD_LENGTH} 个字符`, 400);
            }
        }

        const plainItems = await this.getAllAccounts();

        const timestamp = new Date().toISOString();
        const baseData = { version: "2.0", app: "2fauth", timestamp };

        if (type === 'encrypted') {
            const exportData = { ...baseData, encrypted: true, accounts: plainItems };
            // 注意：encryptData 已经在 shared/utils/crypto 引入
            const encryptedContent = await encryptData(exportData, password!);
            return {
                data: { ...baseData, encrypted: true, data: encryptedContent, note: "This file is encrypted with your export password. Keep it safe!" },
                isText: false
            };
        } else if (type === 'json') {
            return { data: { ...baseData, encrypted: false, accounts: plainItems }, isText: false };
        } else if (type === '2fas') {
            // 2FAS 导出格式：字段放在 otp 子对象中，尤其是 account/digits/period/algorithm
            const services = plainItems.map(acc => ({
                name: acc.service,
                secret: acc.secret,
                otp: {
                    tokenType: 'TOTP',
                    issuer: acc.service,
                    account: acc.account,
                    digits: acc.digits,
                    period: acc.period,
                    algorithm: (acc.algorithm || 'SHA1').replace('SHA-', 'SHA'),
                    counter: 0,
                },
                order: { position: 0 },
            }));
            return { data: { schemaVersion: 4, appOrigin: 'export', services }, isText: false };
        } else if (type === 'text') {
            const lines = plainItems.map(acc => {
                const label = encodeURIComponent(`${acc.service}:${acc.account}`);
                const issuer = encodeURIComponent(acc.service);
                const algo = acc.algorithm || 'SHA1';
                return `otpauth://totp/${label}?secret=${acc.secret}&issuer=${issuer}&algorithm=${algo}&digits=${acc.digits}&period=${acc.period}`;
            });
            return { data: lines.join('\n'), isText: true };
        }

        throw new AppError('Unhandled export type', 500);
    }

    /**
     * 处理导入
     */
    async importAccounts(userId: string, type: string, content: string, password?: string) {
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
                // 格式 A: 本项目自身导出的 JSON (data.accounts)
                if (data.accounts) {
                    validAccounts = data.accounts;
                    // 格式 B: 标准导出格式 (data.secrets[] with issuer field)
                } else if (Array.isArray(data.secrets)) {
                    validAccounts = data.secrets.map((item: any) => {
                        let account = item.account || item.label || '';
                        if (typeof account === 'string' && account.includes(':')) {
                            account = account.split(':').pop()?.trim() || account;
                        }
                        return {
                            service: item.issuer || item.service || item.name || 'Unknown',
                            account,
                            secret: item.secret,
                            algorithm: item.algorithm || 'SHA1',
                            digits: item.digits || 6,
                            period: item.period || 30,
                            category: item.category || '',
                        };
                    });
                    // 格式 C: 旧版 2FAuth 开源项目导出 (data.data[])
                } else if (data.app && data.app.includes('2fauth') && Array.isArray(data.data)) {
                    validAccounts = data.data.map((item: any) => ({ ...item, category: '' }));
                    // 格式 D: 简单数组
                } else if (Array.isArray(data)) {
                    validAccounts = data;
                    // 格式 E: 老版 2FAS JSON (data.services[])
                } else if (data.services) {
                    validAccounts = data.services.map((s: any) => {
                        let account = s.otp?.account || s.account || s.login || '';
                        if (typeof account === 'string' && account.includes(':')) {
                            account = account.split(':').pop()?.trim() || account;
                        }
                        return {
                            service: s.otp?.issuer || s.name || s.service,
                            account,
                            secret: s.secret,
                            algorithm: s.otp?.algorithm || s.algorithm || 'SHA1',
                            digits: s.otp?.digits || s.digits || 6,
                            period: s.otp?.period || s.period || 30,
                            category: s.group || '',
                        };
                    });
                }
            } else if (type === '2fas') {
                const data = JSON.parse(content);
                if (Array.isArray(data.services)) {
                    validAccounts = data.services.map((s: any) => {
                        let account = s.otp?.account || s.account || s.username || '';
                        if (typeof account === 'string' && account.includes(':')) {
                            account = account.split(':').pop()?.trim() || account;
                        }
                        return {
                            // 2FAS backup 格式 schemaVersion 4：字段在 otp 子对象中
                            service: s.otp?.issuer || s.name || s.otp?.issuer || 'Unknown',
                            account,
                            secret: s.secret || '',
                            algorithm: (s.otp?.algorithm || s.algorithm || 'SHA1').toUpperCase(),
                            digits: s.otp?.digits || s.digits || 6,
                            period: s.otp?.period || s.period || 30,
                            category: s.group || s.category || '',
                        };
                    });
                }
            } else if (type === 'text') {
                const lines = content.split('\n').filter((line: string) => line.trim());
                for (const line of lines) {
                    if (line.trim().startsWith('otpauth://')) {
                        const parsed = parseOTPAuthURI(line.trim());
                        if (parsed) validAccounts.push({
                            service: parsed.issuer, account: parsed.account,
                            secret: parsed.secret, algorithm: parsed.algorithm,
                            digits: parsed.digits, period: parsed.period, category: ''
                        });
                    }
                }
            }
        } catch (e) {
            throw new AppError('解析失败，请检查文件格式或密码是否正确', 400);
        }

        if (type === 'raw') validAccounts = JSON.parse(content);

        // 获取现有以去重 (使用小写/去空格以避免大小写差异导致重复)
        const existingItems = await this.repository.findAll();
        const existingSet = new Set(existingItems.map((row: any) => this.normalizeSignature(row.service, row.account)));

        const uniqueAccountsToInsert: any[] = [];
        const seenInBatch = new Set<string>();

        for (const acc of validAccounts) {
            if (acc.service && acc.account && validateBase32Secret(acc.secret)) {
                // 统一清洗：去掉 account 中可能带有的 Issuer: 前缀
                if (typeof acc.account === 'string' && acc.account.includes(':')) {
                    acc.account = acc.account.split(':').pop()?.trim() || acc.account;
                }

                const signature = this.normalizeSignature(acc.service, acc.account);
                if (!existingSet.has(signature) && !seenInBatch.has(signature)) {
                    uniqueAccountsToInsert.push(acc);
                    seenInBatch.add(signature);
                }
            }
        }

        const insertedCount = await batchInsertVaultItems(this.env.DB, uniqueAccountsToInsert, this.encryptionKey, userId);

        return { count: insertedCount, total: validAccounts.length, duplicates: validAccounts.length - insertedCount };
    }

}
